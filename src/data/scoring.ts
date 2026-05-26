import type { MapCountry, MetricDatum, MetricKey } from "./types";

export const SCORE_MAX = 10;
export const SCORE_COLORS = [
  "#E5E7EB",
  "#D1FAE5",
  "#A7F3D0",
  "#FEF3C7",
  "#FDE68A",
  "#FCD34D",
  "#FDBA74",
  "#FB923C",
  "#F97316",
  "#EF4444",
  "#B91C1C"
] as const;

export type RiskScoreBucket = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export const metricOptions: { key: MetricKey; label: string }[] = [
  { key: "composite", label: "Composite risk" },
  { key: "influence", label: "Influence / leverage" },
  { key: "security", label: "Security / contractors" },
  { key: "propaganda", label: "Propaganda ecosystems" },
  { key: "election", label: "Election interference" }
];

export const riskScoreOptions: { key: RiskScoreBucket; label: string; range: string }[] = [
  { key: 0, label: "0 No confirmed signs", range: "0.0-0.9" },
  { key: 1, label: "1 Trace", range: "1.0-1.9" },
  { key: 2, label: "2 Limited", range: "2.0-2.9" },
  { key: 3, label: "3 Low recurring", range: "3.0-3.9" },
  { key: 4, label: "4 Recurring", range: "4.0-4.9" },
  { key: 5, label: "5 Significant", range: "5.0-5.9" },
  { key: 6, label: "6 Sustained", range: "6.0-6.9" },
  { key: 7, label: "7 Strong", range: "7.0-7.9" },
  { key: 8, label: "8 Entrenched", range: "8.0-8.9" },
  { key: 9, label: "9 Dominant", range: "9.0-9.9" },
  { key: 10, label: "10 Central", range: "10.0" }
];

export const riskScoreKeys = riskScoreOptions.map((option) => option.key);

export function formatScore(score?: number): string {
  if (typeof score !== "number" || Number.isNaN(score)) return "No data";
  return score.toFixed(1).replace(/\.0$/, "");
}

export function countryMetric(country: MapCountry, metric: MetricKey) {
  const datum = country.metrics[metric] ?? country.metrics.composite;
  return { ...datum, color: scoreColor(datum.score) };
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
  const score = values.reduce((sum, datum) => sum + datum.score, 0) / values.length;
  return {
    score,
    color: scoreColor(score),
    confidence: "Mixed confidence",
    opacity: values.reduce((sum, datum) => sum + datum.opacity, 0) / values.length,
    label: `${values.length} selected layer average`
  };
}

export function scoreColor(score: number): string {
  return SCORE_COLORS[riskScoreBucket(score)] ?? SCORE_COLORS[0];
}

export function riskLabel(score: number): string {
  if (score >= 9) return "Severe";
  if (score >= 7) return "High";
  if (score >= 5) return "Significant";
  if (score >= 3) return "Elevated";
  if (score >= 1) return "Limited";
  return "No confirmed signs";
}

export function riskScoreBucket(score: number): RiskScoreBucket {
  if (!Number.isFinite(score) || score < 1) return 0;
  if (score >= 10) return 10;
  return Math.floor(score) as RiskScoreBucket;
}

export function topCountries(countries: MapCountry[], metrics: MetricKey | MetricKey[], limit = 5): MapCountry[] {
  return [...countries].sort((a, b) => selectedMetric(b, metrics).score - selectedMetric(a, metrics).score).slice(0, limit);
}
