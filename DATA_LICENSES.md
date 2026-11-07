# Data and third-party licenses

The source code in this repository is MIT licensed (see `LICENSE`). The data and
images it ships and displays come from other sources with their own terms:

| Data | Source | License |
|------|--------|---------|
| `web/public/data/pois.geojson` (names, categories, locations) | [Overture Maps Foundation](https://overturemaps.org), places theme, release `2026-10-21.0` | CDLA Permissive 2.0 (some contributing sources have additional attribution terms, see Overture's [attribution page](https://docs.overturemaps.org/attribution/)) |
| `web/public/images/`, `web/public/thumbs/`, `web/public/data/matches.json` (street-level photos, capture dates, links) | [Mapillary](https://www.mapillary.com) contributors | CC BY-SA 4.0. Photos are credited to their Mapillary contributors; each popup links back to the original photo. Redistribution and adaptations must keep this license. |
| Basemap tiles and style | [OpenFreeMap](https://openfreemap.org), © [OpenMapTiles](https://openmaptiles.org), data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) | ODbL (data), CC BY 4.0 (OpenMapTiles) |

Library dependencies (React, Vite, MapLibre GL JS and others) keep their own licenses; see each package.

The app displays these credits in the side panel and the map attribution control. Please keep them if you fork or redeploy it.
