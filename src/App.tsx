import { useEffect, useMemo, useState } from "react";
import { MapView } from "./components/MapView";
import {
  metricOptions,
  countryMetric,
  formatScore,
  riskLabel,
  riskScoreBucket,
  riskScoreKeys,
  riskScoreOptions,
  selectedMetric,
  topCountries
} from "./data/scoring";
import type { RiskScoreBucket } from "./data/scoring";
import type { Actor, EvidenceRow, MapCountry, MetricKey, SourceRow } from "./data/types";
import { useDashboardData } from "./hooks/useDashboardData";

const actorOptions: Actor[] = ["Russia", "USA", "China"];
const metricKeys = metricOptions.map((option) => option.key);
type RankedSortKey = "selected" | "country" | "actor" | "confidence" | MetricKey;
type SortDirection = "asc" | "desc";
type TimelineBounds = { minYear: number; maxYear: number };
type CountrySearchResult = {
  key: string;
  country: string;
  iso3: string;
  region: string;
  bestRow: MapCountry;
  actorCount: number;
  visibleActorCount: number;
};

function rowKey(country: MapCountry) {
  return `${country.actor}:${country.iso3}`;
}

function parseTimelineYear(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return undefined;
    if (value >= 25000 && value <= 80000) {
      const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
      const year = date.getUTCFullYear();
      return year >= 1900 && year <= 2200 ? year : undefined;
    }
    if (value >= 1900 && value <= 2200) return Math.round(value);
    return undefined;
  }
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;
  if (/^\d+(\.\d+)?$/.test(trimmed)) return parseTimelineYear(Number(trimmed));
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return undefined;
  const year = new Date(parsed).getUTCFullYear();
  return year >= 1900 && year <= 2200 ? year : undefined;
}

function newestYear(values: unknown[]) {
  const years = values.map(parseTimelineYear).filter((year): year is number => typeof year === "number");
  return years.length ? Math.max(...years) : undefined;
}

function rememberYear(lookup: Map<string, number>, key: string, year?: number) {
  if (!key || typeof year !== "number") return;
  lookup.set(key, Math.max(lookup.get(key) ?? year, year));
}

function buildEvidenceYearLookup(evidence: EvidenceRow[]) {
  const lookup = new Map<string, number>();
  evidence.forEach((row) => {
    const iso3 = String(row.ISO3 ?? "").trim();
    if (!iso3) return;
    const year = parseTimelineYear(row.Event_Date) ?? parseTimelineYear(row.Retrieved_Date);
    rememberYear(lookup, iso3, year);
    if (row.actor) rememberYear(lookup, `${row.actor}:${iso3}`, year);
  });
  return lookup;
}

function countryTimelineYear(country: MapCountry, evidenceYears: Map<string, number>) {
  return newestYear([country.last_updated, evidenceYears.get(rowKey(country)), evidenceYears.get(country.iso3)]);
}

function buildTimelineBounds(countries: MapCountry[], evidenceYears: Map<string, number>): TimelineBounds | undefined {
  const years = countries.map((country) => countryTimelineYear(country, evidenceYears)).filter((year): year is number => typeof year === "number");
  if (!years.length) return undefined;
  return { minYear: Math.min(...years), maxYear: Math.max(...years) };
}

function summarizeSelection(selectedCount: number, totalCount: number, allLabel: string, noneLabel: string, selectedLabel: string) {
  if (selectedCount === totalCount) return allLabel;
  if (selectedCount === 0) return noneLabel;
  return selectedCount === 1 ? selectedLabel : `${selectedCount} selected`;
}

function confidenceRank(confidence: string) {
  const normalized = confidence.toLowerCase();
  if (normalized.includes("high")) return 3;
  if (normalized.includes("medium")) return 2;
  if (normalized.includes("low")) return 1;
  return 0;
}

function isMetricSortKey(sortKey: RankedSortKey): sortKey is MetricKey {
  return metricKeys.includes(sortKey as MetricKey);
}

function TopFilters({
  metrics,
  setMetrics,
  scoreBuckets,
  setScoreBuckets,
  selectedRegions,
  setSelectedRegions,
  actors,
  setActors,
  regions
}: {
  metrics: MetricKey[];
  setMetrics: (metrics: MetricKey[]) => void;
  scoreBuckets: RiskScoreBucket[];
  setScoreBuckets: (scoreBuckets: RiskScoreBucket[]) => void;
  selectedRegions: string[];
  setSelectedRegions: (regions: string[]) => void;
  actors: Actor[];
  setActors: (actors: Actor[]) => void;
  regions: string[];
}) {
  const actorSummary = actors.length === actorOptions.length ? "All actors" : actors.length ? actors.join(", ") : "No actors";
  const metricLabels = metricOptions.filter((option) => metrics.includes(option.key)).map((option) => option.label);
  const metricSummary = summarizeSelection(metrics.length, metricOptions.length, "All risk layers", "No risk layers", metricLabels[0]);
  const scoreLabels = riskScoreOptions.filter((option) => scoreBuckets.includes(option.key)).map((option) => option.label);
  const scoreSummary = summarizeSelection(scoreBuckets.length, riskScoreOptions.length, "All scores", "No scores", scoreLabels[0]);
  const regionSummary = summarizeSelection(selectedRegions.length, regions.length, "All regions", "No regions", selectedRegions[0]);
  const toggleActor = (actor: Actor) => {
    setActors(actors.includes(actor) ? actors.filter((item) => item !== actor) : [...actors, actor]);
  };
  const toggleMetric = (metric: MetricKey) => {
    setMetrics(metrics.includes(metric) ? metrics.filter((item) => item !== metric) : metricKeys.filter((item) => item === metric || metrics.includes(item)));
  };
  const toggleScoreBucket = (scoreBucket: RiskScoreBucket) => {
    setScoreBuckets(
      scoreBuckets.includes(scoreBucket)
        ? scoreBuckets.filter((item) => item !== scoreBucket)
        : riskScoreKeys.filter((item) => item === scoreBucket || scoreBuckets.includes(item))
    );
  };
  const toggleRegion = (region: string) => {
    setSelectedRegions(selectedRegions.includes(region) ? selectedRegions.filter((item) => item !== region) : regions.filter((item) => item === region || selectedRegions.includes(item)));
  };

  return (
    <div className="top-filters">
      <details className="checkbox-menu">
        <summary>
          <span>Actor layers</span>
          <strong>{actorSummary}</strong>
        </summary>
        <div className="checkbox-menu-panel" role="group" aria-label="Actor layers">
          <div className="menu-bulk-actions">
            <label>
              <input type="checkbox" checked={actors.length === actorOptions.length} onChange={(event) => setActors(event.target.checked ? actorOptions : [])} />
              <span>Select everything</span>
            </label>
            <label>
              <input type="checkbox" checked={!actors.length} onChange={(event) => setActors(event.target.checked ? [] : actorOptions)} />
              <span>Unselect everything</span>
            </label>
          </div>
          {actorOptions.map((option) => (
            <label key={option}>
              <input type="checkbox" checked={actors.includes(option)} onChange={() => toggleActor(option)} />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </details>
      <details className="checkbox-menu">
        <summary>
          <span>Risk scores</span>
          <strong>{scoreSummary}</strong>
        </summary>
        <div className="checkbox-menu-panel" role="group" aria-label="Risk scores">
          <div className="menu-bulk-actions">
            <label>
              <input type="checkbox" checked={scoreBuckets.length === riskScoreKeys.length} onChange={(event) => setScoreBuckets(event.target.checked ? riskScoreKeys : [])} />
              <span>Select everything</span>
            </label>
            <label>
              <input type="checkbox" checked={!scoreBuckets.length} onChange={(event) => setScoreBuckets(event.target.checked ? [] : riskScoreKeys)} />
              <span>Unselect everything</span>
            </label>
          </div>
          {riskScoreOptions.map((option) => (
            <label key={option.key}>
              <input type="checkbox" checked={scoreBuckets.includes(option.key)} onChange={() => toggleScoreBucket(option.key)} />
              <span>{option.label}</span>
              <small>{option.range}</small>
            </label>
          ))}
        </div>
      </details>
      <details className="checkbox-menu">
        <summary>
          <span>Risk layers</span>
          <strong>{metricSummary}</strong>
        </summary>
        <div className="checkbox-menu-panel" role="group" aria-label="Risk layers">
          <div className="menu-bulk-actions">
            <label>
              <input type="checkbox" checked={metrics.length === metricKeys.length} onChange={(event) => setMetrics(event.target.checked ? metricKeys : [])} />
              <span>Select everything</span>
            </label>
            <label>
              <input type="checkbox" checked={!metrics.length} onChange={(event) => setMetrics(event.target.checked ? [] : metricKeys)} />
              <span>Unselect everything</span>
            </label>
          </div>
          {metricOptions.map((option) => (
            <label key={option.key}>
              <input type="checkbox" checked={metrics.includes(option.key)} onChange={() => toggleMetric(option.key)} />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </details>
      <details className="checkbox-menu">
        <summary>
          <span>Regions</span>
          <strong>{regionSummary}</strong>
        </summary>
        <div className="checkbox-menu-panel" role="group" aria-label="Regions">
          <div className="menu-bulk-actions">
            <label>
              <input type="checkbox" checked={selectedRegions.length === regions.length} onChange={(event) => setSelectedRegions(event.target.checked ? regions : [])} />
              <span>Select everything</span>
            </label>
            <label>
              <input type="checkbox" checked={!selectedRegions.length} onChange={(event) => setSelectedRegions(event.target.checked ? [] : regions)} />
              <span>Unselect everything</span>
            </label>
          </div>
          {regions.map((item) => (
            <label key={item}>
              <input type="checkbox" checked={selectedRegions.includes(item)} onChange={() => toggleRegion(item)} />
              <span>{item}</span>
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}

function LeftPanels({
  countries,
  allCountries,
  metrics,
  selected,
  searchQuery,
  setSearchQuery,
  onSelect,
  onQuickJump,
  onOpenMethodology,
  timelineBounds,
  timelineYear,
  setTimelineYear,
  includeUndated,
  setIncludeUndated,
  timelineDatedRows,
  timelineUndatedRows,
  timelineActiveRows
}: {
  countries: MapCountry[];
  allCountries: MapCountry[];
  metrics: MetricKey[];
  selected?: MapCountry;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  onSelect: (country: MapCountry) => void;
  onQuickJump: (country: MapCountry) => void;
  onOpenMethodology: () => void;
  timelineBounds?: TimelineBounds;
  timelineYear: number;
  setTimelineYear: (year: number) => void;
  includeUndated: boolean;
  setIncludeUndated: (value: boolean) => void;
  timelineDatedRows: number;
  timelineUndatedRows: number;
  timelineActiveRows: number;
}) {
  const leaders = topCountries(countries, metrics, 6);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleKeys = useMemo(() => new Set(countries.map(rowKey)), [countries]);
  const searchResults = useMemo<CountrySearchResult[]>(() => {
    if (!normalizedQuery) return [];
    const groups = new Map<string, MapCountry[]>();
    allCountries
      .filter((country) =>
        [country.country, country.iso3, country.actor, country.region].some((value) => value.toLowerCase().includes(normalizedQuery))
      )
      .forEach((country) => {
        const key = country.iso3 || country.country;
        groups.set(key, [...(groups.get(key) ?? []), country]);
      });

    return [...groups.values()]
      .map((rows) => {
        const visibleRows = rows.filter((row) => visibleKeys.has(rowKey(row)));
        const bestRow = topCountries(visibleRows.length ? visibleRows : rows, metrics, 1)[0] ?? rows[0];
        return {
          key: bestRow.iso3 || bestRow.country,
          country: bestRow.country,
          iso3: bestRow.iso3,
          region: bestRow.region,
          bestRow,
          actorCount: rows.length,
          visibleActorCount: visibleRows.length
        };
      })
      .sort((left, right) => {
        const visibility = right.visibleActorCount - left.visibleActorCount;
        if (visibility !== 0) return visibility;
        const score = selectedMetric(right.bestRow, metrics).score - selectedMetric(left.bestRow, metrics).score;
        if (score !== 0) return score;
        return left.country.localeCompare(right.country);
      })
      .slice(0, 8);
  }, [allCountries, metrics, normalizedQuery, visibleKeys]);
  return (
    <aside className="left-panels">
      <section className="panel brand-panel">
        <span>Intelligence dashboard</span>
        <h1>Global Authoritarian Expansion Map</h1>
        <p>Workbook-driven pilot visualization. Demo flows and icons are not verified intelligence.</p>
      </section>
      <section className="panel timeline-panel">
        <div className="timeline-heading">
          <div>
            <span>Evidence timeline</span>
            <h2>Data Through {timelineBounds ? timelineYear : "No Dates"}</h2>
          </div>
          <strong>{timelineActiveRows}</strong>
        </div>
        {timelineBounds ? (
          <>
            <input
              type="range"
              min={timelineBounds.minYear}
              max={timelineBounds.maxYear}
              value={timelineYear}
              disabled={timelineBounds.minYear === timelineBounds.maxYear}
              onChange={(event) => setTimelineYear(Number(event.target.value))}
              aria-label="Filter countries by evidence year"
            />
            <div className="timeline-scale">
              <span>{timelineBounds.minYear}</span>
              <span>{timelineBounds.maxYear}</span>
            </div>
            <label className="timeline-toggle">
              <input type="checkbox" checked={includeUndated} onChange={(event) => setIncludeUndated(event.target.checked)} />
              <span>Include no-date rows</span>
            </label>
            <p>
              {timelineDatedRows} dated rows / {timelineUndatedRows} without dates
            </p>
          </>
        ) : (
          <p>No workbook dates were found for the current data export.</p>
        )}
      </section>
      <section className="panel search-panel">
        <h2>Country Quick Jump</h2>
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search country, ISO3, actor"
          aria-label="Search countries"
          onKeyDown={(event) => {
            if (event.key === "Enter" && searchResults[0]) onQuickJump(searchResults[0].bestRow);
          }}
        />
        <p>{normalizedQuery ? `${searchResults.length} jump target${searchResults.length === 1 ? "" : "s"} found.` : "Search jumps to a country and reveals it if filters hide it."}</p>
      </section>
      <section className="panel">
        <h2>{normalizedQuery ? "Quick Jump Results" : "Priority Watchlist"}</h2>
        <div className="watchlist">
          {normalizedQuery &&
            searchResults.map((result) => {
              const datum = selectedMetric(result.bestRow, metrics);
              const selectedIso = selected?.iso3 === result.iso3;
              return (
                <button type="button" key={result.key} className={selectedIso ? "selected" : ""} onClick={() => onQuickJump(result.bestRow)}>
                  <span>
                    <b>{result.country}</b>
                    <small>
                      {result.iso3} / {result.region} / {result.visibleActorCount ? `${result.visibleActorCount} visible` : "reveal hidden"}
                    </small>
                  </span>
                  <strong>{result.actorCount} actor{result.actorCount === 1 ? "" : "s"}</strong>
                  <i style={{ background: datum.color }} />
                </button>
              );
            })}
          {!normalizedQuery &&
            leaders.map((country) => {
            const datum = selectedMetric(country, metrics);
            return (
              <button type="button" key={`${country.actor}-${country.iso3}`} className={selected?.actor === country.actor && selected?.iso3 === country.iso3 ? "selected" : ""} onClick={() => onSelect(country)}>
                <span>
                  <b>{country.actor} / {country.country}</b>
                  <small>{country.iso3} / {country.region}</small>
                </span>
                <strong>{formatScore(datum.score)}</strong>
                <i style={{ background: datum.color }} />
              </button>
            );
          })}
          {normalizedQuery && !searchResults.length && <p className="empty">No matching countries.</p>}
          {!normalizedQuery && !leaders.length && <p className="empty">No countries match the current filters.</p>}
        </div>
      </section>
      <section className="panel">
        <h2>Governance Flags</h2>
        <div className="flag-list">
          <span>Publication status is preserved from `Layer_status`.</span>
          <span>Confidence drives country opacity.</span>
          <span>Screenshot-style flows and signal icons are marked `Demo`.</span>
        </div>
        <button type="button" className="panel-action-button" onClick={onOpenMethodology}>
          Methodology / sources
        </button>
      </section>
    </aside>
  );
}

function FilterEmptyState({
  loaded,
  visibleCountries,
  totalCountries,
  actors,
  setActors,
  metrics,
  setMetrics,
  scoreBuckets,
  setScoreBuckets,
  selectedRegions,
  setSelectedRegions,
  regions,
  resetTimeline
}: {
  loaded: boolean;
  visibleCountries: MapCountry[];
  totalCountries: number;
  actors: Actor[];
  setActors: (actors: Actor[]) => void;
  metrics: MetricKey[];
  setMetrics: (metrics: MetricKey[]) => void;
  scoreBuckets: RiskScoreBucket[];
  setScoreBuckets: (scoreBuckets: RiskScoreBucket[]) => void;
  selectedRegions: string[];
  setSelectedRegions: (regions: string[]) => void;
  regions: string[];
  resetTimeline: () => void;
}) {
  if (!loaded) return null;
  const noActors = actors.length === 0;
  const noRegions = selectedRegions.length === 0;
  const noMetrics = metrics.length === 0;
  const noScoreBuckets = scoreBuckets.length === 0;
  const noCountries = visibleCountries.length === 0;
  if (noScoreBuckets && !noActors && !noRegions && !noMetrics) return null;
  if (!noActors && !noRegions && !noMetrics && !noCountries) return null;

  const title = noActors
    ? "No actor layers selected"
    : noRegions
      ? "No regions selected"
      : noCountries
        ? "No countries match current filters"
        : "No risk layers selected";
  const copy = noMetrics && !noCountries ? "Countries are visible, but map scores are neutral until a risk layer is selected." : `${visibleCountries.length} of ${totalCountries} country rows visible.`;

  return (
    <section className="empty-overlay" aria-live="polite">
      <span>Filter state</span>
      <h2>{title}</h2>
      <p>{copy}</p>
      <div>
        {noActors && (
          <button type="button" onClick={() => setActors(actorOptions)}>
            Restore actors
          </button>
        )}
        {noRegions && (
          <button type="button" onClick={() => setSelectedRegions(regions)}>
            Restore regions
          </button>
        )}
        {noMetrics && (
          <button type="button" onClick={() => setMetrics(metricKeys)}>
            Restore risk layers
          </button>
        )}
        {noCountries && !noActors && !noRegions && (
          <button
            type="button"
            onClick={() => {
              setActors(actorOptions);
              setScoreBuckets(riskScoreKeys);
              setSelectedRegions(regions);
              resetTimeline();
            }}
          >
            Reset map filters
          </button>
        )}
      </div>
    </section>
  );
}

function ActiveFilterChips({
  actors,
  setActors,
  metrics,
  setMetrics,
  scoreBuckets,
  setScoreBuckets,
  selectedRegions,
  setSelectedRegions,
  regions,
  compareMode,
  setCompareMode,
  timelineBounds,
  timelineYear,
  setTimelineYear,
  includeUndated,
  setIncludeUndated
}: {
  actors: Actor[];
  setActors: (actors: Actor[]) => void;
  metrics: MetricKey[];
  setMetrics: (metrics: MetricKey[]) => void;
  scoreBuckets: RiskScoreBucket[];
  setScoreBuckets: (scoreBuckets: RiskScoreBucket[]) => void;
  selectedRegions: string[];
  setSelectedRegions: (regions: string[]) => void;
  regions: string[];
  compareMode: boolean;
  setCompareMode: (value: boolean) => void;
  timelineBounds?: TimelineBounds;
  timelineYear: number;
  setTimelineYear: (year: number) => void;
  includeUndated: boolean;
  setIncludeUndated: (value: boolean) => void;
}) {
  const timelineFiltered = Boolean(timelineBounds && timelineYear < timelineBounds.maxYear);
  const undatedFiltered = timelineBounds ? !includeUndated : false;
  const hasCustomFilters =
    actors.length !== actorOptions.length ||
    metrics.length !== metricKeys.length ||
    scoreBuckets.length !== riskScoreKeys.length ||
    selectedRegions.length !== regions.length ||
    compareMode ||
    timelineFiltered ||
    undatedFiltered;

  const resetFilters = () => {
    setActors(actorOptions);
    setMetrics(metricKeys);
    setScoreBuckets(riskScoreKeys);
    setSelectedRegions(regions);
    setCompareMode(false);
    if (timelineBounds) setTimelineYear(timelineBounds.maxYear);
    setIncludeUndated(true);
  };

  return (
    <section className={`filter-chips ${hasCustomFilters ? "" : "quiet"}`} aria-label="Active filters">
      <span>Active filters</span>
      <div>
        {!hasCustomFilters && <em>All actor, score, risk, region, and timeline layers are visible.</em>}
        {!actors.length && (
          <button type="button" onClick={() => setActors(actorOptions)}>
            No actors <b>+</b>
          </button>
        )}
        {actors.length > 0 &&
          actors.length < actorOptions.length &&
          actors.map((actor) => (
            <button type="button" key={`actor-${actor}`} onClick={() => setActors(actors.filter((item) => item !== actor))}>
              Actor: {actor} <b>x</b>
            </button>
          ))}
        {!scoreBuckets.length && (
          <button type="button" onClick={() => setScoreBuckets(riskScoreKeys)}>
            No score ranges <b>+</b>
          </button>
        )}
        {scoreBuckets.length > 0 &&
          scoreBuckets.length < riskScoreKeys.length &&
          riskScoreOptions
            .filter((option) => scoreBuckets.includes(option.key))
            .map((option) => (
              <button type="button" key={`score-${option.key}`} onClick={() => setScoreBuckets(scoreBuckets.filter((item) => item !== option.key))}>
                Score: {option.range} <b>x</b>
              </button>
            ))}
        {!metrics.length && (
          <button type="button" onClick={() => setMetrics(metricKeys)}>
            No risk layers <b>+</b>
          </button>
        )}
        {metrics.length > 0 &&
          metrics.length < metricKeys.length &&
          metricOptions
            .filter((option) => metrics.includes(option.key))
            .map((option) => (
              <button type="button" key={`metric-${option.key}`} onClick={() => setMetrics(metrics.filter((item) => item !== option.key))}>
                Layer: {option.label} <b>x</b>
              </button>
            ))}
        {!selectedRegions.length && (
          <button type="button" onClick={() => setSelectedRegions(regions)}>
            No regions <b>+</b>
          </button>
        )}
        {selectedRegions.length > 0 &&
          selectedRegions.length < regions.length &&
          selectedRegions.map((region) => (
            <button type="button" key={`region-${region}`} onClick={() => setSelectedRegions(selectedRegions.filter((item) => item !== region))}>
              Region: {region} <b>x</b>
            </button>
          ))}
        {compareMode && (
          <button type="button" onClick={() => setCompareMode(false)}>
            Compare mode on <b>x</b>
          </button>
        )}
        {timelineFiltered && timelineBounds && (
          <button type="button" onClick={() => setTimelineYear(timelineBounds.maxYear)}>
            Through: {timelineYear} <b>x</b>
          </button>
        )}
        {undatedFiltered && (
          <button type="button" onClick={() => setIncludeUndated(true)}>
            No-date rows hidden <b>+</b>
          </button>
        )}
        {hasCustomFilters && (
          <button type="button" className="reset-chip" onClick={resetFilters}>
            Reset filters
          </button>
        )}
      </div>
    </section>
  );
}

function RankedTableDrawer({
  open,
  countries,
  metrics,
  selectedKey,
  onSelect,
  onClose
}: {
  open: boolean;
  countries: MapCountry[];
  metrics: MetricKey[];
  selectedKey: string;
  onSelect: (country: MapCountry) => void;
  onClose: () => void;
}) {
  const [sortKey, setSortKey] = useState<RankedSortKey>("selected");
  const [direction, setDirection] = useState<SortDirection>("desc");

  const sortedCountries = useMemo(() => {
    const valueFor = (country: MapCountry): number | string => {
      if (sortKey === "selected") return selectedMetric(country, metrics).score;
      if (sortKey === "country") return country.country;
      if (sortKey === "actor") return country.actor;
      if (sortKey === "confidence") return confidenceRank(country.confidence);
      if (isMetricSortKey(sortKey)) return countryMetric(country, sortKey).score;
      return selectedMetric(country, metrics).score;
    };
    return [...countries].sort((left, right) => {
      const leftValue = valueFor(left);
      const rightValue = valueFor(right);
      const result =
        typeof leftValue === "string" && typeof rightValue === "string"
          ? leftValue.localeCompare(rightValue)
          : Number(leftValue) - Number(rightValue);
      if (result === 0) return left.country.localeCompare(right.country);
      return direction === "asc" ? result : -result;
    });
  }, [countries, direction, metrics, sortKey]);

  const toggleSort = (nextKey: RankedSortKey) => {
    if (nextKey === sortKey) {
      setDirection(direction === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(nextKey);
    setDirection(nextKey === "country" || nextKey === "actor" ? "asc" : "desc");
  };

  const sortLabel = (key: RankedSortKey) => (sortKey === key ? (direction === "asc" ? " up" : " down") : "");

  if (!open) return null;

  return (
    <aside className="ranked-table-drawer" aria-label="Ranked country table">
      <header>
        <div>
          <span>Ranked table</span>
          <h2>{countries.length} visible country rows</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close ranked table">
          x
        </button>
      </header>
      <div className="ranked-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>
                <button type="button" onClick={() => toggleSort("country")}>
                  Country{sortLabel("country")}
                </button>
              </th>
              <th>
                <button type="button" onClick={() => toggleSort("actor")}>
                  Actor{sortLabel("actor")}
                </button>
              </th>
              <th>
                <button type="button" onClick={() => toggleSort("selected")}>
                  Selected{sortLabel("selected")}
                </button>
              </th>
              {metricOptions.map((option) => (
                <th key={option.key}>
                  <button type="button" onClick={() => toggleSort(option.key)}>
                    {option.label.replace(" / ", " ")}{sortLabel(option.key)}
                  </button>
                </th>
              ))}
              <th>
                <button type="button" onClick={() => toggleSort("confidence")}>
                  Confidence{sortLabel("confidence")}
                </button>
              </th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedCountries.map((country, index) => {
              const datum = selectedMetric(country, metrics);
              const key = `${country.actor}:${country.iso3}`;
              return (
                <tr key={key} className={selectedKey === key ? "selected" : ""}>
                  <td>{index + 1}</td>
                  <td>
                    <button type="button" onClick={() => onSelect(country)}>
                      {country.country}
                    </button>
                  </td>
                  <td>{country.actor}</td>
                  <td>
                    <strong>{formatScore(datum.score)}</strong>
                  </td>
                  {metricOptions.map((option) => (
                    <td key={option.key}>{formatScore(countryMetric(country, option.key).score)}</td>
                  ))}
                  <td>{country.confidence}</td>
                  <td>{country.data_status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!sortedCountries.length && <p className="empty">No country rows match the current filters.</p>}
      </div>
    </aside>
  );
}

function RiskLegend({ countries, metrics }: { countries: MapCountry[]; metrics: MetricKey[] }) {
  const buckets = [0, 1, 2, 3, 4, 5].map((score) => {
    const sample = countries.find((country) => Math.round(selectedMetric(country, metrics).score) === score);
    return {
      score,
      label: riskLabel(score),
      color: sample ? selectedMetric(sample, metrics).color : ["#F2F2F2", "#D9F0D3", "#ADDD8E", "#FDAE6B", "#F16913", "#A63603"][score]
    };
  });
  return (
    <aside className="right-legend">
      <section className="panel compact-legend">
        <header>
          <h2>Risk / Confidence</h2>
          <span>Score color + opacity</span>
        </header>
        <div className="risk-scale" aria-label="Risk score legend">
          {buckets.map((bucket) => (
            <div className="risk-scale-item" key={bucket.score} title={`${bucket.score}: ${bucket.label}`}>
              <i style={{ background: bucket.color }} />
              <strong>{bucket.score}</strong>
              <span>{bucket.label}</span>
            </div>
          ))}
        </div>
        <div className="confidence-scale" aria-label="Confidence opacity legend">
          {[
            ["High", 1],
            ["Med", 0.75],
            ["Low", 0.45],
            ["Review", 0.25]
          ].map(([label, opacity]) => (
            <div className="confidence-pill" key={label}>
              <i style={{ opacity: Number(opacity) }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>Signal Marker Legend</h2>
        <div className="signal-legend">
          <div>
            <i className="signal-icon security" />
            <strong>Security</strong>
            <span>PSC / PMC / contractor signal</span>
          </div>
          <div>
            <i className="signal-icon channel" />
            <strong>Channel</strong>
            <span>Propaganda or information ecosystem signal</span>
          </div>
          <div>
            <i className="signal-icon digital" />
            <strong>Digital</strong>
            <span>Election, cyber, or political-process signal</span>
          </div>
        </div>
        <p className="legend-note">Icons are generated demo aids from workbook score fields, not verified intelligence points.</p>
      </section>
    </aside>
  );
}

function AnalyticsCards({ countries, metrics, demoFlows, demoMarkers }: { countries: MapCountry[]; metrics: MetricKey[]; demoFlows: number; demoMarkers: number }) {
  const average = countries.length ? countries.reduce((sum, country) => sum + selectedMetric(country, metrics).score, 0) / countries.length : 0;
  const highRisk = countries.filter((country) => selectedMetric(country, metrics).score >= 3).length;
  const demoRows = countries.filter((country) => country.data_status === "Demo").length;
  return (
    <div className="analytics-cards">
      <article>
        <span>Countries loaded</span>
        <strong>{countries.length}</strong>
      </article>
      <article>
        <span>Average selected risk</span>
        <strong>{formatScore(average)}</strong>
      </article>
      <article>
        <span>High / severe rows</span>
        <strong>{highRisk}</strong>
      </article>
      <article>
        <span>Demo governance</span>
        <strong>{demoRows + demoFlows + demoMarkers}</strong>
      </article>
    </div>
  );
}

function EvidenceList({ evidence }: { evidence: EvidenceRow[] }) {
  if (!evidence.length) return <p className="empty">No evidence rows for this country.</p>;
  return (
    <div className="evidence-stack">
      {evidence.map((row) => (
        <article key={row.Evidence_ID}>
          <strong>{row.Factor}</strong>
          <span>{row.Indicator}</span>
          <small>
            {row.Source_Tier} / {row.Evidence_Status}
          </small>
          <p>{row.Analyst_Notes}</p>
        </article>
      ))}
    </div>
  );
}

function uniqueValues(rows: EvidenceRow[], key: keyof EvidenceRow) {
  return Array.from(new Set(rows.map((row) => String(row[key] ?? "").trim()).filter(Boolean))).sort();
}

function SourceFilters({
  evidence,
  tier,
  setTier,
  status,
  setStatus,
  factor,
  setFactor,
  query,
  setQuery
}: {
  evidence: EvidenceRow[];
  tier: string;
  setTier: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  factor: string;
  setFactor: (value: string) => void;
  query: string;
  setQuery: (value: string) => void;
}) {
  const tiers = uniqueValues(evidence, "Source_Tier");
  const statuses = uniqueValues(evidence, "Evidence_Status");
  const factors = uniqueValues(evidence, "Factor");
  return (
    <div className="source-filters">
      <label>
        <span>Source tier</span>
        <select value={tier} onChange={(event) => setTier(event.target.value)}>
          <option value="All">All tiers</option>
          {tiers.map((item) => (
            <option value={item} key={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Status</span>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="All">All statuses</option>
          {statuses.map((item) => (
            <option value={item} key={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Factor</span>
        <select value={factor} onChange={(event) => setFactor(event.target.value)}>
          <option value="All">All factors</option>
          {factors.map((item) => (
            <option value={item} key={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label className="source-search">
        <span>Search</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Source, note, indicator" aria-label="Search evidence sources" />
      </label>
    </div>
  );
}

function CountryDrawer({
  country,
  comparisonRows,
  metrics,
  evidence,
  sources,
  onClose
}: {
  country?: MapCountry;
  comparisonRows: MapCountry[];
  metrics: MetricKey[];
  evidence: EvidenceRow[];
  sources: SourceRow[];
  onClose: () => void;
}) {
  const [tierFilter, setTierFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [factorFilter, setFactorFilter] = useState("All");
  const [sourceQuery, setSourceQuery] = useState("");
  useEffect(() => {
    setTierFilter("All");
    setStatusFilter("All");
    setFactorFilter("All");
    setSourceQuery("");
  }, [country?.actor, country?.iso3]);
  if (!country) return null;
  const selected = selectedMetric(country, metrics);
  const visibleMetricOptions = metricOptions.filter((option) => metrics.includes(option.key));
  const normalizedSourceQuery = sourceQuery.trim().toLowerCase();
  const filteredEvidence = evidence.filter((row) => {
    const matchesTier = tierFilter === "All" || row.Source_Tier === tierFilter;
    const matchesStatus = statusFilter === "All" || row.Evidence_Status === statusFilter;
    const matchesFactor = factorFilter === "All" || row.Factor === factorFilter;
    const matchesQuery =
      !normalizedSourceQuery ||
      [row.Source_Name, row.Source_URL, row.Source_Domain, row.Indicator, row.Analyst_Notes, row.Factor].some((value) =>
        String(value ?? "").toLowerCase().includes(normalizedSourceQuery)
      );
    return matchesTier && matchesStatus && matchesFactor && matchesQuery;
  });
  const hasActiveSourceFilter = tierFilter !== "All" || statusFilter !== "All" || factorFilter !== "All" || normalizedSourceQuery.length > 0;
  const filteredSourceNames = new Set(filteredEvidence.map((row) => row.Source_Name).filter(Boolean));
  const filteredSources =
    filteredEvidence.length === 0 && hasActiveSourceFilter
      ? []
      : filteredSourceNames.size > 0
        ? sources.filter((source) => filteredSourceNames.has(source.Source_Name) || filteredEvidence.some((row) => source.Useful_For_Factor?.includes(row.Factor)))
        : sources;
  return (
    <aside className="country-drawer">
      <header>
        <div>
          <span>{country.iso3}</span>
          <h2>{country.country}</h2>
          <p>{country.actor} / {country.region}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close country profile">
          x
        </button>
      </header>
      <div className="drawer-score">
        <strong>{formatScore(selected.score)}</strong>
        <span>{selected.label}</span>
        <em>{riskLabel(selected.score)}</em>
      </div>
      <div className="metric-grid">
        {visibleMetricOptions.map((option) => {
          const datum = countryMetric(country, option.key);
          return (
            <div key={option.key}>
              <span>{option.label}</span>
              <strong>{formatScore(datum.score)}</strong>
              <i style={{ width: `${(datum.score / 5) * 100}%`, background: datum.color, opacity: datum.opacity }} />
              <small>{datum.confidence}</small>
            </div>
          );
        })}
        {!visibleMetricOptions.length && <p className="empty">No risk layers selected.</p>}
      </div>
      {country.data_status === "Demo" && <p className="demo-warning">{country.demo_warning}</p>}
      <section>
        <h3>Actor Comparison</h3>
        <div className="compare-cards">
          {actorOptions.map((actor) => {
            const row = comparisonRows.find((item) => item.actor === actor);
            if (!row) {
              return (
                <article className="compare-card muted" key={actor}>
                  <span>{actor}</span>
                  <strong>No data</strong>
                </article>
              );
            }
            const datum = selectedMetric(row, metrics);
            return (
              <article className="compare-card" key={actor}>
                <span>{actor}</span>
                <strong>{formatScore(datum.score)}</strong>
                <i style={{ width: `${(datum.score / 5) * 100}%`, background: datum.color, opacity: datum.opacity }} />
                <small>{datum.label}</small>
              </article>
            );
          })}
        </div>
        <div className="compare-matrix">
          {metricOptions.map((option) => (
            <div className="compare-chart-row" key={option.key}>
              <span>{option.label}</span>
              <div>
                {actorOptions.map((actor) => {
                  const row = comparisonRows.find((item) => item.actor === actor);
                  const datum = row ? countryMetric(row, option.key) : undefined;
                  return (
                    <article key={actor}>
                      <small>{actor}</small>
                      <i>
                        <b style={datum ? { width: `${(datum.score / 5) * 100}%`, background: datum.color, opacity: datum.opacity } : undefined} />
                      </i>
                      <strong>{datum ? formatScore(datum.score) : "-"}</strong>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3>Evidence</h3>
        <SourceFilters
          evidence={evidence}
          tier={tierFilter}
          setTier={setTierFilter}
          status={statusFilter}
          setStatus={setStatusFilter}
          factor={factorFilter}
          setFactor={setFactorFilter}
          query={sourceQuery}
          setQuery={setSourceQuery}
        />
        <p className="filter-count">
          Showing {filteredEvidence.length} of {evidence.length} evidence rows
        </p>
        <EvidenceList evidence={filteredEvidence} />
      </section>
      <section>
        <h3>Source governance</h3>
        <div className="source-stack">
          {filteredSources.slice(0, 6).map((source) => (
            <a href={source.URL || undefined} target="_blank" rel="noreferrer" key={source.Source_ID}>
              <strong>{source.Source_Name}</strong>
              <span>{source.Default_Tier}</span>
            </a>
          ))}
          {!filteredSources.length && <p className="empty">No sources match the current evidence filters.</p>}
        </div>
      </section>
    </aside>
  );
}

function MethodologyModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="methodology-title">
      <section className="methodology-modal">
        <header>
          <div>
            <span>Workbook methodology</span>
            <h2 id="methodology-title">Methodology and Source Governance</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close methodology">
            x
          </button>
        </header>
        <div className="methodology-grid">
          <article>
            <h3>Data basis</h3>
            <p>
              The dashboard extracts `Map_Data`, `Legend_Config`, `Dashboard`, `Evidence_Log`, `Source_Register`, and
              `Rules_Weights` from the workbook pipeline. Country records preserve ISO3 IDs and join to world boundaries by ISO3.
            </p>
          </article>
          <article>
            <h3>Scoring</h3>
            <p>
              Scores use a 0-5 scale. Selected risk layers are averaged for the active map score, while workbook colors,
              confidence labels, opacity, publication status, and notes remain the source of truth.
            </p>
          </article>
          <article>
            <h3>Confidence</h3>
            <p>
              Opacity reflects confidence and review status. High-confidence rows render more strongly; low-confidence,
              review, or pilot rows are intentionally more faint.
            </p>
          </article>
          <article>
            <h3>Evidence and sources</h3>
            <p>
              `Evidence_Log` links indicators to country, actor, factor, source tier, status, and analyst notes.
              `Source_Register` stores source names, reliability weights, URLs, and factor coverage.
            </p>
          </article>
          <article>
            <h3>Demo governance</h3>
            <p>
              Generated flow lines and signal icons are visualization aids derived from score fields and are marked `Demo`.
              Demo or pilot material must not be presented as verified intelligence or definitive attribution.
            </p>
          </article>
          <article>
            <h3>Publication limits</h3>
            <p>
              This is an analytical visualization based on structured scoring and open-source evidence tracking. It is not a
              legal finding, sanctions designation, or definitive intelligence assessment.
            </p>
          </article>
        </div>
        <div className="source-governance-strip">
          <span>Refresh path</span>
          <p>Add source-backed evidence, update source reliability, revise weights, regenerate data, then review publication status before release.</p>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const { data, loading, error } = useDashboardData();
  const [metrics, setMetrics] = useState<MetricKey[]>(metricKeys);
  const [scoreBuckets, setScoreBuckets] = useState<RiskScoreBucket[]>(riskScoreKeys);
  const [actors, setActors] = useState<Actor[]>(actorOptions);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const [rankedTableOpen, setRankedTableOpen] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [timelineYear, setTimelineYear] = useState<number | undefined>();
  const [includeUndated, setIncludeUndated] = useState(true);

  const regions = useMemo(() => Array.from(new Set(data.countries.map((country) => country.region).filter(Boolean))).sort(), [data.countries]);
  const evidenceYears = useMemo(() => buildEvidenceYearLookup(data.evidence), [data.evidence]);
  const timelineBounds = useMemo(() => buildTimelineBounds(data.countries, evidenceYears), [data.countries, evidenceYears]);
  const activeTimelineYear = timelineYear ?? timelineBounds?.maxYear ?? new Date().getFullYear();

  useEffect(() => {
    setSelectedRegions((current) => {
      if (!regions.length) return [];
      if (!current.length) return regions;
      const validRegions = current.filter((region) => regions.includes(region));
      return validRegions.length ? validRegions : regions;
    });
  }, [regions]);
  useEffect(() => {
    if (!timelineBounds) return;
    setTimelineYear((current) => {
      if (current === undefined) return timelineBounds.maxYear;
      return Math.min(Math.max(current, timelineBounds.minYear), timelineBounds.maxYear);
    });
  }, [timelineBounds]);

  const timelineStats = useMemo(() => {
    let datedRows = 0;
    let undatedRows = 0;
    let activeRows = 0;
    data.countries.forEach((country) => {
      const year = countryTimelineYear(country, evidenceYears);
      if (year) {
        datedRows += 1;
        if (year <= activeTimelineYear) activeRows += 1;
      } else {
        undatedRows += 1;
        if (includeUndated) activeRows += 1;
      }
    });
    return { datedRows, undatedRows, activeRows };
  }, [activeTimelineYear, data.countries, evidenceYears, includeUndated]);

  const visibleCountries = useMemo(
    () =>
      data.countries.filter(
        (country) => {
          const year = countryTimelineYear(country, evidenceYears);
          const matchesTimeline = !timelineBounds || (year ? year <= activeTimelineYear : includeUndated);
          return (
            actors.includes(country.actor) &&
            selectedRegions.includes(country.region) &&
            scoreBuckets.includes(riskScoreBucket(selectedMetric(country, metrics).score)) &&
            matchesTimeline
          );
        }
      ),
    [activeTimelineYear, actors, data.countries, evidenceYears, includeUndated, metrics, scoreBuckets, selectedRegions, timelineBounds]
  );
  const selected = visibleCountries.find((country) => rowKey(country) === selectedKey);
  const selectedEvidence = selected ? data.evidence.filter((row) => row.ISO3 === selected.iso3 && (!("actor" in row) || row.actor === selected.actor)) : [];
  const comparisonRows = selected ? data.countries.filter((country) => country.iso3 === selected.iso3) : [];
  const visibleKeys = new Set(visibleCountries.map(rowKey));
  const resetTimeline = () => {
    if (timelineBounds) setTimelineYear(timelineBounds.maxYear);
    setIncludeUndated(true);
  };
  const selectCountry = (country: MapCountry) => setSelectedKey(rowKey(country));
  const quickJumpCountry = (country: MapCountry) => {
    const effectiveMetrics = metrics.length ? metrics : metricKeys;
    if (!metrics.length) setMetrics(metricKeys);
    setActors((current) => (current.includes(country.actor) ? current : actorOptions.filter((actor) => actor === country.actor || current.includes(actor))));
    setSelectedRegions((current) => (current.includes(country.region) ? current : [...current, country.region].filter(Boolean)));
    const scoreBucket = riskScoreBucket(selectedMetric(country, effectiveMetrics).score);
    setScoreBuckets((current) => (current.includes(scoreBucket) ? current : riskScoreKeys.filter((bucket) => bucket === scoreBucket || current.includes(bucket))));
    const year = countryTimelineYear(country, evidenceYears);
    if (year) setTimelineYear((current) => Math.max(current ?? year, year));
    if (!year) setIncludeUndated(true);
    setSelectedKey(rowKey(country));
  };

  return (
    <div className="dashboard-shell">
      <MapView
        countries={visibleCountries}
        geojson={data.joined}
        flows={data.flows.filter((flow) => visibleKeys.has(`${flow.actor}:${flow.iso3}`))}
        markers={data.markers.filter((marker) => visibleKeys.has(`${marker.actor}:${marker.iso3}`))}
        metrics={metrics}
        compareMode={compareMode}
        selectedKey={selectedKey}
        onSelect={selectCountry}
      />

      <FilterEmptyState
        loaded={!loading && !error && data.countries.length > 0}
        visibleCountries={visibleCountries}
        totalCountries={data.countries.length}
        actors={actors}
        setActors={setActors}
        metrics={metrics}
        setMetrics={setMetrics}
        scoreBuckets={scoreBuckets}
        setScoreBuckets={setScoreBuckets}
        selectedRegions={selectedRegions}
        setSelectedRegions={setSelectedRegions}
        regions={regions}
        resetTimeline={resetTimeline}
      />

      <TopFilters
        metrics={metrics}
        setMetrics={setMetrics}
        scoreBuckets={scoreBuckets}
        setScoreBuckets={setScoreBuckets}
        actors={actors}
        setActors={setActors}
        selectedRegions={selectedRegions}
        setSelectedRegions={setSelectedRegions}
        regions={regions}
      />
      <ActiveFilterChips
        actors={actors}
        setActors={setActors}
        metrics={metrics}
        setMetrics={setMetrics}
        scoreBuckets={scoreBuckets}
        setScoreBuckets={setScoreBuckets}
        selectedRegions={selectedRegions}
        setSelectedRegions={setSelectedRegions}
        regions={regions}
        compareMode={compareMode}
        setCompareMode={setCompareMode}
        timelineBounds={timelineBounds}
        timelineYear={activeTimelineYear}
        setTimelineYear={setTimelineYear}
        includeUndated={includeUndated}
        setIncludeUndated={setIncludeUndated}
      />
      <LeftPanels
        countries={visibleCountries}
        allCountries={data.countries}
        metrics={metrics}
        selected={selected}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSelect={selectCountry}
        onQuickJump={quickJumpCountry}
        onOpenMethodology={() => setMethodologyOpen(true)}
        timelineBounds={timelineBounds}
        timelineYear={activeTimelineYear}
        setTimelineYear={setTimelineYear}
        includeUndated={includeUndated}
        setIncludeUndated={setIncludeUndated}
        timelineDatedRows={timelineStats.datedRows}
        timelineUndatedRows={timelineStats.undatedRows}
        timelineActiveRows={timelineStats.activeRows}
      />
      <RiskLegend countries={visibleCountries} metrics={metrics} />
      <AnalyticsCards
        countries={visibleCountries}
        metrics={metrics}
        demoFlows={data.flows.filter((flow) => visibleKeys.has(`${flow.actor}:${flow.iso3}`)).length}
        demoMarkers={data.markers.filter((marker) => visibleKeys.has(`${marker.actor}:${marker.iso3}`)).length}
      />

      <button type="button" className="ranked-table-button" onClick={() => setRankedTableOpen(true)}>
        Ranked table
      </button>
      <button type="button" className={`compare-mode-button ${compareMode ? "active" : ""}`} onClick={() => setCompareMode(!compareMode)} aria-pressed={compareMode}>
        {compareMode ? "Compare mode on" : "Compare mode"}
      </button>

      {loading && <div className="status-banner">Loading workbook intelligence layers...</div>}
      {error && <div className="status-banner error">{error}</div>}
      <RankedTableDrawer
        open={rankedTableOpen}
        countries={visibleCountries}
        metrics={metrics}
        selectedKey={selectedKey}
        onSelect={selectCountry}
        onClose={() => setRankedTableOpen(false)}
      />
      <CountryDrawer country={selected} comparisonRows={comparisonRows} metrics={metrics} evidence={selectedEvidence} sources={data.sources} onClose={() => setSelectedKey("")} />
      {methodologyOpen && <MethodologyModal onClose={() => setMethodologyOpen(false)} />}
    </div>
  );
}
