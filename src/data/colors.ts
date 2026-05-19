export function normalizeHex(value?: string): string {
  if (!value) return "#334155";
  return value.startsWith("#") ? value : `#${value}`;
}

export function confidenceOpacity(value?: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0.25;
  return Math.max(0.12, Math.min(1, value));
}
