# Cincinnati storefronts

MapLibre map (free OpenFreeMap basemap, no token) of Cincinnati POIs (Overture Maps), with ~100 POIs matched to Mapillary street-level images.

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
