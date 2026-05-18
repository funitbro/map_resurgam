from __future__ import annotations

import sys
from collections import Counter

from pipeline_utils import METRICS, PROCESSED_DIR, PUBLIC_DATA_DIR, read_json, write_json


def main() -> int:
    scores = read_json(PROCESSED_DIR / "scores.json", read_json(PUBLIC_DATA_DIR / "scores.json", []))
    evidence = read_json(PROCESSED_DIR / "evidence.json", read_json(PUBLIC_DATA_DIR / "evidence.json", []))
    severe: list[str] = []
    warnings: list[str] = []

    seen = Counter((row.get("actor"), row.get("country")) for row in scores)
    for (actor, country), count in seen.items():
        if count > 1:
            severe.append(f"Duplicate score rows for {actor} + {country}.")

    for index, row in enumerate(scores, start=1):
        label = f"{row.get('actor', '?')} / {row.get('country', f'row {index}')}"
        if not row.get("country"):
            severe.append(f"{label}: missing country.")
        if not row.get("iso3"):
            warnings.append(f"{label}: missing ISO3.")
        for metric in METRICS:
            value = row.get(metric)
            if not isinstance(value, (int, float)) or value < 0 or value > 5:
                severe.append(f"{label}: {metric} must be between 0 and 5.")
        confidence = row.get("confidence_score")
        if not isinstance(confidence, (int, float)) or confidence < 0 or confidence > 1:
            severe.append(f"{label}: confidence_score must be normalized to 0-1.")
        dimensions = [
            row.get("influence_score"),
            row.get("pmc_psc_score"),
            row.get("propaganda_score"),
            row.get("election_interference_score"),
        ]
        if all(isinstance(value, (int, float)) for value in dimensions):
            computed = round(sum(dimensions) / 4, 2)
            provided = round(float(row.get("composite_score", 0)), 2)
            if abs(computed - provided) > 0.15:
                warnings.append(f"{label}: composite {provided} differs from dimension average {computed}.")

    score_keys = {(row.get("actor"), row.get("country")) for row in scores}
    for row in evidence:
        country = row.get("country")
        if country and (row.get("actor"), country) not in score_keys:
            warnings.append(f"Evidence row for {row.get('actor')} / {country} has no matching score row.")
        if row.get("reliability") not in {"High", "Medium", "Low", ""}:
            warnings.append(f"Evidence reliability should be High, Medium, or Low: {row.get('reliability')}")

    report = {
        "severe_count": len(severe),
        "warning_count": len(warnings),
        "severe": severe,
        "warnings": warnings,
    }
    write_json(PROCESSED_DIR / "validation_report.json", report)
    write_json(PUBLIC_DATA_DIR / "validation_report.json", report)

    print(f"Validation complete: {len(severe)} severe, {len(warnings)} warnings.")
    if severe:
        for issue in severe[:20]:
            print(f"ERROR: {issue}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

