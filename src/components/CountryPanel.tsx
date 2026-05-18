import { formatScore } from "../data/scoring";
import type { CountryScore, EvidenceItem, SourceItem } from "../data/types";
import { EvidencePanel } from "./EvidencePanel";
import { ScoreBars } from "./ScoreBars";
import { SourceList } from "./SourceList";

type Props = {
  score?: CountryScore;
  evidence: EvidenceItem[];
  sources: SourceItem[];
  onClose?: () => void;
};

export function CountryPanel({ score, evidence, sources, onClose }: Props) {
  if (!score) {
    return (
      <aside className="detail-panel">
        <p className="empty-state">Select a scored country on the map or table to inspect rationale and evidence.</p>
      </aside>
    );
  }

  return (
    <aside className="detail-panel" aria-live="polite">
      <div className="panel-heading">
        <div>
          <span>{score.actor}</span>
          <h2>{score.country}</h2>
        </div>
        {onClose && (
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close country panel">
            x
          </button>
        )}
      </div>
      <div className="score-summary">
        <div>
          <span>Composite</span>
          <strong>{formatScore(score.composite_score)}</strong>
        </div>
        <div>
          <span>Confidence</span>
          <strong>{score.confidence_band}</strong>
          <small>{formatScore(score.confidence_score, "confidence_score")}</small>
        </div>
      </div>
      <ScoreBars score={score} />
      {score.short_rationale && (
        <section>
          <h3>Rationale</h3>
          <p>{score.short_rationale}</p>
        </section>
      )}
      <section>
        <h3>Evidence</h3>
        <EvidencePanel evidence={evidence} />
      </section>
      {score.caveats && (
        <section>
          <h3>Notes / caveats</h3>
          <p>{score.caveats}</p>
        </section>
      )}
      {score.last_updated && <p className="updated">Last updated: {score.last_updated}</p>}
      <SourceList sources={sources.filter((source) => source.actor === score.actor)} />
    </aside>
  );
}
