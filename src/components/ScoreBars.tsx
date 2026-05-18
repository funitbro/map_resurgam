import { colorForScore } from "../data/colors";
import { metricShortLabels, scoreMetrics } from "../data/scoring";
import type { CountryScore, MetricKey } from "../data/types";

type Props = {
  score: CountryScore;
};

export function ScoreBars({ score }: Props) {
  return (
    <div className="score-bars">
      {scoreMetrics.map((metric) => {
        const value = score[metric];
        const width = `${Math.max(0, Math.min(100, (value / 5) * 100))}%`;
        return (
          <div className="score-bar" key={metric}>
            <div className="score-label">
              <span>{metricShortLabels[metric]}</span>
              <strong>{value.toFixed(2).replace(/\.00$/, "")}</strong>
            </div>
            <div className="bar-track" aria-hidden="true">
              <div className="bar-fill" style={{ width, background: colorForScore(value, metric as MetricKey) }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

