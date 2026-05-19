import type { MapCountry, MetricDatum, MetricKey } from "./types";

export type RiskScoreBucket = 0 | 1 | 2 | 3 | 4;

export const metricOptions: { key: MetricKey; label: string }[] = [
  { key: "composite", label: "Composite risk" },
  { key: "influence", label: "Influence / leverage" },
  { key: "security", label: "Security / contractors" },
  { key: "propaganda", label: "Propaganda ecosystems" },
  { key: "election", label: "Election interference" }
];

export const riskScoreOptions: { key: RiskScoreBucket; label: string; range: string }[] = [
  { key: 0, label: "0 No confirmed signs", range: "0.0-0.9" },
  { key: 1, label: "1 Limited", range: "1.0-1.9" },
  { key: 2, label: "2 Elevated", range: "2.0-2.9" },
  { key: 3, label: "3 High", range: "3.0-3.9" },
  { key: 4, label: "4-5 Severe", range: "4.0-5.0" }
];

export const riskScoreKeys = riskScoreOptions.map((option) => option.key);

export function formatScore(score?: number): string {
  if (typeof score !== "number" || Number.isNaN(score)) return "No data";
  return score.toFixed(1).replace(/\.0$/, "");
}

export function countryMetric(country: MapCountry, metric: MetricKey) {
  return country.metrics[metric] ?? country.metrics.composite;
}

function normalizedMetrics(metrics: MetricKey | MetricKey[]) {
  return Array.isArray(metrics) ? metrics : [metrics];
}

export function selectedMetric(country: MapCountry, metrics: MetricKey | MetricKey[]): MetricDatum {
  const keys = normalizedMetrics(metrics);
  if (!keys.length) {
    return {
      score: 0,
      color: "#334155",
      confidence: "No layer selected",
      opacity: 0.18,
      label: "No risk layer selected"
    };
  }
  const values = keys.map((key) => countryMetric(country, key));
  if (values.length === 1) return values[0];
  const dominant = values.reduce((current, candidate) => (candidate.score > current.score ? candidate : current));
  return {
    score: values.reduce((sum, datum) => sum + datum.score, 0) / values.length,
    color: dominant.color,
    confidence: "Mixed confidence",
    opacity: values.reduce((sum, datum) => sum + datum.opacity, 0) / values.length,
    label: `${values.length} selected layer average`
  };
}

export function riskLabel(score: number): string {
  if (score >= 4) return "Severe";
  if (score >= 3) return "High";
  if (score >= 2) return "Elevated";
  if (score >= 1) return "Limited";
  return "No confirmed signs";
}

export function riskScoreBucket(score: number): RiskScoreBucket {
  if (!Number.isFinite(score) || score < 1) return 0;
  if (score < 2) return 1;
  if (score < 3) return 2;
  if (score < 4) return 3;
  return 4;
}

export function topCountries(countries: MapCountry[], metrics: MetricKey | MetricKey[], limit = 5): MapCountry[] {
  return [...countries].sort((a, b) => selectedMetric(b, metrics).score - selectedMetric(a, metrics).score).slice(0, limit);
}
