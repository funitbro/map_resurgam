from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DATA = ROOT / "public" / "data"
PROCESSED = ROOT / "data" / "processed"
METRIC_KEYS = ["composite", "influence", "security", "propaganda", "election"]


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    rows = read_json(PUBLIC_DATA / "normalized_map_data.json")
    joined = read_json(PUBLIC_DATA / "joined_countries.geojson")
    flows = read_json(PUBLIC_DATA / "flows.json")
    markers = read_json(PUBLIC_DATA / "markers.json")
    severe: list[str] = []
    warnings: list[str] = []

    seen: set[tuple[str, str, str]] = set()
    joined_iso = {feature.get("properties", {}).get("iso3") for feature in joined.get("features", [])}

    for row in rows:
        label = f"{row.get('country', '?')} / {row.get('iso3', '?')}"
        if not row.get("country"):
            severe.append(f"{label}: missing country.")
        if not row.get("iso3"):
            severe.append(f"{label}: missing ISO3.")
        key = (row.get("actor", ""), row.get("country", ""), row.get("iso3", ""))
        if key in seen:
            severe.append(f"{label}: duplicate country/ISO3 row.")
        seen.add(key)
        if row.get("iso3") not in joined_iso:
            warnings.append(f"{label}: ISO3 did not join to the world boundary file.")
        if row.get("data_status") == "Demo" and not row.get("demo_warning"):
            severe.append(f"{label}: demo data must carry a warning.")
        for metric in METRIC_KEYS:
            metric_data = row.get("metrics", {}).get(metric, {})
            score = metric_data.get("score")
            opacity = metric_data.get("opacity")
            color = metric_data.get("color")
            if not isinstance(score, (int, float)) or score < 0 or score > 10:
                severe.append(f"{label}: {metric} score must be 0-10.")
            if not isinstance(opacity, (int, float)) or opacity < 0 or opacity > 1:
                severe.append(f"{label}: {metric} opacity must be 0-1.")
            if not isinstance(color, str) or not color.startswith("#"):
                warnings.append(f"{label}: {metric} color should be a workbook hex value.")

    for flow in flows:
        if flow.get("data_status") != "Demo":
            severe.append(f"{flow.get('id')}: generated flow must be marked Demo.")
    for marker in markers:
        if marker.get("data_status") != "Demo":
            severe.append(f"{marker.get('id')}: generated marker must be marked Demo.")

    report = {"severe_count": len(severe), "warning_count": len(warnings), "severe": severe, "warnings": warnings}
    write_json(PUBLIC_DATA / "validation_report.json", report)
    write_json(PROCESSED / "validation_report.json", report)
    print(f"Validation complete: {len(severe)} severe, {len(warnings)} warnings.")
    return 1 if severe else 0


if __name__ == "__main__":
    raise SystemExit(main())
