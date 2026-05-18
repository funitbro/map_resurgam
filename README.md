# Interactive Authoritarian Influence Map

## Purpose

Visualizes country-level influence scoring for Russia, USA, and China across leverage, contractor/security presence, propaganda ecosystems, and election or political-process interference.

## Scoring dimensions

- Influence / leverage
- PMC / PSC / contractor presence
- Propaganda ecosystem
- Election / political-process interference

## Data sources

The app is built from structured evaluation workbooks and their open-source evidence logs:

- `data/input/resurgam_authoritarian_influence_scores.xlsx`
- `data/input/usa_authoritarian_influence_scores.xlsx`
- `data/input/china_authoritarian_influence_scores.xlsx`
- `data/input/interactive_influence_map_all_in_one_google_sheet.xlsx`

## Setup

```bash
npm install
pip install -r requirements.txt
npm run build:data
npm run dev
```

## Data refresh

Place updated workbooks in `data/input` and run:

```bash
npm run build:data
```

The generated files are written to `public/data` for the frontend and `data/processed` for review.

## Deployment

```bash
npm run build
```

Deploy `dist/` to GitHub Pages, Vercel, or Netlify. For GitHub Pages, configure the Pages source to the build artifact or publish `dist/` from CI. Vercel and Netlify can use `npm run build` as the build command and `dist` as the publish directory.

## Methodology

Scores use a 0-5 scale. The composite score is the average of the four dimensions unless a workbook already contains a trusted composite score. Confidence is normalized to 0-1 and reflects source quality, number of sources, specificity, and recency.

PMC/PSC scoring is actor-specific:

- Russia: Wagner, Africa Corps, and PMC-style military presence.
- USA: contractors, security contractors, military-support contractors, and PMC-like presence.
- China: private security companies, overseas police or security cooperation, GSI-linked security activity, and PLA-linked facility access.

Election interference is scored conservatively. Diplomacy or democracy assistance alone is not enough; higher scores require targeted political-process interference, covert support, coercion, cyber operations, disinformation, or documented manipulation.

## Map data

If `public/data/countries.geojson` is present, `scripts/export_geojson.py` joins score records to country polygons by ISO3 and exports actor choropleth layers. Without a polygon file, the exporter emits point features from workbook latitude/longitude columns so the map remains usable.

## Limitations

Open-source evidence is uneven by country and actor. Scores are analytical estimates, not legal findings or definitive attribution.

