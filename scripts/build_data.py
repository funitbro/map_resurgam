from __future__ import annotations

import json
import math
import re
import urllib.request
from datetime import date, datetime
from pathlib import Path
from typing import Any

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "data" / "input" / "interactive_influence_map_all_in_one_google_sheet.xlsx"
USA_INPUT = ROOT / "data" / "input" / "usa_authoritarian_influence_scores.xlsx"
CHINA_INPUT = ROOT / "data" / "input" / "china_authoritarian_influence_scores.xlsx"
PUBLIC_DATA = ROOT / "public" / "data"
PROCESSED = ROOT / "data" / "processed"
WORLD_SOURCE = PUBLIC_DATA / "world_countries_source.geojson"
COUNTRIES = PUBLIC_DATA / "countries.geojson"
JOINED = PUBLIC_DATA / "joined_countries.geojson"

WORLD_URL = "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson"
EXTRACT_SHEETS = ["Map_Data", "Legend_Config", "Dashboard", "Evidence_Log", "Source_Register", "Rules_Weights"]

METRICS = {
    "composite": {
        "score": "Composite_score",
        "color": "Composite_colour",
        "confidence": "Composite_confidence",
        "opacity": None,
        "label": "Composite risk",
    },
    "influence": {
        "score": "Russian_influence_score",
        "color": "Russian_colour",
        "confidence": "Russian_confidence",
        "opacity": "Russian_opacity",
        "label": "Russian influence",
    },
    "security": {
        "score": "PMC_presence_score",
        "color": "PMC_colour",
        "confidence": "PMC_confidence",
        "opacity": "PMC_opacity",
        "label": "PMC presence",
    },
    "propaganda": {
        "score": "Propaganda_ecosystems_score",
        "color": "Propaganda_colour",
        "confidence": "Propaganda_confidence",
        "opacity": "Propaganda_opacity",
        "label": "Propaganda ecosystems",
    },
    "election": {
        "score": "Election_interference_score",
        "color": "Election_colour",
        "confidence": "Election_confidence",
        "opacity": "Election_opacity",
        "label": "Election interference",
    },
}

ACTOR_ORIGINS = {
    "Russia": (37.6173, 55.7558),
    "USA": (-77.0369, 38.9072),
    "China": (116.4074, 39.9042),
}


def ensure_dirs() -> None:
    PUBLIC_DATA.mkdir(parents=True, exist_ok=True)
    PROCESSED.mkdir(parents=True, exist_ok=True)


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    return str(value).strip()


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def number(value: Any, default: float = 0) -> float:
    text = clean_text(value)
    if not text:
        return default
    try:
        return float(text)
    except ValueError:
        match = re.search(r"-?\d+(?:\.\d+)?", text)
        return float(match.group(0)) if match else default


def excel_date(value: Any) -> str:
    if value is None or clean_text(value) == "":
        return ""
    if isinstance(value, pd.Timestamp):
        return value.date().isoformat()
    parsed = number(value, -1)
    if parsed > 20000:
        try:
            return pd.to_datetime(parsed, unit="D", origin="1899-12-30").date().isoformat()
        except Exception:
            return clean_text(value)
    return clean_text(value)


def confidence_to_opacity(confidence: str, fallback: float = 0.35) -> float:
    text = confidence.lower()
    if "high" in text:
        return 1.0
    if "medium" in text:
        return 0.75
    if "low" in text:
        return 0.45
    if "review" in text or "unverified" in text or "pilot" in text:
        return 0.25
    return fallback


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def frame_to_records(df: pd.DataFrame) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for row in df.where(pd.notnull(df), None).to_dict(orient="records"):
        cleaned: dict[str, Any] = {}
        for key, value in row.items():
            if isinstance(value, pd.Timestamp):
                cleaned[str(key)] = value.date().isoformat()
            elif isinstance(value, (datetime, date)):
                cleaned[str(key)] = value.isoformat()
            elif isinstance(value, float) and math.isnan(value):
                cleaned[str(key)] = None
            else:
                cleaned[str(key)] = value
        if any(clean_text(value) for value in cleaned.values()):
            records.append(cleaned)
    return records


def load_workbook() -> dict[str, list[dict[str, Any]]]:
    if not INPUT.exists():
        raise FileNotFoundError(f"Missing workbook: {INPUT}")
    excel = pd.ExcelFile(INPUT)
    extracted: dict[str, list[dict[str, Any]]] = {}
    for sheet in EXTRACT_SHEETS:
        df = pd.read_excel(excel, sheet_name=sheet)
        extracted[slug(sheet)] = frame_to_records(df)
    return extracted


def normalize_map_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for row in rows:
        country = clean_text(row.get("Country"))
        iso3 = clean_text(row.get("ISO3")).upper()
        if not country or not iso3:
            continue
        metrics: dict[str, Any] = {}
        for key, config in METRICS.items():
            confidence = clean_text(row.get(config["confidence"]))
            opacity_field = config["opacity"]
            explicit_opacity = number(row.get(opacity_field), -1) if opacity_field else -1
            metrics[key] = {
                "score": number(row.get(config["score"])),
                "color": clean_text(row.get(config["color"])) or "#334155",
                "confidence": confidence,
                "opacity": explicit_opacity if explicit_opacity >= 0 else confidence_to_opacity(confidence),
                "label": config["label"],
            }
        notes = clean_text(row.get("Notes"))
        layer_status = clean_text(row.get("Layer_status"))
        data_status = "Demo" if "pilot" in notes.lower() or "caution" in layer_status.lower() else "Verified"
        normalized.append(
            {
                "actor": "Russia",
                "actor_slug": "russia",
                "country": country,
                "iso3": iso3,
                "region": clean_text(row.get("Region")),
                "latitude": number(row.get("Latitude")),
                "longitude": number(row.get("Longitude")),
                "layer_status": layer_status,
                "last_updated": excel_date(row.get("Last_updated")),
                "notes": notes,
                "publication_status": layer_status,
                "data_status": data_status,
                "demo_warning": "Pilot/demo score row. Do not present as verified intelligence." if data_status == "Demo" else "",
                "metrics": metrics,
                "composite_score": metrics["composite"]["score"],
                "map_color": metrics["composite"]["color"],
                "map_opacity": metrics["composite"]["opacity"],
                "confidence": metrics["composite"]["confidence"],
            }
        )
    return normalized


def metric(score: Any, color: Any, confidence: Any, opacity: Any, label: str) -> dict[str, Any]:
    confidence_text = clean_text(confidence)
    explicit_opacity = number(opacity, -1)
    return {
        "score": number(score),
        "color": clean_text(color) or "#334155",
        "confidence": confidence_text,
        "opacity": explicit_opacity if explicit_opacity >= 0 else confidence_to_opacity(confidence_text),
        "label": label,
    }


def normalize_actor_scores(actor: str, path: Path, sheet: str, mapping: dict[str, str]) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    df = pd.read_excel(path, sheet_name=sheet)
    rows = frame_to_records(df)
    output: list[dict[str, Any]] = []
    for row in rows:
        country = clean_text(row.get("Country"))
        iso3 = clean_text(row.get("ISO3")).upper()
        if not country or not iso3:
            continue
        confidence = clean_text(row.get(mapping["confidence_band"]))
        map_color = clean_text(row.get(mapping["map_color"])) or "#334155"
        map_opacity = number(row.get(mapping["map_opacity"]), confidence_to_opacity(confidence))
        metrics = {
            "composite": metric(row.get(mapping["composite"]), map_color, confidence, map_opacity, "Composite risk"),
            "influence": metric(row.get(mapping["influence"]), map_color, confidence, map_opacity, f"{actor} influence / leverage"),
            "security": metric(row.get(mapping["security"]), map_color, confidence, map_opacity, "Security / contractor presence"),
            "propaganda": metric(row.get(mapping["propaganda"]), map_color, confidence, map_opacity, "Propaganda ecosystems"),
            "election": metric(row.get(mapping["election"]), map_color, confidence, map_opacity, "Election / political interference"),
        }
        output.append(
            {
                "actor": actor,
                "actor_slug": slug(actor),
                "country": country,
                "iso3": iso3,
                "region": clean_text(row.get("Region")),
                "latitude": number(row.get("Latitude")),
                "longitude": number(row.get("Longitude")),
                "layer_status": clean_text(row.get(mapping.get("publication_status", ""))) or "Ready",
                "last_updated": "",
                "notes": clean_text(row.get(mapping.get("notes", ""))),
                "publication_status": clean_text(row.get(mapping.get("publication_status", ""))) or "Ready",
                "data_status": "Verified",
                "demo_warning": "",
                "metrics": metrics,
                "composite_score": metrics["composite"]["score"],
                "map_color": map_color,
                "map_opacity": map_opacity,
                "confidence": confidence,
            }
        )
    return output


def load_actor_rows() -> list[dict[str, Any]]:
    usa = normalize_actor_scores(
        "USA",
        USA_INPUT,
        "USA_Country_Scores",
        {
            "influence": "U.S. influence / leverage",
            "security": "PMC / contractor presence",
            "propaganda": "U.S.-backed information ecosystem",
            "election": "Election / political-transition interference",
            "composite": "Composite_Score",
            "confidence_band": "Confidence_Band",
            "map_color": "Map_Color",
            "map_opacity": "Opacity",
            "publication_status": "Publication_Status",
            "notes": "Primary_Evidence_Notes",
        },
    )
    china = normalize_actor_scores(
        "China",
        CHINA_INPUT,
        "China_Country_Scores",
        {
            "influence": "China influence / leverage (0-5)",
            "security": "Chinese PSC / PMC presence (0-5)",
            "propaganda": "Propaganda ecosystem (0-5)",
            "election": "Election / political interference (0-5)",
            "composite": "Composite score",
            "confidence_band": "Confidence band",
            "map_color": "Map color",
            "map_opacity": "Map opacity",
            "publication_status": "",
            "notes": "Analyst note",
        },
    )
    return usa + china


def ensure_world_geojson() -> None:
    if not WORLD_SOURCE.exists():
        with urllib.request.urlopen(WORLD_URL, timeout=60) as response:
            WORLD_SOURCE.write_bytes(response.read())
    if not COUNTRIES.exists():
        COUNTRIES.write_bytes(WORLD_SOURCE.read_bytes())


def iso_from_feature(feature: dict[str, Any]) -> str:
    props = feature.get("properties", {})
    name_overrides = {"France": "FRA"}
    name = clean_text(props.get("name"))
    if name in name_overrides:
        return name_overrides[name]
    for key in ("ISO3166-1-Alpha-3", "ADM0_A3", "ISO_A3", "iso3", "ISO3"):
        value = clean_text(props.get(key)).upper()
        if value and value != "-99":
            return value
    return ""


def join_boundaries(map_rows: list[dict[str, Any]]) -> dict[str, Any]:
    ensure_world_geojson()
    world = json.loads(COUNTRIES.read_text(encoding="utf-8"))
    by_iso: dict[str, dict[str, Any]] = {}
    for row in map_rows:
        current = by_iso.get(row["iso3"])
        if not current or row["composite_score"] > current["composite_score"]:
            by_iso[row["iso3"]] = row
    joined_features = []
    for feature in world.get("features", []):
        iso3 = iso_from_feature(feature)
        row = by_iso.get(iso3)
        props = dict(feature.get("properties", {}))
        props["iso3"] = iso3
        props["country"] = props.get("name") or (row or {}).get("country", "")
        props["has_map_data"] = bool(row)
        if row:
            props.update(row)
        joined_features.append({"type": "Feature", "geometry": feature.get("geometry"), "properties": props})
    return {"type": "FeatureCollection", "name": "joined_authoritarian_expansion_countries", "features": joined_features}


def curve_points(start: tuple[float, float], end: tuple[float, float], steps: int = 48) -> list[list[float]]:
    sx, sy = start
    ex, ey = end
    mx = (sx + ex) / 2
    my = (sy + ey) / 2
    lift = min(28, max(8, abs(ex - sx) * 0.12 + abs(ey - sy) * 0.18))
    control = (mx, my + lift)
    points: list[list[float]] = []
    for index in range(steps + 1):
        t = index / steps
        lon = (1 - t) ** 2 * sx + 2 * (1 - t) * t * control[0] + t**2 * ex
        lat = (1 - t) ** 2 * sy + 2 * (1 - t) * t * control[1] + t**2 * ey
        points.append([lat, lon])
    return points


def build_demo_flows(map_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    flows = []
    for row in map_rows:
        if row["composite_score"] <= 0:
            continue
        origin = ACTOR_ORIGINS.get(row["actor"], (0, 0))
        flows.append(
            {
                "id": f"demo-flow-{row['actor_slug']}-{row['iso3'].lower()}",
                "actor": row["actor"],
                "from": f"{row['actor']} influence origin",
                "to": row["country"],
                "iso3": row["iso3"],
                "score": row["composite_score"],
                "color": row["map_color"],
                "opacity": max(0.18, row["map_opacity"]),
                "coordinates": curve_points(origin, (row["longitude"], row["latitude"])),
                "data_status": "Demo",
                "warning": "Generated visual flow from pilot workbook rows; not verified intelligence.",
            }
        )
    return flows


def build_demo_markers(map_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    marker_specs = [
        ("security", "security", "Security/contractor indicator"),
        ("channel", "propaganda", "Information channel indicator"),
        ("digital", "election", "Digital/election indicator"),
    ]
    actor_lane_offsets = {"Russia": 0.82, "USA": 0.0, "China": -0.82}
    markers = []
    for row in map_rows:
        active_specs = [(kind, metric, label) for kind, metric, label in marker_specs if row["metrics"][metric]["score"] > 0]
        if not active_specs:
            continue
        row_latitude = row["latitude"] + actor_lane_offsets.get(row["actor"], 0)
        spacing = 1.08
        start_offset = -((len(active_specs) - 1) * spacing) / 2
        for index, (kind, metric, label) in enumerate(active_specs):
            score = row["metrics"][metric]["score"]
            markers.append(
                {
                    "id": f"demo-{kind}-{row['actor_slug']}-{row['iso3'].lower()}",
                    "actor": row["actor"],
                    "kind": kind,
                    "label": label,
                    "country": row["country"],
                    "iso3": row["iso3"],
                    "score": score,
                    "latitude": row_latitude,
                    "longitude": row["longitude"] + start_offset + index * spacing,
                    "color": row["metrics"][metric]["color"],
                    "data_status": "Demo",
                    "warning": "Generated icon from workbook score fields; arranged in a visual row and not verified intelligence.",
                }
            )
    return markers


def main() -> int:
    ensure_dirs()
    extracted = load_workbook()
    for name, rows in extracted.items():
        write_json(PUBLIC_DATA / f"{name}.json", rows)
        write_json(PROCESSED / f"{name}.json", rows)

    map_rows = normalize_map_rows(extracted["map_data"]) + load_actor_rows()
    joined = join_boundaries(map_rows)
    flows = build_demo_flows(map_rows)
    markers = build_demo_markers(map_rows)

    outputs = {
        "normalized_map_data.json": map_rows,
        "joined_countries.geojson": joined,
        "flows.json": flows,
        "markers.json": markers,
    }
    for filename, payload in outputs.items():
        write_json(PUBLIC_DATA / filename, payload)
        write_json(PROCESSED / filename, payload)

    summary = {
        "map_rows": len(map_rows),
        "actors": sorted({row["actor"] for row in map_rows}),
        "joined_features": len(joined["features"]),
        "demo_flows": len(flows),
        "demo_markers": len(markers),
        "source_workbook": str(INPUT.relative_to(ROOT)),
        "demo_notice": "Pilot/demo rows and generated flows/markers are not verified intelligence.",
    }
    write_json(PUBLIC_DATA / "build_summary.json", summary)
    write_json(PROCESSED / "build_summary.json", summary)
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
