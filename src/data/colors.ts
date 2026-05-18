import type { MetricKey } from "./types";

export const scoreStops = [
  { min: 0, max: 0.9, label: "Very low", color: "#f7fbff" },
  { min: 1, max: 1.9, label: "Low", color: "#c6dbef" },
  { min: 2, max: 2.9, label: "Medium", color: "#6baed6" },
  { min: 3, max: 3.9, label: "High", color: "#2171b5" },
  { min: 4, max: 5, label: "Very high", color: "#08306b" }
];

export function colorForScore(value?: number | null, metric?: MetricKey): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "#e5e7eb";
  const scaled = metric === "confidence_score" ? value * 5 : value;
  return scoreStops.find((stop) => scaled >= stop.min && scaled <= stop.max)?.color ?? "#e5e7eb";
}

export function mapColorExpression(metric: MetricKey): unknown[] {
  const valueExpression = metric === "confidence_score" ? ["*", ["coalesce", ["get", metric], -1], 5] : ["coalesce", ["get", metric], -1];
  return [
    "step",
    valueExpression,
    "#e5e7eb",
    0,
    "#f7fbff",
    1,
    "#c6dbef",
    2,
    "#6baed6",
    3,
    "#2171b5",
    4,
    "#08306b"
  ];
}

export function workbookColorExpression(metric: MetricKey): unknown[] {
  return [
    "case",
    ["all", ["has", "map_color"], ["!=", ["get", "map_color"], ""]],
    ["get", "map_color"],
    mapColorExpression(metric)
  ];
}
