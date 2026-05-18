import { metricLabels } from "../data/scoring";
import type { MetricKey } from "../data/types";

const options: MetricKey[] = [
  "composite_score",
  "influence_score",
  "pmc_psc_score",
  "propaganda_score",
  "election_interference_score",
  "confidence_score"
];

type Props = {
  value: MetricKey;
  onChange: (value: MetricKey) => void;
};

export function MetricSelector({ value, onChange }: Props) {
  return (
    <label className="select-field">
      <span>Metric</span>
      <select value={value} onChange={(event) => onChange(event.target.value as MetricKey)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {metricLabels[option]}
          </option>
        ))}
      </select>
    </label>
  );
}

