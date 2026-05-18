import { useCallback, useMemo, useState } from "react";
import { ActorSelector } from "./components/ActorSelector";
import { ComparePanel } from "./components/ComparePanel";
import { CountryPanel } from "./components/CountryPanel";
import { EvidencePanel } from "./components/EvidencePanel";
import { Legend } from "./components/Legend";
import { MapView } from "./components/MapView";
import { Methodology } from "./components/Methodology";
import { MetricSelector } from "./components/MetricSelector";
import { RankedTable } from "./components/RankedTable";
import { actors } from "./data/scoring";
import type { Actor, ActorMode, CountryScore, MetricKey, ViewMode } from "./data/types";
import { useEvidence } from "./hooks/useEvidence";
import { useScores } from "./hooks/useScores";

const viewOptions: { key: ViewMode; label: string }[] = [
  { key: "map", label: "Choropleth map" },
  { key: "table", label: "Ranked table" },
  { key: "country", label: "Country detail" },
  { key: "evidence", label: "Evidence explorer" }
];

function firstActorScore(scores: CountryScore[], iso3?: string, actor?: ActorMode) {
  if (!iso3) return undefined;
  if (actor && actor !== "Compare") return scores.find((score) => score.iso3 === iso3 && score.actor === actor);
  return actors.map((candidate) => scores.find((score) => score.iso3 === iso3 && score.actor === candidate)).find(Boolean);
}

export default function App() {
  const { scores, loading, error } = useScores();
  const { evidence, sources } = useEvidence();
  const [actor, setActor] = useState<ActorMode>("Russia");
  const [metric, setMetric] = useState<MetricKey>("composite_score");
  const [view, setView] = useState<ViewMode>("map");
  const [selectedIso, setSelectedIso] = useState<string>("");
  const [methodologyOpen, setMethodologyOpen] = useState(() => window.location.pathname === "/methodology");

  const selectedScore = useMemo(() => firstActorScore(scores, selectedIso, actor), [actor, scores, selectedIso]);
  const selectedEvidence = useMemo(() => {
    if (!selectedScore) return [];
    return evidence.filter((item) => item.actor === selectedScore.actor && (item.iso3 === selectedScore.iso3 || item.country === selectedScore.country));
  }, [evidence, selectedScore]);

  const handleActorChange = (value: ActorMode) => {
    setActor(value);
    if (value === "Compare") setView("map");
  };

  const handleMapSelect = useCallback((iso3: string) => {
    setSelectedIso(iso3);
    setView("country");
  }, []);

  const handleTableSelect = (score: CountryScore) => {
    setActor(score.actor);
    setSelectedIso(score.iso3);
    setView("country");
  };

  const activeActor = actor === "Compare" ? "Russia" : (actor as Actor);

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Interactive Authoritarian Influence Map</h1>
          <p>
            Country-level scoring of foreign influence approaches: leverage, private security/contractor presence, propaganda
            ecosystems, and election interference.
          </p>
        </div>
        <button type="button" onClick={() => setMethodologyOpen(true)}>
          Methodology
        </button>
      </header>

      <main className="workspace">
        <aside className="control-panel">
          <ActorSelector value={actor} onChange={handleActorChange} />
          <MetricSelector value={metric} onChange={setMetric} />
          <fieldset className="control-group" aria-label="View mode">
            <legend>View</legend>
            <div className="view-buttons">
              {viewOptions.map((option) => (
                <button key={option.key} type="button" className={view === option.key ? "active" : ""} onClick={() => setView(option.key)}>
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
          <Legend metric={metric} />
          {loading && <p className="empty-state">Loading score data...</p>}
          {error && <p className="error-state">Data files are not generated yet: {error}</p>}
        </aside>

        <section className="primary-area">
          <MapView actor={actor} metric={metric} scores={scores} selectedIso={selectedIso} onSelect={handleMapSelect} />
          {actor === "Compare" || view === "map" ? (
            actor === "Compare" && <ComparePanel scores={scores} selectedIso={selectedIso} onSelect={setSelectedIso} />
          ) : null}
          {view === "table" && <RankedTable actor={activeActor} scores={scores} onSelect={handleTableSelect} />}
          {view === "evidence" && (
            <section className="table-panel">
              <h2>Evidence explorer</h2>
              <EvidencePanel evidence={selectedScore ? selectedEvidence : evidence.filter((item) => !item.country || item.actor === activeActor).slice(0, 40)} />
            </section>
          )}
        </section>

        <CountryPanel score={selectedScore} evidence={selectedEvidence} sources={sources} onClose={() => setSelectedIso("")} />
      </main>

      {methodologyOpen && <Methodology onClose={() => setMethodologyOpen(false)} />}
    </div>
  );
}

