from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
INPUT_DIR = ROOT / "data" / "input"
PROCESSED_DIR = ROOT / "data" / "processed"
PUBLIC_DATA_DIR = ROOT / "public" / "data"
MAP_LAYERS_DIR = PUBLIC_DATA_DIR / "map_layers"

ACTOR_WORKBOOKS = {
    "Russia": "resurgam_authoritarian_influence_scores.xlsx",
    "USA": "usa_authoritarian_influence_scores.xlsx",
    "China": "china_authoritarian_influence_scores.xlsx",
}

SCORE_SHEETS = {
    "Russia": ["Resurgam_Country_Scores", "Country_Scores", "Map_Data_Resurgam", "Map_Data"],
    "USA": ["USA_Country_Scores", "USA_Map_Data", "Country_Scores", "Map_Data"],
    "China": ["China_Country_Scores", "China_Map_Data", "Country_Scores", "Map_Data"],
}

EVIDENCE_SHEETS = {
    "Russia": ["Evidence_Log_Resurgam", "Evidence_Log"],
    "USA": ["USA_Evidence_Log", "Evidence_Log"],
    "China": ["China_Evidence_Log", "Evidence_Log"],
}

SOURCE_SHEETS = {
    "Russia": ["Source_Register_R", "Source_Register"],
    "USA": ["USA_Source_Register", "Source_Register"],
    "China": ["China_Source_Register", "Source_Register"],
}

GEOJSON_SHEETS = {
    "Russia": ["GeoJSON_Resurgam", "GeoJSON_Export"],
    "USA": ["USA_GeoJSON_Export", "GeoJSON_Export"],
    "China": ["China_GeoJSON_Export", "GeoJSON_Export"],
}

METRICS = [
    "composite_score",
    "influence_score",
    "pmc_psc_score",
    "propaganda_score",
    "election_interference_score",
]


def ensure_dirs() -> None:
    for path in (PROCESSED_DIR, PUBLIC_DATA_DIR, MAP_LAYERS_DIR):
        path.mkdir(parents=True, exist_ok=True)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def clean_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(value).strip().lower()).strip("_")


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    try:
        if isinstance(value, float) and math.isnan(value):
            return ""
    except TypeError:
        pass
    return str(value).strip()


def first_present(row: dict[str, Any], names: Iterable[str]) -> Any:
    normalized = {clean_key(k): v for k, v in row.items()}
    for name in names:
        key = clean_key(name)
        if key in normalized and clean_text(normalized[key]) != "":
            return normalized[key]
    return None


def find_column(columns: Iterable[str], aliases: Iterable[str], contains_all: Iterable[str] = ()) -> str | None:
    column_list = list(columns)
    by_key = {clean_key(col): col for col in column_list}
    for alias in aliases:
        key = clean_key(alias)
        if key in by_key:
            return by_key[key]
    required = [clean_key(part) for part in contains_all if part]
    if required:
        for col in column_list:
            key = clean_key(col)
            if all(part in key for part in required):
                return col
    return None


def number(value: Any, default: float | None = None) -> float | None:
    text = clean_text(value)
    if not text:
        return default
    text = text.replace("%", "").replace(",", ".")
    try:
        return float(text)
    except ValueError:
        match = re.search(r"-?\d+(?:\.\d+)?", text)
        return float(match.group(0)) if match else default


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def score_or_none(value: Any) -> float | None:
    parsed = number(value)
    if parsed is None:
        return None
    if parsed > 5 and parsed <= 100:
        parsed = parsed / 20
    return round(clamp(parsed, 0, 5), 2)


def float_or_none(value: Any) -> float | None:
    return number(value)


def normalize_confidence(value: Any, band: str = "") -> float:
    parsed = number(value)
    if parsed is None:
        band_key = band.lower()
        if "high" in band_key:
            return 0.85
        if "medium" in band_key:
            return 0.65
        if "low" in band_key:
            return 0.4
        return 0.5
    if parsed > 1 and parsed <= 5:
        parsed = parsed / 5
    elif parsed > 5 and parsed <= 100:
        parsed = parsed / 100
    return round(clamp(parsed, 0, 1), 2)


def confidence_band(score: float, provided: str = "") -> str:
    text = provided.strip().title()
    if text in {"High", "Medium", "Low"}:
        return text
    if score >= 0.75:
        return "High"
    if score >= 0.45:
        return "Medium"
    return "Low"


def category_from_text(value: Any) -> str:
    text = clean_text(value).lower()
    if "pmc" in text or "psc" in text or "contractor" in text or "security" in text:
        return "PMC/PSC"
    if "propaganda" in text or "media" in text or "information" in text:
        return "Propaganda"
    if "election" in text or "political" in text or "interference" in text:
        return "Election interference"
    if "confidence" in text:
        return "Confidence"
    if "influence" in text or "leverage" in text:
        return "Influence"
    return "General"


def source_urls(value: Any) -> list[str]:
    text = clean_text(value)
    if not text:
        return []
    return [part.strip() for part in re.split(r"[\n;]+", text) if part.strip().startswith(("http://", "https://"))]
