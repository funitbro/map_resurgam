import { useEffect, useMemo, useState } from "react";
import { MapView } from "./components/MapView";
import { metricOptions, countryMetric, formatScore, riskLabel, selectedMetric, topCountries } from "./data/scoring";
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
  const regionSummary = summarizeSelection(selectedRegions.length, regions.length, "All regions", "No regions", selectedRegions[0]);
  const toggleActor = (actor: Actor) => {
    setActors(actors.includes(actor) ? actors.filter((item) => item !== actor) : [...actors, actor]);
  };
  const toggleMetric = (metric: MetricKey) => {
    setMetrics(metrics.includes(metric) ? metrics.filter((item) => item !== metric) : metricKeys.filter((item) => item === metric || metrics.includes(item)));
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
          <label className="menu-clear">
            <input type="checkbox" checked={!actors.length} onChange={(event) => setActors(event.target.checked ? [] : actorOptions)} />
            <span>Unselect everything</span>
          </label>
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
          <span>Risk layers</span>
          <strong>{metricSummary}</strong>
        </summary>
        <div className="checkbox-menu-panel" role="group" aria-label="Risk layers">
          <label className="menu-clear">
            <input type="checkbox" checked={!metrics.length} onChange={(event) => setMetrics(event.target.checked ? [] : metricKeys)} />
            <span>Unselect everything</span>
          </label>
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
          <label className="menu-clear">
            <input type="checkbox" checked={!selectedRegions.length} onChange={(event) => setSelectedRegions(event.target.checked ? [] : regions)} />
            <span>Unselect everything</span>
          </label>
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
  onSelect
}: {
  countries: MapCountry[];
  metrics: MetricKey[];
  selected?: MapCountry;
  onSelect: (country: MapCountry) => void;
}) {
  const leaders = topCountries(countries, metrics, 6);
  return (
    <aside className="left-panels">
      <section className="panel brand-panel">
        <span>Intelligence dashboard</span>
        <h1>Global Authoritarian Expansion Map</h1>
        <p>Workbook-driven pilot visualization. Demo flows and icons are not verified intelligence.</p>
      </section>
      <section className="panel">
        <h2>Priority Watchlist</h2>
        <div className="watchlist">
          {leaders.map((country) => {
            const datum = selectedMetric(country, metrics);
            return (
              <button type="button" key={`${country.actor}-${country.iso3}`} className={selected?.actor === country.actor && selected?.iso3 === country.iso3 ? "selected" : ""} onClick={() => onSelect(country)}>
                <span>{country.actor} / {country.country}</span>
                <strong>{formatScore(datum.score)}</strong>
                <i style={{ background: datum.color }} />
              </button>
            );
          })}
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

function CountryDrawer({
  country,
  metrics,
  evidence,
  sources,
  onClose
}: {
  country?: MapCountry;
  metrics: MetricKey[];
  evidence: EvidenceRow[];
  sources: SourceRow[];
  onClose: () => void;
}) {
  if (!country) return null;
  const selected = selectedMetric(country, metrics);
  const visibleMetricOptions = metricOptions.filter((option) => metrics.includes(option.key));
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
        <h3>Evidence</h3>
        <EvidenceList evidence={evidence} />
      </section>
      <section>
        <h3>Source governance</h3>
        <div className="source-stack">
          {sources.slice(0, 5).map((source) => (
            <a href={source.URL || undefined} target="_blank" rel="noreferrer" key={source.Source_ID}>
              <strong>{source.Source_Name}</strong>
              <span>{source.Default_Tier}</span>
            </a>
          ))}
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
  const [actors, setActors] = useState<Actor[]>(actorOptions);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [showDemo, setShowDemo] = useState(true);
  const [selectedKey, setSelectedKey] = useState("");
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
          (showDemo || country.data_status !== "Demo")
      ),
    [actors, data.countries, selectedRegions, showDemo]
  );
  const selected = visibleCountries.find((country) => `${country.actor}:${country.iso3}` === selectedKey);
  const selectedEvidence = selected ? data.evidence.filter((row) => row.ISO3 === selected.iso3 && (!("actor" in row) || row.actor === selected.actor)) : [];
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

      <TopFilters metrics={metrics} setMetrics={setMetrics} actors={actors} setActors={setActors} selectedRegions={selectedRegions} setSelectedRegions={setSelectedRegions} regions={regions} showDemo={showDemo} setShowDemo={setShowDemo} />
      <LeftPanels countries={visibleCountries} metrics={metrics} selected={selected} onSelect={(country) => setSelectedKey(`${country.actor}:${country.iso3}`)} />
      <RiskLegend countries={visibleCountries} metrics={metrics} />
      <AnalyticsCards countries={visibleCountries} metrics={metrics} demoFlows={showDemo ? data.flows.filter((flow) => visibleKeys.has(`${flow.actor}:${flow.iso3}`)).length : 0} demoMarkers={showDemo ? data.markers.filter((marker) => visibleKeys.has(`${marker.actor}:${marker.iso3}`)).length : 0} />

      <button type="button" className="methodology-button" onClick={() => setMethodologyOpen(true)}>
        Methodology / sources
      </button>

      {loading && <div className="status-banner">Loading workbook intelligence layers...</div>}
      {error && <div className="status-banner error">{error}</div>}
      <CountryDrawer country={selected} metrics={metrics} evidence={selectedEvidence} sources={data.sources} onClose={() => setSelectedKey("")} />
      {methodologyOpen && <MethodologyModal onClose={() => setMethodologyOpen(false)} />}
    </div>
  );
}
