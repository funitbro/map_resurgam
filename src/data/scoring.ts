import type { MapCountry, MetricKey } from "./types";

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

export function riskLabel(score: number): string {
  if (score >= 4) return "Severe";
  if (score >= 3) return "High";
  if (score >= 2) return "Elevated";
  if (score >= 1) return "Limited";
  return "No confirmed signs";
}

export function topCountries(countries: MapCountry[], metric: MetricKey, limit = 5): MapCountry[] {
  return [...countries].sort((a, b) => countryMetric(b, metric).score - countryMetric(a, metric).score).slice(0, limit);
}
