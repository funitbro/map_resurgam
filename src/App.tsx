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

function summarizeSelection(selectedCount: number, totalCount: number, allLabel: string, noneLabel: string, selectedLabel: string) {
  if (selectedCount === totalCount) return allLabel;
  if (selectedCount === 0) return noneLabel;
  return selectedCount === 1 ? selectedLabel : `${selectedCount} selected`;
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
  regions,
  showDemo,
  setShowDemo
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
  showDemo: boolean;
  setShowDemo: (value: boolean) => void;
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
      <label className="switch-row">
        <input type="checkbox" checked={showDemo} onChange={(event) => setShowDemo(event.target.checked)} />
        <span>Show demo/pilot layers</span>
      </label>
    </div>
  );
}

function LeftPanels({
  countries,
  metrics,
  selected,
  searchQuery,
  setSearchQuery,
  onSelect
}: {
  countries: MapCountry[];
  metrics: MetricKey[];
  selected?: MapCountry;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  onSelect: (country: MapCountry) => void;
}) {
  const leaders = topCountries(countries, metrics, 6);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const searchResults = normalizedQuery
    ? topCountries(
        countries.filter((country) =>
          [country.country, country.iso3, country.actor, country.region].some((value) => value.toLowerCase().includes(normalizedQuery))
        ),
        metrics,
        8
      )
    : [];
  const list = normalizedQuery ? searchResults : leaders;
  return (
    <aside className="left-panels">
      <section className="panel brand-panel">
        <span>Intelligence dashboard</span>
        <h1>Global Authoritarian Expansion Map</h1>
        <p>Workbook-driven pilot visualization. Demo flows and icons are not verified intelligence.</p>
      </section>
      <section className="panel search-panel">
        <h2>Country Search</h2>
        <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search country, ISO3, actor" aria-label="Search countries" />
      </section>
      <section className="panel">
        <h2>{normalizedQuery ? "Search Results" : "Priority Watchlist"}</h2>
        <div className="watchlist">
          {list.map((country) => {
            const datum = selectedMetric(country, metrics);
            return (
              <button type="button" key={`${country.actor}-${country.iso3}`} className={selected?.actor === country.actor && selected?.iso3 === country.iso3 ? "selected" : ""} onClick={() => onSelect(country)}>
                <span>{country.actor} / {country.country}</span>
                <strong>{formatScore(datum.score)}</strong>
                <i style={{ background: datum.color }} />
              </button>
            );
          })}
          {normalizedQuery && !searchResults.length && <p className="empty">No matching countries.</p>}
          {!normalizedQuery && !list.length && <p className="empty">No countries match the current filters.</p>}
        </div>
      </section>
      <section className="panel">
        <h2>Governance Flags</h2>
        <div className="flag-list">
          <span>Publication status is preserved from `Layer_status`.</span>
          <span>Confidence drives country opacity.</span>
          <span>Screenshot-style flows and signal icons are marked `Demo`.</span>
        </div>
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
  selectedRegions,
  setSelectedRegions,
  regions,
  showDemo,
  setShowDemo
}: {
  loaded: boolean;
  visibleCountries: MapCountry[];
  totalCountries: number;
  actors: Actor[];
  setActors: (actors: Actor[]) => void;
  metrics: MetricKey[];
  setMetrics: (metrics: MetricKey[]) => void;
  scoreBuckets: RiskScoreBucket[];
  selectedRegions: string[];
  setSelectedRegions: (regions: string[]) => void;
  regions: string[];
  showDemo: boolean;
  setShowDemo: (value: boolean) => void;
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
        {!showDemo && noCountries && (
          <button type="button" onClick={() => setShowDemo(true)}>
            Show demo layers
          </button>
        )}
        {noCountries && !noActors && !noRegions && (
          <button
            type="button"
            onClick={() => {
              setActors(actorOptions);
              setSelectedRegions(regions);
              setShowDemo(true);
            }}
          >
            Reset map filters
          </button>
        )}
      </div>
    </section>
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
      <section className="panel">
        <h2>Risk Legend</h2>
        {buckets.map((bucket) => (
          <div className="legend-row" key={bucket.score}>
            <i style={{ background: bucket.color }} />
            <span>{bucket.score}</span>
            <strong>{bucket.label}</strong>
          </div>
        ))}
      </section>
      <section className="panel">
        <h2>Confidence Opacity</h2>
        <div className="opacity-row">
          <i style={{ opacity: 1 }} />
          <span>High</span>
        </div>
        <div className="opacity-row">
          <i style={{ opacity: 0.75 }} />
          <span>Medium</span>
        </div>
        <div className="opacity-row">
          <i style={{ opacity: 0.45 }} />
          <span>Low</span>
        </div>
        <div className="opacity-row">
          <i style={{ opacity: 0.25 }} />
          <span>Needs review / Demo</span>
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
          <h2 id="methodology-title">Methodology and Source Governance</h2>
          <button type="button" onClick={onClose} aria-label="Close methodology">
            x
          </button>
        </header>
        <p>
          This dashboard extracts `Map_Data`, `Legend_Config`, `Dashboard`, `Evidence_Log`, `Source_Register`, and
          `Rules_Weights` from the all-in-one workbook. Map rows preserve ISO3 identifiers and are joined to world country
          boundaries by ISO3.
        </p>
        <p>
          Country fill colors, scores, confidence labels, opacity, publication status, and notes come from the workbook.
          Confidence controls map opacity: high confidence is opaque, review/pilot data is intentionally faint.
        </p>
        <p>
          Curved influence flows and security/digital/channel icons are generated visualization aids from workbook score fields
          and are marked `Demo`. They must not be interpreted as verified intelligence or source-backed attribution.
        </p>
        <p>
          To replace pilot scores with verified evidence, add source-backed rows in `Evidence_Log`, update `Source_Register`,
          revise `Rules_Weights`, and change map rows away from pilot/demo status before public release.
        </p>
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
  const [showDemo, setShowDemo] = useState(true);
  const [selectedKey, setSelectedKey] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [methodologyOpen, setMethodologyOpen] = useState(false);

  const regions = useMemo(() => Array.from(new Set(data.countries.map((country) => country.region).filter(Boolean))).sort(), [data.countries]);
  useEffect(() => {
    setSelectedRegions((current) => {
      if (!regions.length) return [];
      if (!current.length) return regions;
      const validRegions = current.filter((region) => regions.includes(region));
      return validRegions.length ? validRegions : regions;
    });
  }, [regions]);
  const visibleCountries = useMemo(
    () =>
      data.countries.filter(
        (country) =>
          actors.includes(country.actor) &&
          selectedRegions.includes(country.region) &&
          scoreBuckets.includes(riskScoreBucket(selectedMetric(country, metrics).score)) &&
          (showDemo || country.data_status !== "Demo")
      ),
    [actors, data.countries, metrics, scoreBuckets, selectedRegions, showDemo]
  );
  const selected = visibleCountries.find((country) => `${country.actor}:${country.iso3}` === selectedKey);
  const selectedEvidence = selected ? data.evidence.filter((row) => row.ISO3 === selected.iso3 && (!("actor" in row) || row.actor === selected.actor)) : [];
  const comparisonRows = selected
    ? data.countries.filter((country) => country.iso3 === selected.iso3 && (showDemo || country.data_status !== "Demo"))
    : [];
  const visibleKeys = new Set(visibleCountries.map((country) => `${country.actor}:${country.iso3}`));

  return (
    <div className="dashboard-shell">
      <MapView
        countries={visibleCountries}
        geojson={data.joined}
        flows={showDemo ? data.flows.filter((flow) => visibleKeys.has(`${flow.actor}:${flow.iso3}`)) : []}
        markers={showDemo ? data.markers.filter((marker) => visibleKeys.has(`${marker.actor}:${marker.iso3}`)) : []}
        metrics={metrics}
        selectedKey={selectedKey}
        onSelect={(country) => setSelectedKey(`${country.actor}:${country.iso3}`)}
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
        selectedRegions={selectedRegions}
        setSelectedRegions={setSelectedRegions}
        regions={regions}
        showDemo={showDemo}
        setShowDemo={setShowDemo}
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
        showDemo={showDemo}
        setShowDemo={setShowDemo}
      />
      <LeftPanels countries={visibleCountries} metrics={metrics} selected={selected} searchQuery={searchQuery} setSearchQuery={setSearchQuery} onSelect={(country) => setSelectedKey(`${country.actor}:${country.iso3}`)} />
      <RiskLegend countries={visibleCountries} metrics={metrics} />
      <AnalyticsCards countries={visibleCountries} metrics={metrics} demoFlows={showDemo ? data.flows.filter((flow) => visibleKeys.has(`${flow.actor}:${flow.iso3}`)).length : 0} demoMarkers={showDemo ? data.markers.filter((marker) => visibleKeys.has(`${marker.actor}:${marker.iso3}`)).length : 0} />

      <button type="button" className="methodology-button" onClick={() => setMethodologyOpen(true)}>
        Methodology / sources
      </button>

      {loading && <div className="status-banner">Loading workbook intelligence layers...</div>}
      {error && <div className="status-banner error">{error}</div>}
      <CountryDrawer country={selected} comparisonRows={comparisonRows} metrics={metrics} evidence={selectedEvidence} sources={data.sources} onClose={() => setSelectedKey("")} />
      {methodologyOpen && <MethodologyModal onClose={() => setMethodologyOpen(false)} />}
    </div>
  );
}
