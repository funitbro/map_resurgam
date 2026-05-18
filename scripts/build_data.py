from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

try:
    import pandas as pd
except ImportError as exc:  # pragma: no cover - environment guard
    raise SystemExit("Missing dependency: pandas. Run `pip install -r requirements.txt`.") from exc

from pipeline_utils import (
    ACTOR_WORKBOOKS,
    EVIDENCE_SHEETS,
    INPUT_DIR,
    PUBLIC_DATA_DIR,
    SCORE_SHEETS,
    SOURCE_SHEETS,
    clean_text,
    confidence_band,
    ensure_dirs,
    find_column,
    first_present,
    float_or_none,
    normalize_confidence,
    score_or_none,
    category_from_text,
    source_urls,
    write_json,
    PROCESSED_DIR,
)


def select_sheet(excel: pd.ExcelFile, candidates: list[str]) -> str | None:
    keyed = {name.strip().lower(): name for name in excel.sheet_names}
    for candidate in candidates:
        hit = keyed.get(candidate.strip().lower())
        if hit:
            return hit
    for candidate in candidates:
        needle = candidate.strip().lower()
        for name in excel.sheet_names:
            if needle in name.strip().lower():
                return name
    return None


def read_sheet(excel: pd.ExcelFile, candidates: list[str]) -> pd.DataFrame:
    sheet = select_sheet(excel, candidates)
    if not sheet:
        return pd.DataFrame()
    df = pd.read_excel(excel, sheet_name=sheet)
    df = df.dropna(how="all")
    df.columns = [clean_text(col) for col in df.columns]
    return df


def metric_columns(columns: list[str]) -> dict[str, str | None]:
    return {
        "country": find_column(columns, ["Country", "Country / scope", "Country name"]),
        "iso3": find_column(columns, ["ISO3", "ISO", "iso3"]),
        "region": find_column(columns, ["Region"]),
        "latitude": find_column(columns, ["Latitude", "Lat"]),
        "longitude": find_column(columns, ["Longitude", "Lon", "Lng"]),
        "composite_score": find_column(columns, ["Composite score", "Composite", "Composite_Score"], ["composite"]),
        "influence_score": find_column(columns, ["Influence", "Influence / leverage", "Influence score"], ["influence"]),
        "pmc_psc_score": find_column(
            columns,
            ["PMC / PSC / contractor presence", "PMC/PSC", "PSC/PMC", "Private security", "Contractor presence"],
        ),
        "propaganda_score": find_column(
            columns,
            [
                "Propaganda ecosystem",
                "Propaganda ecosystem (0-5)",
                "Propaganda_ecosystems_0_5",
                "Propaganda",
                "Information ecosystem",
                "U.S.-backed information ecosystem",
            ],
            ["information", "ecosystem"],
        ),
        "election_interference_score": find_column(
            columns,
            ["Election interference", "Election / political interference", "Election / political-process interference"],
            ["election"],
        ),
        "confidence_score": find_column(columns, ["Confidence score", "Confidence"], ["confidence"]),
        "confidence_band": find_column(columns, ["Confidence band"]),
        "short_rationale": find_column(columns, ["Short rationale", "Analyst note", "Main rationale", "Tooltip"]),
        "caveats": find_column(columns, ["Caveats", "Notes / caveats", "Notes", "Notes / limitations"]),
        "last_updated": find_column(columns, ["Last updated", "Date", "Date / version"]),
    }


def choose_pmc_column(columns: list[str], existing: str | None) -> str | None:
    if existing:
        return existing
    for col in columns:
        key = col.lower()
        if any(token in key for token in ("pmc", "psc", "contractor", "security")) and "score" not in key:
            return col
    return None


def normalize_scores(actor: str, df: pd.DataFrame) -> list[dict[str, Any]]:
    if df.empty:
        return []
    columns = list(df.columns)
    cols = metric_columns(columns)
    cols["pmc_psc_score"] = choose_pmc_column(columns, cols["pmc_psc_score"])
    rows: list[dict[str, Any]] = []
    for _, raw in df.iterrows():
        row = raw.to_dict()
        country = clean_text(row.get(cols["country"])) if cols["country"] else ""
        if not country or country.lower() in {"global", "nan"}:
            continue
        scores = {
            "influence_score": score_or_none(row.get(cols["influence_score"])) if cols["influence_score"] else None,
            "pmc_psc_score": score_or_none(row.get(cols["pmc_psc_score"])) if cols["pmc_psc_score"] else None,
            "propaganda_score": score_or_none(row.get(cols["propaganda_score"])) if cols["propaganda_score"] else None,
            "election_interference_score": score_or_none(row.get(cols["election_interference_score"])) if cols["election_interference_score"] else None,
        }
        if any(value is None for value in scores.values()):
            continue
        composite = score_or_none(row.get(cols["composite_score"])) if cols["composite_score"] else None
        if composite is None:
            composite = round(sum(value for value in scores.values() if value is not None) / 4, 2)
        band_value = clean_text(row.get(cols["confidence_band"])) if cols["confidence_band"] else ""
        confidence = normalize_confidence(row.get(cols["confidence_score"]) if cols["confidence_score"] else None, band_value)
        map_opacity_raw = first_present(row, ["Map opacity", "Opacity"])
        rows.append(
            {
                "actor": actor,
                "country": country,
                "iso3": clean_text(row.get(cols["iso3"])).upper() if cols["iso3"] else "",
                "region": clean_text(row.get(cols["region"])) if cols["region"] else "",
                "latitude": float_or_none(row.get(cols["latitude"])) if cols["latitude"] else None,
                "longitude": float_or_none(row.get(cols["longitude"])) if cols["longitude"] else None,
                "composite_score": composite,
                **scores,
                "confidence_score": confidence,
                "confidence_band": confidence_band(confidence, band_value),
                "map_color": clean_text(first_present(row, ["Map color", "Map colour"])),
                "map_opacity": normalize_confidence(map_opacity_raw, "") if map_opacity_raw is not None else confidence,
                "short_rationale": clean_text(row.get(cols["short_rationale"])) if cols["short_rationale"] else "",
                "caveats": clean_text(row.get(cols["caveats"])) if cols["caveats"] else "",
                "last_updated": clean_text(row.get(cols["last_updated"])) if cols["last_updated"] else "",
            }
        )
    return rows


def normalize_evidence(actor: str, df: pd.DataFrame, iso_by_country: dict[tuple[str, str], str]) -> list[dict[str, Any]]:
    if df.empty:
        return []
    rows: list[dict[str, Any]] = []
    for _, raw in df.iterrows():
        row = raw.to_dict()
        country = clean_text(first_present(row, ["Country", "Country / scope", "Scope"]))
        claim = clean_text(first_present(row, ["Claim", "Evidence summary", "Summary", "Score implication"]))
        if not claim:
            continue
        factor = first_present(row, ["Category", "Factor", "Dimension"])
        urls = source_urls(first_present(row, ["URL(s)", "URLs", "Source URL", "Key source URLs"]))
        rows.append(
            {
                "actor": actor,
                "country": "" if country.lower() == "global" else country,
                "iso3": iso_by_country.get((actor, country.lower()), ""),
                "category": category_from_text(factor),
                "claim": claim,
                "source_name": clean_text(first_present(row, ["Source", "Source ID(s)", "Source name"])) or "Source",
                "source_url": urls[0] if urls else "",
                "source_type": clean_text(first_present(row, ["Source type", "Type"])),
                "reliability": clean_text(first_present(row, ["Reliability"])) or "Medium",
                "date_accessed": clean_text(first_present(row, ["Date accessed", "Date"])),
                "notes": clean_text(first_present(row, ["Notes", "Notes / limitations", "Limitations"])),
            }
        )
    return rows


def normalize_sources(actor: str, df: pd.DataFrame) -> list[dict[str, Any]]:
    if df.empty:
        return []
    rows: list[dict[str, Any]] = []
    for _, raw in df.iterrows():
        row = raw.to_dict()
        source_name = clean_text(first_present(row, ["Source", "Source name", "Title"]))
        if not source_name:
            continue
        rows.append(
            {
                "actor": actor,
                "source_name": source_name,
                "url": clean_text(first_present(row, ["URL", "Source URL", "Link"])),
                "publisher": clean_text(first_present(row, ["Organization", "Publisher"])),
                "source_type": clean_text(first_present(row, ["Source type", "Type"])),
                "reliability": clean_text(first_present(row, ["Reliability"])) or "Medium",
                "notes": clean_text(first_present(row, ["Notes", "Main use in scoring"])),
            }
        )
    return rows


def main() -> int:
    ensure_dirs()
    all_scores: list[dict[str, Any]] = []
    workbook_cache: dict[str, pd.ExcelFile] = {}

    for actor, filename in ACTOR_WORKBOOKS.items():
        path = INPUT_DIR / filename
        if not path.exists():
            print(f"Missing workbook: {path}", file=sys.stderr)
            continue
        excel = pd.ExcelFile(path)
        workbook_cache[actor] = excel
        all_scores.extend(normalize_scores(actor, read_sheet(excel, SCORE_SHEETS[actor])))

    iso_by_country = {(row["actor"], row["country"].lower()): row["iso3"] for row in all_scores}
    all_evidence: list[dict[str, Any]] = []
    all_sources: list[dict[str, Any]] = []

    for actor, excel in workbook_cache.items():
        all_evidence.extend(normalize_evidence(actor, read_sheet(excel, EVIDENCE_SHEETS[actor]), iso_by_country))
        all_sources.extend(normalize_sources(actor, read_sheet(excel, SOURCE_SHEETS[actor])))

    for name, payload in {
        "scores.json": all_scores,
        "evidence.json": all_evidence,
        "sources.json": all_sources,
    }.items():
        write_json(PROCESSED_DIR / name, payload)
        write_json(PUBLIC_DATA_DIR / name, payload)

    print(f"Wrote {len(all_scores)} scores, {len(all_evidence)} evidence rows, {len(all_sources)} sources.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
