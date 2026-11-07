"""Match a random sample of POIs to Mapillary street-level images (nearest + facing)."""
import json
import math
import os
import random
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path

import duckdb
import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
TOKEN = os.environ.get("MAPILLARY_TOKEN")

TARGET = 300
SEED = 42
MAX_DIST_M = 30
FETCH_RADIUS_M = 30  # keep fixed: cached responses depend on it
MAX_ANGLE_DEG = 25
ANGLE_WEIGHT = 0.5  # metres of penalty per degree off-axis
MAX_AGE_YEARS = 5
SLEEP_S = 0.05
WORKERS = 8
STOREFRONT_PREFIXES = (
    "restaurant", "cafe", "coffee", "bar", "bakery", "shop", "store", "retail",
    "clothing", "salon", "barber", "boutique", "grocery", "pub", "brewery", "gallery",
)

PARQUET = ROOT / "data" / "pois.parquet"
CACHE = ROOT / "data" / "mapillary_cache"
IMAGES = ROOT / "web" / "public" / "images"
MATCHES = ROOT / "web" / "public" / "data" / "matches.json"
API = "https://graph.mapillary.com/images"
FIELDS = "id,geometry,computed_geometry,compass_angle,computed_compass_angle,captured_at,is_pano,thumb_1024_url"


def haversine_m(lon1, lat1, lon2, lat2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(a))


def bearing_deg(lon1, lat1, lon2, lat2):
    p1, p2, dl = math.radians(lat1), math.radians(lat2), math.radians(lon2 - lon1)
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def angle_diff(a, b):
    d = abs(a - b) % 360
    return min(d, 360 - d)


def get_json(url, params, retries=4):
    for attempt in range(retries):
        r = requests.get(url, params=params, timeout=30)
        if r.status_code == 200:
            return r.json()
        if r.status_code in (429, 500, 502, 503, 504):
            time.sleep(2 ** attempt)
            continue
        r.raise_for_status()
    raise RuntimeError(f"giving up on {url}")


def fetch_images(poi):
    """Mapillary images in a ~30 m box around the POI (cached on disk)."""
    cache_file = CACHE / f"{poi['id']}.json"
    if cache_file.exists():
        return json.loads(cache_file.read_text())
    dlat = FETCH_RADIUS_M / 111_320
    dlon = FETCH_RADIUS_M / (111_320 * math.cos(math.radians(poi["lat"])))
    bbox = f"{poi['lon'] - dlon},{poi['lat'] - dlat},{poi['lon'] + dlon},{poi['lat'] + dlat}"
    data = get_json(API, {"bbox": bbox, "fields": FIELDS, "limit": 50, "access_token": TOKEN})
    cache_file.write_text(json.dumps(data))
    time.sleep(SLEEP_S)
    return data


def best_image(poi, data):
    cutoff = datetime.now(timezone.utc) - timedelta(days=365 * MAX_AGE_YEARS)
    best = None
    for img in data.get("data", []):
        if img.get("is_pano") or not img.get("thumb_1024_url"):
            continue
        captured = datetime.fromtimestamp(img["captured_at"] / 1000, timezone.utc)
        if captured < cutoff:
            continue
        geom = img.get("computed_geometry") or img.get("geometry")
        heading = img.get("computed_compass_angle", img.get("compass_angle"))
        if not geom or heading is None:
            continue
        lon, lat = geom["coordinates"]
        dist = haversine_m(lon, lat, poi["lon"], poi["lat"])
        diff = angle_diff(bearing_deg(lon, lat, poi["lon"], poi["lat"]), heading)
        if dist > MAX_DIST_M or diff > MAX_ANGLE_DEG:
            continue
        score = dist + ANGLE_WEIGHT * diff
        if best is None or score < best[0]:
            best = (score, img, dist, diff, captured)
    return best


def main():
    if not TOKEN:
        raise SystemExit("Set MAPILLARY_TOKEN in .env (see README)")
    CACHE.mkdir(parents=True, exist_ok=True)
    IMAGES.mkdir(parents=True, exist_ok=True)
    MATCHES.parent.mkdir(parents=True, exist_ok=True)

    rows = duckdb.connect().execute(f"SELECT id, name, category, lon, lat FROM '{PARQUET}'").fetchall()
    pois = [dict(zip(("id", "name", "category", "lon", "lat"), r)) for r in rows]
    preferred = [p for p in pois if (p["category"] or "").startswith(STOREFRONT_PREFIXES)]
    rest = [p for p in pois if p not in preferred]
    rng = random.Random(SEED)
    rng.shuffle(preferred)
    rng.shuffle(rest)
    candidates = preferred + rest

    matches, tried = {}, 0
    with ThreadPoolExecutor(WORKERS) as pool:
        pairs = (
            pair
            for i in range(0, len(candidates), WORKERS * 4)
            for pair in zip(
                candidates[i : i + WORKERS * 4], pool.map(fetch_images, candidates[i : i + WORKERS * 4])
            )
        )
        for poi, data in pairs:
            if len(matches) >= TARGET:
                break
            tried += 1
            best = best_image(poi, data)
            if not best:
                continue
            _, img, dist, diff, captured = best
            out = IMAGES / f"{poi['id']}.jpg"
            if not out.exists():
                out.write_bytes(requests.get(img["thumb_1024_url"], timeout=60).content)
            matches[poi["id"]] = {
                "image_id": img["id"],
                "image_file": f"images/{poi['id']}.jpg",
                "captured_at": captured.date().isoformat(),
                "distance_m": round(dist, 1),
                "angle_diff": round(diff, 1),
                "mapillary_url": f"https://www.mapillary.com/app/?pKey={img['id']}",
            }
            print(f"[{len(matches)}/{TARGET}] {poi['name']} ({dist:.0f} m, {diff:.0f}°) after {tried} tried", flush=True)

    for stale in IMAGES.glob("*.jpg"):  # drop images from earlier, looser runs
        if stale.stem not in matches:
            stale.unlink()
    MATCHES.write_text(json.dumps(matches, indent=1))
    print(f"\nTried {tried} POIs, matched {len(matches)} -> {MATCHES}")


if __name__ == "__main__":
    main()
