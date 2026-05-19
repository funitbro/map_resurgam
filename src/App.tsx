import { useMemo, useState } from "react";
import { MapView } from "./components/MapView";
import { metricOptions, countryMetric, formatScore, riskLabel, topCountries } from "./data/scoring";
import type { ActorFilter, EvidenceRow, MapCountry, MetricKey, SourceRow } from "./data/types";
import { useDashboardData } from "./hooks/useDashboardData";

function TopFilters({
  metric,
  setMetric,
  region,
  setRegion,
  actor,
  setActor,
  regions,
  showDemo,
  setShowDemo
}: {
  metric: MetricKey;
  setMetric: (metric: MetricKey) => void;
  region: string;
  setRegion: (region: string) => void;
  actor: ActorFilter;
  setActor: (actor: ActorFilter) => void;
  regions: string[];
  showDemo: boolean;
  setShowDemo: (value: boolean) => void;
}) {
  return (
    <div className="top-filters">
      <label>
        <span>Actor</span>
        <select value={actor} onChange={(event) => setActor(event.target.value as ActorFilter)}>
          <option value="All">All actors</option>
          <option value="Russia">Russia</option>
          <option value="USA">USA</option>
          <option value="China">China</option>
        </select>
      </label>
      <label>
        <span>Risk layer</span>
        <select value={metric} onChange={(event) => setMetric(event.target.value as MetricKey)}>
          {metricOptions.map((option) => (
            <option value={option.key} key={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Region</span>
        <select value={region} onChange={(event) => setRegion(event.target.value)}>
          <option value="All">All regions</option>
          {regions.map((item) => (
            <option value={item} key={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label className="switch-row">
        <input type="checkbox" checked={showDemo} onChange={(event) => setShowDemo(event.target.checked)} />
        <span>Show demo/pilot layers</span>
      </label>
    </div>
  );
}

function LeftPanels({
  countries,
  metric,
  selected,
  onSelect
}: {
  countries: MapCountry[];
  metric: MetricKey;
  selected?: MapCountry;
  onSelect: (country: MapCountry) => void;
}) {
  const leaders = topCountries(countries, metric, 6);
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
            const datum = countryMetric(country, metric);
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

function RiskLegend({ countries, metric }: { countries: MapCountry[]; metric: MetricKey }) {
  const buckets = [0, 1, 2, 3, 4, 5].map((score) => {
    const sample = countries.find((country) => Math.round(countryMetric(country, metric).score) === score);
    return {
      score,
      label: riskLabel(score),
      color: sample ? countryMetric(sample, metric).color : ["#F2F2F2", "#D9F0D3", "#ADDD8E", "#FDAE6B", "#F16913", "#A63603"][score]
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

function AnalyticsCards({ countries, metric, demoFlows, demoMarkers }: { countries: MapCountry[]; metric: MetricKey; demoFlows: number; demoMarkers: number }) {
  const average = countries.length ? countries.reduce((sum, country) => sum + countryMetric(country, metric).score, 0) / countries.length : 0;
  const highRisk = countries.filter((country) => countryMetric(country, metric).score >= 3).length;
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
  metric,
  evidence,
  sources,
  onClose
}: {
  country?: MapCountry;
  metric: MetricKey;
  evidence: EvidenceRow[];
  sources: SourceRow[];
  onClose: () => void;
}) {
  if (!country) return null;
  const selected = countryMetric(country, metric);
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
        {metricOptions.map((option) => {
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
  const [metric, setMetric] = useState<MetricKey>("composite");
  const [actor, setActor] = useState<ActorFilter>("All");
  const [region, setRegion] = useState("All");
  const [showDemo, setShowDemo] = useState(true);
  const [selectedKey, setSelectedKey] = useState("");
  const [methodologyOpen, setMethodologyOpen] = useState(false);

  const regions = useMemo(() => Array.from(new Set(data.countries.map((country) => country.region).filter(Boolean))).sort(), [data.countries]);
  const visibleCountries = useMemo(
    () =>
      data.countries.filter(
        (country) =>
          (actor === "All" || country.actor === actor) &&
          (region === "All" || country.region === region) &&
          (showDemo || country.data_status !== "Demo")
      ),
    [actor, data.countries, region, showDemo]
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
        metric={metric}
        selectedKey={selectedKey}
        onSelect={(country) => setSelectedKey(`${country.actor}:${country.iso3}`)}
      />

      <TopFilters metric={metric} setMetric={setMetric} actor={actor} setActor={setActor} region={region} setRegion={setRegion} regions={regions} showDemo={showDemo} setShowDemo={setShowDemo} />
      <LeftPanels countries={visibleCountries} metric={metric} selected={selected} onSelect={(country) => setSelectedKey(`${country.actor}:${country.iso3}`)} />
      <RiskLegend countries={visibleCountries} metric={metric} />
      <AnalyticsCards countries={visibleCountries} metric={metric} demoFlows={showDemo ? data.flows.filter((flow) => visibleKeys.has(`${flow.actor}:${flow.iso3}`)).length : 0} demoMarkers={showDemo ? data.markers.filter((marker) => visibleKeys.has(`${marker.actor}:${marker.iso3}`)).length : 0} />

      <button type="button" className="methodology-button" onClick={() => setMethodologyOpen(true)}>
        Methodology / sources
      </button>

      {loading && <div className="status-banner">Loading workbook intelligence layers...</div>}
      {error && <div className="status-banner error">{error}</div>}
      <CountryDrawer country={selected} metric={metric} evidence={selectedEvidence} sources={data.sources} onClose={() => setSelectedKey("")} />
      {methodologyOpen && <MethodologyModal onClose={() => setMethodologyOpen(false)} />}
    </div>
  );
}
