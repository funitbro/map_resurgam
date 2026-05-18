import { scoreStops } from "../data/colors";
import { metricLabels } from "../data/scoring";
import type { MetricKey } from "../data/types";

type Props = {
  metric: MetricKey;
};

export function Legend({ metric }: Props) {
  return (
    <div className="legend" aria-label={`${metricLabels[metric]} legend`}>
      <div>
        <strong>{metricLabels[metric]}</strong>
        <span>{metric === "confidence_score" ? "Opacity also reflects confidence" : "0-5 score scale"}</span>
      </div>
      <div className="legend-stops">
        {scoreStops.map((stop) => (
          <span key={stop.label}>
            <i style={{ background: stop.color }} />
            {stop.label}
          </span>
        ))}
      </div>
    </div>
  );
}

