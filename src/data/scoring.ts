import type { Actor, MetricKey } from "./types";

export const actors: Actor[] = ["Russia", "USA", "China"];

export const metricLabels: Record<MetricKey, string> = {
  composite_score: "Composite score",
  influence_score: "Influence / leverage",
  pmc_psc_score: "PMC / PSC / contractor presence",
  propaganda_score: "Propaganda ecosystem",
  election_interference_score: "Election interference",
  confidence_score: "Confidence"
};

export const scoreMetrics: MetricKey[] = [
  "composite_score",
  "influence_score",
  "pmc_psc_score",
  "propaganda_score",
  "election_interference_score"
];

export const metricShortLabels: Record<MetricKey, string> = {
  composite_score: "Composite",
  influence_score: "Influence",
  pmc_psc_score: "PMC/PSC",
  propaganda_score: "Propaganda",
  election_interference_score: "Election",
  confidence_score: "Confidence"
};

export function formatScore(value?: number | null, metric?: MetricKey): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "No data";
  if (metric === "confidence_score") return `${Math.round(value * 100)}%`;
  return value.toFixed(2).replace(/\.00$/, "");
}

