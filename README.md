# Global Authoritarian Expansion Map

Dark intelligence-dashboard UI for exploring Russia, USA, and China influence rows from the ResurgamHub country-scope workbook.

## Architecture

- React + TypeScript + Vite
- Leaflet through React-Leaflet
- `MapContainer` and configurable `TileLayer`
- `L.geoJSON` country polygons joined by ISO3
- `L.polyline` curved influence-flow overlays using `L.canvas()`
- Custom Leaflet panes for country fill, borders, flows, selected outlines, and popups

Tile settings are configurable:

```bash
VITE_TILE_URL=https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png
VITE_TILE_ATTRIBUTION="..."
```

## Data Pipeline

The build starts from:

```text
data/input/resurgam_actor_influence_resurgamhub_countries_only_workbook.xlsx
```

The workbook contains Russia, China, United States, and European Union rows. The dashboard currently publishes Russia, China, and United States as `USA` so the actor selector stays aligned with the app UI.

The build extracts workbook sheets into `public/data` and `data/processed`, including:

- `Map_Data`
- `Scoring_Matrix`
- `Score_Color_Legend`
- `Dashboard`
- `Evidence_Log`
- `Source_Register`
- `Factor_Model`
- `Country_Master`
- `Country_Config`

It also generates:

- `normalized_map_data.json`
- `joined_countries.geojson`
- `flows.json`
- `build_summary.json`
- `validation_report.json`

## ISO3 Boundary Join

`scripts/build_data.py` downloads a world boundary GeoJSON if needed, preserves workbook ISO3 values, and joins normalized actor rows to country polygons by ISO3. Countries without workbook rows remain visible as neutral dark boundaries. When multiple actors have scores for the same ISO3 in the all-actors view, the polygon uses the highest composite score; actor-specific filters show the selected actor layer.

## Confidence Opacity

Workbook score colors are used as a fixed 0-10 sequential palette for country fills, bars, legends, and flows. The same score bucket always maps to the same color. Confidence fields drive map opacity. Review rows are deliberately less authoritative than verified rows.

## Demo Data Governance

Generated curved flows are marked `Demo`. Numeric screening rows are marked `Needs review`; rows with no source-backed score are marked `Unscored`. Demo, review, and unscored material must not be presented as verified intelligence.

To replace pilot scores with verified evidence:

1. Add source-backed rows to `Evidence_Log`.
2. Update `Source_Register` with reliability and source-governance details.
3. Revise `Factor_Model` and scoring guidance if weights or definitions change.
4. Update `Scoring_Matrix` scores, confidence, source URLs, and publication status.
5. Run `npm run build:data`.

## Setup

```bash
npm install
pip install -r requirements.txt
npm run build:data
npm run dev
```

## Commands

```bash
npm run dev
npm run build
npm run test
npm run lint
```

## Deployment

### GitHub Pages

This repo includes `.github/workflows/deploy-pages.yml`. After the branch is merged to `main`, GitHub Actions can build and deploy the dashboard to:

```text
https://funitbro.github.io/map_resurgam/
```

In the GitHub repo settings, set **Pages** source to **GitHub Actions**. The workflow:

- installs Node and Python dependencies
- runs `npm run build`
- sets `VITE_BASE_PATH=/map_resurgam/`
- uploads `dist/` to GitHub Pages

You can also run it manually from the GitHub Actions tab with **Deploy GitHub Pages**.

### Vercel

`vercel.json` is included. Import the repository in Vercel and use the default project settings. The config builds with:

```bash
pip install -r requirements.txt && npm ci && npm run build
```

Output directory:

```text
dist
```

### Netlify

`netlify.toml` is included. Import the repository in Netlify. It uses:

```bash
pip install -r requirements.txt && npm ci && npm run build
```

Publish directory:

```text
dist
```

### Manual Static Host

Run locally:

```bash
npm run build
```

Deploy `dist/` to any static host.
