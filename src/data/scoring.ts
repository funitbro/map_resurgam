import type { MapCountry, MetricDatum, MetricKey } from "./types";

export const metricOptions: { key: MetricKey; label: string }[] = [
  { key: "composite", label: "Composite risk" },
  { key: "influence", label: "Influence / leverage" },
  { key: "security", label: "Security / contractors" },
  { key: "propaganda", label: "Propaganda ecosystems" },
  { key: "election", label: "Election interference" }
];

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

export function topCountries(countries: MapCountry[], metrics: MetricKey | MetricKey[], limit = 5): MapCountry[] {
  return [...countries].sort((a, b) => selectedMetric(b, metrics).score - selectedMetric(a, metrics).score).slice(0, limit);
}
