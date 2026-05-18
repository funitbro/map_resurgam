from __future__ import annotations

import json
from collections import defaultdict
from typing import Any

from pipeline_utils import MAP_LAYERS_DIR, PROCESSED_DIR, PUBLIC_DATA_DIR, read_json, write_json


def load_world_features() -> list[dict[str, Any]]:
    for path in (PUBLIC_DATA_DIR / "countries.geojson", PROCESSED_DIR / "countries.geojson"):
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
            return data.get("features", [])
    return []


def iso_from_feature(feature: dict[str, Any]) -> str:
    props = feature.get("properties", {})
    for key in ("iso3", "ISO3", "ADM0_A3", "ISO_A3", "iso_a3"):
        value = props.get(key)
        if isinstance(value, str) and value and value != "-99":
            return value.upper()
    return ""


def country_from_feature(feature: dict[str, Any]) -> str:
    props = feature.get("properties", {})
    for key in ("country", "name", "NAME", "ADMIN", "admin"):
        value = props.get(key)
        if isinstance(value, str) and value:
            return value
    return ""


def score_properties(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "country": row.get("country", ""),
        "iso3": row.get("iso3", ""),
        "region": row.get("region", ""),
        "actor": row.get("actor", ""),
        "composite_score": row.get("composite_score"),
        "influence_score": row.get("influence_score"),
        "pmc_psc_score": row.get("pmc_psc_score"),
        "propaganda_score": row.get("propaganda_score"),
        "election_interference_score": row.get("election_interference_score"),
        "confidence_score": row.get("confidence_score"),
        "confidence_band": row.get("confidence_band"),
        "map_color": row.get("map_color", ""),
        "map_opacity": row.get("map_opacity"),
        "latitude": row.get("latitude"),
        "longitude": row.get("longitude"),
        "short_rationale": row.get("short_rationale", ""),
        "caveats": row.get("caveats", ""),
        "last_updated": row.get("last_updated", ""),
    }


def feature_collection(features: list[dict[str, Any]], name: str) -> dict[str, Any]:
    return {"type": "FeatureCollection", "name": name, "features": features}


def point_feature(row: dict[str, Any]) -> dict[str, Any]:
    latitude = row.get("latitude")
    longitude = row.get("longitude")
    geometry = None
    if isinstance(latitude, (int, float)) and isinstance(longitude, (int, float)):
        geometry = {"type": "Point", "coordinates": [longitude, latitude]}
    return {"type": "Feature", "geometry": geometry, "properties": score_properties(row)}


def actor_features(actor: str, rows: list[dict[str, Any]], world_features: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_iso = {row.get("iso3", "").upper(): row for row in rows if row.get("actor") == actor and row.get("iso3")}
    if not world_features:
        return [point_feature(row) for row in by_iso.values()]
    features: list[dict[str, Any]] = []
    for base in world_features:
        iso3 = iso_from_feature(base)
        row = by_iso.get(iso3)
        props = dict(base.get("properties", {}))
        props["country"] = country_from_feature(base) or (row or {}).get("country", "")
        props["iso3"] = iso3
        props["actor"] = actor
        props["has_data"] = bool(row)
        if row:
            props.update(score_properties(row))
        feature = {"type": "Feature", "geometry": base.get("geometry"), "properties": props}
        features.append(feature)
    return features


def comparison_features(rows: list[dict[str, Any]], world_features: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_iso: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        if row.get("iso3"):
            by_iso[row["iso3"].upper()].append(row)

    comparison_props: dict[str, dict[str, Any]] = {}
    for iso3, entries in by_iso.items():
        ordered = sorted(entries, key=lambda item: item.get("composite_score", 0), reverse=True)
        scores = {entry["actor"].lower(): entry.get("composite_score") for entry in entries}
        highest = ordered[0] if ordered else {}
        second = ordered[1] if len(ordered) > 1 else {}
        dimensions = ["influence_score", "pmc_psc_score", "propaganda_score", "election_interference_score"]
        dominant = max(dimensions, key=lambda metric: highest.get(metric, 0)) if highest else ""
        comparison_props[iso3] = {
            "country": highest.get("country", ""),
            "iso3": iso3,
            "russia_composite": scores.get("russia"),
            "usa_composite": scores.get("usa"),
            "china_composite": scores.get("china"),
            "highest_actor": highest.get("actor", ""),
            "score_difference": round(highest.get("composite_score", 0) - second.get("composite_score", 0), 2) if second else 0,
            "dominant_dimension": dominant,
            "has_data": True,
        }

    if not world_features:
        return [{"type": "Feature", "geometry": None, "properties": props} for props in comparison_props.values()]

    features: list[dict[str, Any]] = []
    for base in world_features:
        iso3 = iso_from_feature(base)
        props = dict(base.get("properties", {}))
        props["country"] = country_from_feature(base)
        props["iso3"] = iso3
        props.update(comparison_props.get(iso3, {"has_data": False}))
        features.append({"type": "Feature", "geometry": base.get("geometry"), "properties": props})
    return features


def main() -> int:
    scores = read_json(PROCESSED_DIR / "scores.json", read_json(PUBLIC_DATA_DIR / "scores.json", []))
    world_features = load_world_features()
    for actor in ("Russia", "USA", "China"):
        write_json(MAP_LAYERS_DIR / f"{actor.lower()}.geojson", feature_collection(actor_features(actor, scores, world_features), actor.lower()))
    write_json(MAP_LAYERS_DIR / "comparison.geojson", feature_collection(comparison_features(scores, world_features), "comparison"))
    print("GeoJSON layers exported.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
