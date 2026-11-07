"""Query Overture Maps places for Cincinnati and write pois.parquet + pois.geojson."""
import json
from pathlib import Path

import duckdb

RELEASE = "2026-10-21.0"
BBOX = (-84.712, 39.021, -84.369, 39.160)  # xmin, ymin, xmax, ymax
MIN_CONFIDENCE = 0.5

ROOT = Path(__file__).resolve().parent.parent
PARQUET = ROOT / "data" / "pois.parquet"
GEOJSON = ROOT / "web" / "public" / "data" / "pois.geojson"


def main():
    PARQUET.parent.mkdir(exist_ok=True)
    GEOJSON.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';")
    xmin, ymin, xmax, ymax = BBOX
    con.execute(f"""
        COPY (
            SELECT id,
                   names.primary AS name,
                   taxonomy.primary AS category,
                   confidence,
                   addresses[1].freeform AS address,
                   (bbox.xmin + bbox.xmax) / 2 AS lon,
                   (bbox.ymin + bbox.ymax) / 2 AS lat
            FROM read_parquet('s3://overturemaps-us-west-2/release/{RELEASE}/theme=places/type=place/*')
            WHERE bbox.xmin BETWEEN {xmin} AND {xmax}
              AND bbox.ymin BETWEEN {ymin} AND {ymax}
              AND names.primary IS NOT NULL
              AND confidence >= {MIN_CONFIDENCE}
        ) TO '{PARQUET}' (FORMAT PARQUET)
    """)
    rows = con.execute(f"SELECT id, name, category, lon, lat FROM '{PARQUET}'").fetchall()
    features = [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {"id": id_, "name": name, "category": category},
        }
        for id_, name, category, lon, lat in rows
    ]
    GEOJSON.write_text(json.dumps({"type": "FeatureCollection", "features": features}))
    print(f"{len(features)} POIs -> {PARQUET}, {GEOJSON} ({GEOJSON.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
