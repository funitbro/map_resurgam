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
INPUT = ROOT / "data" / "input" / "resurgam_actor_influence_resurgamhub_countries_only_workbook.xlsx"
LEGACY_INPUT = ROOT / "data" / "input" / "interactive_influence_map_all_in_one_google_sheet.xlsx"
USA_INPUT = ROOT / "data" / "input" / "usa_authoritarian_influence_scores.xlsx"
CHINA_INPUT = ROOT / "data" / "input" / "china_authoritarian_influence_scores.xlsx"
PUBLIC_DATA = ROOT / "public" / "data"
PROCESSED = ROOT / "data" / "processed"
WORLD_SOURCE = PUBLIC_DATA / "world_countries_source.geojson"
COUNTRIES = PUBLIC_DATA / "countries.geojson"
JOINED = PUBLIC_DATA / "joined_countries.geojson"

WORLD_URL = "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson"
EXTRACT_SHEET_ALIASES = {
    "map_data": ["Map_Data"],
    "legend_config": ["Legend_Config", "Score_Color_Legend"],
    "dashboard": ["Dashboard"],
    "evidence_log": ["Evidence_Log"],
    "source_register": ["Source_Register"],
    "rules_weights": ["Rules_Weights", "Factor_Model"],
}

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

ACTOR_ALIASES = {
    "Russia": "Russia",
    "China": "China",
    "United States": "USA",
    "USA": "USA",
    "U.S.": "USA",
    "US": "USA",
}

ACTOR_MAP_COLUMNS = {
    "Russia": ("Russia_Influence_Score_0_10", "Russia_Color"),
    "China": ("China_Influence_Score_0_10", "China_Color"),
    "USA": ("American_Influence_Score_0_10", "American_Color"),
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


def optional_number(value: Any) -> float | None:
    text = clean_text(value)
    if not text or text.lower() in {"no data", "nan", "none", "not assessed", "blank"}:
        return None
    try:
        return float(text)
    except ValueError:
        match = re.search(r"-?\d+(?:\.\d+)?", text)
        return float(match.group(0)) if match else None


def score_0_10(value: Any) -> float:
    parsed = optional_number(value)
    if parsed is None:
        return 0
    return max(0, min(10, parsed))


def source_score_0_10(values: list[Any]) -> float | None:
    parsed = [optional_number(value) for value in values]
    numbers = [value for value in parsed if value is not None]
    if not numbers:
        return None
    return max(numbers)


def actor_name(value: Any) -> str:
    text = clean_text(value)
    return ACTOR_ALIASES.get(text, text)


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
        if LEGACY_INPUT.exists():
            raise FileNotFoundError(f"Missing new workbook: {INPUT}. The legacy workbook still exists at {LEGACY_INPUT}.")
        raise FileNotFoundError(f"Missing workbook: {INPUT}")
    excel = pd.ExcelFile(INPUT)
    extracted: dict[str, list[dict[str, Any]]] = {}
    for sheet in excel.sheet_names:
        df = pd.read_excel(excel, sheet_name=sheet)
        extracted[slug(sheet)] = frame_to_records(df)
    for canonical, candidates in EXTRACT_SHEET_ALIASES.items():
        for sheet in candidates:
            key = slug(sheet)
            if key in extracted:
                extracted[canonical] = extracted[key]
                break
        extracted.setdefault(canonical, [])
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


def normalize_hex(value: Any) -> str:
    text = clean_text(value)
    if not text:
        return ""
    match = re.search(r"#?[0-9a-fA-F]{6}", text)
    if not match:
        return ""
    hex_value = match.group(0)
    return hex_value if hex_value.startswith("#") else f"#{hex_value}"


def build_score_color_lookup(rows: list[dict[str, Any]]) -> dict[int | str, str]:
    fallback = {
        "blank": "#F8FAFC",
        0: "#E5E7EB",
        1: "#D1FAE5",
        2: "#A7F3D0",
        3: "#FEF3C7",
        4: "#FDE68A",
        5: "#FCD34D",
        6: "#FDBA74",
        7: "#FB923C",
        8: "#F97316",
        9: "#EF4444",
        10: "#B91C1C",
    }
    lookup: dict[int | str, str] = dict(fallback)
    for row in rows:
        values = [clean_text(value) for value in row.values()]
        color = next((normalize_hex(value) for value in values if normalize_hex(value)), "")
        if not color:
            continue
        if any("blank" in value.lower() or "no data" in value.lower() for value in values):
            lookup["blank"] = color
            continue
        for value in values:
            score = optional_number(value)
            if score is not None and 0 <= score <= 10 and float(score).is_integer():
                lookup[int(score)] = color
                break
    return lookup


def color_for_0_10(score: float | None, color_lookup: dict[int | str, str]) -> str:
    if score is None:
        return color_lookup.get("blank", "#F8FAFC")
    bucket = int(math.floor(max(0, min(10, score))))
    return color_lookup.get(bucket, color_lookup.get("blank", "#F8FAFC"))


def confidence_label(value: Any, status: str = "") -> str:
    parsed = optional_number(value)
    if parsed is not None:
        if parsed >= 4:
            return "High"
        if parsed >= 2.5:
            return "Medium"
        if parsed > 0:
            return "Low"
    status_text = status.lower()
    if "verified" in status_text:
        return "Medium"
    if "candidate" in status_text or "review" in status_text:
        return "Needs review"
    return "Not assessed"


def confidence_opacity_from_0_5(value: Any, status: str = "") -> float:
    parsed = optional_number(value)
    if parsed is not None:
        return max(0.18, min(1.0, parsed / 5))
    return confidence_to_opacity(confidence_label(value, status), 0.18)


def average_optional(values: list[Any]) -> float | None:
    numbers = [optional_number(value) for value in values]
    present = [value for value in numbers if value is not None]
    if not present:
        return None
    return sum(present) / len(present)


def hub_metric(score10: float | None, confidence: Any, status: str, color_lookup: dict[int | str, str], label: str) -> dict[str, Any]:
    return {
        "score": score_0_10(score10),
        "source_score_0_10": score10,
        "color": color_for_0_10(score10, color_lookup),
        "confidence": confidence_label(confidence, status),
        "opacity": confidence_opacity_from_0_5(confidence, status),
        "label": label,
    }


def normalize_resurgamhub_scores(extracted: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    scoring_rows = extracted.get("scoring_matrix", [])
    map_rows = extracted.get("map_data", [])
    color_lookup = build_score_color_lookup(extracted.get("score_color_legend", []) or extracted.get("legend_config", []))
    map_by_iso = {clean_text(row.get("ISO3")).upper(): row for row in map_rows}
    normalized: list[dict[str, Any]] = []
    for row in scoring_rows:
        actor = actor_name(row.get("Actor"))
        if actor not in {"Russia", "USA", "China"}:
            continue
        country = clean_text(row.get("Country_Name"))
        iso3 = clean_text(row.get("ISO3")).upper()
        if not country or not iso3:
            continue
        status = clean_text(row.get("Evidence_Status")) or clean_text(map_by_iso.get(iso3, {}).get("Evidence_Status")) or "No scored evidence"
        map_row = map_by_iso.get(iso3, {})
        actor_score_column, actor_color_column = ACTOR_MAP_COLUMNS[actor]
        composite_10 = optional_number(row.get("Actor_Influence_Score_0_10")) or optional_number(map_row.get(actor_score_column))
        propaganda_10 = optional_number(row.get("Propaganda_Ecosystems_Score_0_10"))
        pmc_10 = optional_number(row.get("PMC_Presence_Score_0_10"))
        election_10 = optional_number(row.get("Election_Interference_Score_0_10"))
        contractors_10 = optional_number(row.get("Security_Contractors_Score_0_10"))
        security_10 = source_score_0_10([pmc_10, contractors_10])
        if composite_10 is None:
            composite_10 = average_optional([propaganda_10, security_10, election_10])
        composite_confidence = average_optional(
            [
                row.get("Propaganda_Ecosystems_Confidence_0_5"),
                row.get("PMC_Presence_Confidence_0_5"),
                row.get("Election_Interference_Confidence_0_5"),
                row.get("Security_Contractors_Confidence_0_5"),
            ]
        )
        metrics = {
            "composite": hub_metric(composite_10, composite_confidence, status, color_lookup, "Composite risk"),
            "influence": hub_metric(composite_10, composite_confidence, status, color_lookup, f"{actor} influence / leverage"),
            "security": hub_metric(
                security_10,
                average_optional([row.get("PMC_Presence_Confidence_0_5"), row.get("Security_Contractors_Confidence_0_5")]),
                status,
                color_lookup,
                "Security / contractor presence",
            ),
            "propaganda": hub_metric(propaganda_10, row.get("Propaganda_Ecosystems_Confidence_0_5"), status, color_lookup, "Propaganda ecosystems"),
            "election": hub_metric(election_10, row.get("Election_Interference_Confidence_0_5"), status, color_lookup, "Election / political interference"),
        }
        map_color = metrics["composite"]["color"] or normalize_hex(map_row.get(actor_color_column))
        has_numeric_score = any(metric_data.get("source_score_0_10") is not None for metric_data in metrics.values())
        status_text = status.lower()
        if has_numeric_score and "verified" in status_text:
            data_status = "Verified"
            warning = ""
        elif has_numeric_score:
            data_status = "Needs review"
            warning = "Workbook score is source-complete screening data and should be verified before final analytical use."
        else:
            data_status = "Unscored"
            warning = "No source-backed score is present in the workbook for this actor/country row."
        normalized.append(
            {
                "actor": actor,
                "actor_slug": slug(actor),
                "country": country,
                "iso3": iso3,
                "region": clean_text(row.get("UN_Region")) or clean_text(map_row.get("UN_Region")),
                "latitude": number(row.get("Latitude"), number(map_row.get("Latitude"))),
                "longitude": number(row.get("Longitude"), number(map_row.get("Longitude"))),
                "layer_status": status,
                "last_updated": excel_date(row.get("Last_Reviewed")),
                "notes": clean_text(row.get("Analyst_Notes")) or clean_text(map_row.get("Map_Source_Note")),
                "publication_status": status,
                "data_status": data_status,
                "demo_warning": warning,
                "metrics": metrics,
                "composite_score": metrics["composite"]["score"],
                "source_composite_score_0_10": composite_10,
                "map_color": map_color,
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
            "influence": "China influence / leverage (0-10)",
            "security": "Chinese PSC / PMC presence (0-10)",
            "propaganda": "Propaganda ecosystem (0-10)",
            "election": "Election / political interference (0-10)",
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
    name_overrides = {"France": "FRA", "Norway": "NOR"}
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
                "warning": "Generated visual flow from workbook score fields; not verified intelligence.",
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


def normalize_evidence_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for index, row in enumerate(rows, start=1):
        actor = actor_name(row.get("Actor"))
        country = clean_text(row.get("Country") or row.get("Country_Name"))
        iso3 = clean_text(row.get("ISO3")).upper()
        subfactor = clean_text(row.get("Subfactor") or row.get("Factor"))
        status = clean_text(row.get("Verification_Status") or row.get("Evidence_Status")) or "Not assessed"
        title = clean_text(row.get("Evidence_Title") or row.get("Indicator")) or f"{subfactor or 'Influence'} assessment"
        normalized.append(
            {
                "actor": actor,
                "Evidence_ID": clean_text(row.get("Evidence_ID") or row.get("Evidence_Key")) or f"EV-{index:04d}",
                "Country": country,
                "ISO3": iso3,
                "Region": clean_text(row.get("Region") or row.get("UN_Region")),
                "Factor": subfactor or clean_text(row.get("Main_Factor")) or "General",
                "Indicator": title,
                "Indicator_Score_0_10": score_0_10(row.get("Evidence_Score_0_10") or row.get("Indicator_Score_0_5")),
                "Indicator_Score_0_5": score_0_10(row.get("Evidence_Score_0_10") or row.get("Indicator_Score_0_5")),
                "Source_Tier": clean_text(row.get("Source_Tier") or row.get("Source_Type")) or status,
                "Source_Name": title,
                "Source_URL": clean_text(row.get("Source_URL") or row.get("Evidence_URL")),
                "Source_Domain": clean_text(row.get("Source_Domain")),
                "Analyst_Notes": clean_text(row.get("Analyst_Notes") or row.get("Notes")),
                "Evidence_Status": status,
                "Event_Date": row.get("Event_Date") or row.get("Date_Observed"),
                "Retrieved_Date": row.get("Retrieved_Date") or row.get("Date_Added"),
            }
        )
    return normalized


def normalize_source_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for index, row in enumerate(rows, start=1):
        normalized.append(
            {
                "actor": actor_name(row.get("Actor")),
                "Source_ID": clean_text(row.get("Source_ID")) or f"SRC-{index:03d}",
                "Source_Name": clean_text(row.get("Source_Name")) or clean_text(row.get("source_name")),
                "Default_Tier": clean_text(row.get("Default_Tier") or row.get("Source_Type")) or "Reference",
                "Reliability_Weight": number(row.get("Reliability_Weight"), 0),
                "URL": clean_text(row.get("URL") or row.get("url")),
                "Useful_For_Factor": clean_text(row.get("Useful_For_Factor") or row.get("Subfactor")),
                "Notes": clean_text(row.get("Notes") or row.get("notes")),
                "Last_Checked": excel_date(row.get("Last_Checked")),
            }
        )
    return normalized


def compatibility_scores(map_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "actor": row["actor"],
            "country": row["country"],
            "iso3": row["iso3"],
            "region": row.get("region", ""),
            "composite_score": row["metrics"]["composite"]["score"],
            "influence_score": row["metrics"]["influence"]["score"],
            "pmc_psc_score": row["metrics"]["security"]["score"],
            "propaganda_score": row["metrics"]["propaganda"]["score"],
            "election_interference_score": row["metrics"]["election"]["score"],
            "confidence_score": row.get("map_opacity", 0),
            "confidence_band": row.get("confidence", ""),
            "map_color": row.get("map_color", ""),
            "map_opacity": row.get("map_opacity", 0),
            "short_rationale": row.get("notes", ""),
            "caveats": row.get("demo_warning", ""),
            "last_updated": row.get("last_updated", ""),
        }
        for row in map_rows
    ]


def compatibility_evidence(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "actor": row.get("actor"),
            "country": row.get("Country", ""),
            "iso3": row.get("ISO3", ""),
            "category": row.get("Factor", "General"),
            "claim": row.get("Indicator", ""),
            "source_name": row.get("Source_Name", ""),
            "source_url": row.get("Source_URL", ""),
            "source_type": row.get("Source_Tier", ""),
            "reliability": row.get("Evidence_Status", ""),
            "date_accessed": excel_date(row.get("Retrieved_Date")),
            "notes": row.get("Analyst_Notes", ""),
        }
        for row in rows
    ]


def compatibility_sources(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "actor": row.get("actor"),
            "source_name": row.get("Source_Name", ""),
            "url": row.get("URL", ""),
            "publisher": "",
            "source_type": row.get("Default_Tier", ""),
            "reliability": row.get("Default_Tier", ""),
            "notes": row.get("Notes", ""),
        }
        for row in rows
    ]


def row_point_feature(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [row.get("longitude", 0), row.get("latitude", 0)]},
        "properties": {key: value for key, value in row.items() if key not in {"latitude", "longitude", "metrics"}},
    }


def write_map_layers(map_rows: list[dict[str, Any]]) -> None:
    layer_dir_public = PUBLIC_DATA / "map_layers"
    layer_dir_processed = PROCESSED / "map_layers"
    for directory in (layer_dir_public, layer_dir_processed):
        directory.mkdir(parents=True, exist_ok=True)
    layer_specs = {
        "russia.geojson": [row for row in map_rows if row["actor"] == "Russia"],
        "usa.geojson": [row for row in map_rows if row["actor"] == "USA"],
        "china.geojson": [row for row in map_rows if row["actor"] == "China"],
        "comparison.geojson": map_rows,
    }
    for filename, rows in layer_specs.items():
        payload = {"type": "FeatureCollection", "features": [row_point_feature(row) for row in rows]}
        write_json(layer_dir_public / filename, payload)
        write_json(layer_dir_processed / filename, payload)


def main() -> int:
    ensure_dirs()
    extracted = load_workbook()
    for name, rows in extracted.items():
        write_json(PUBLIC_DATA / f"{name}.json", rows)
        write_json(PROCESSED / f"{name}.json", rows)

    if extracted.get("scoring_matrix"):
        map_rows = normalize_resurgamhub_scores(extracted)
    else:
        map_rows = normalize_map_rows(extracted["map_data"]) + load_actor_rows()
    evidence_rows = normalize_evidence_rows(extracted.get("evidence_log", []))
    source_rows = normalize_source_rows(extracted.get("source_register", []))
    joined = join_boundaries(map_rows)
    flows = build_demo_flows(map_rows)
    markers = build_demo_markers(map_rows)

    outputs = {
        "evidence_log.json": evidence_rows,
        "source_register.json": source_rows,
        "scores.json": compatibility_scores(map_rows),
        "evidence.json": compatibility_evidence(evidence_rows),
        "sources.json": compatibility_sources(source_rows),
        "normalized_map_data.json": map_rows,
        "joined_countries.geojson": joined,
        "flows.json": flows,
        "markers.json": markers,
    }
    for filename, payload in outputs.items():
        write_json(PUBLIC_DATA / filename, payload)
        write_json(PROCESSED / filename, payload)
    write_map_layers(map_rows)

    summary = {
        "map_rows": len(map_rows),
        "actors": sorted({row["actor"] for row in map_rows}),
        "joined_features": len(joined["features"]),
        "demo_flows": len(flows),
        "demo_markers": len(markers),
        "source_workbook": str(INPUT.relative_to(ROOT)),
        "demo_notice": "Unscored rows and generated flows/markers are not verified intelligence.",
    }
    write_json(PUBLIC_DATA / "build_summary.json", summary)
    write_json(PROCESSED / "build_summary.json", summary)
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
