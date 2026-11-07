# Cincinnati storefronts

MapLibre map (free OpenFreeMap basemap, no token) of Cincinnati POIs (Overture Maps), with 300 POIs matched to Mapillary street-level photos of their storefronts. Built to explore the "atmosphere" of places by browsing and comparing storefronts.

## Token
- **Mapillary**: register an app at mapillary.com/dashboard/developers, copy the client token (`MLY|…`) into `.env` as `MAPILLARY_TOKEN=...`.

## Run
```
python3 -m venv .venv && .venv/bin/pip install -r pipeline/requirements.txt
.venv/bin/python pipeline/fetch_pois.py     # Overture -> data/pois.parquet + web/public/data/pois.geojson
.venv/bin/python pipeline/match_images.py   # Mapillary -> web/public/data/matches.json + web/public/images/
.venv/bin/python pipeline/make_thumbs.py     # 320px thumbnails for the sidebar
cd web && npm install && npm run dev
```
Use Node 24 (`nvm use`, see `.nvmrc`).

## GitHub Pages
The built app is fully static (POIs, matches and images live in `web/public/`), so no tokens are needed at deploy time.
1. Push this repo to GitHub on branch `main` (`.env`, `data/` and `.venv/` are git-ignored).
2. Repo Settings → Pages → Source: **GitHub Actions**.
3. `.github/workflows/deploy.yml` builds `web/` and publishes it at `https://<user>.github.io/<repo>/`.

Live site: https://gefgu.github.io/mapillary-storefronts/

## How matching works
For a random sample of POIs (storefront-like categories first), the pipeline asks Mapillary for images within 30 m and keeps the best non-panoramic, recent one whose camera heading points at the POI (within 25°). See `pipeline/match_images.py` for the thresholds. Matches are heuristic: some photos show the street rather than the shop.

## Project layout
- `pipeline/` Python scripts: Overture fetch, Mapillary matching, thumbnails
- `web/` React + Vite + MapLibre app (static, deployable to GitHub Pages)
- `docs/ux-critique-prompt.md` the prompt used for the two-round UX critique

## License
Code: MIT (`LICENSE`). Data and photos: see `DATA_LICENSES.md` (Overture CDLA-Permissive-2.0, Mapillary CC BY-SA 4.0, OpenStreetMap ODbL).
