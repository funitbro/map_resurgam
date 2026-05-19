import { describe, expect, it } from "vitest";
import { confidenceOpacity, normalizeHex } from "../data/colors";
import { formatScore, riskLabel, riskScoreBucket } from "../data/scoring";

describe("dashboard helpers", () => {
  it("normalizes workbook hex colors", () => {
    expect(normalizeHex("A63603")).toBe("#A63603");
    expect(normalizeHex("#FDAE6B")).toBe("#FDAE6B");
  });

  it("clamps confidence opacity", () => {
    expect(confidenceOpacity(2)).toBe(1);
    expect(confidenceOpacity(0.04)).toBe(0.12);
  });

  it("formats scores and risk labels", () => {
    expect(formatScore(3)).toBe("3");
    expect(riskLabel(4.2)).toBe("Severe");
  });

  it("maps selected risk scores into filter buckets", () => {
    expect(riskScoreBucket(0.4)).toBe(0);
    expect(riskScoreBucket(1.8)).toBe(1);
    expect(riskScoreBucket(2.5)).toBe(2);
    expect(riskScoreBucket(3.9)).toBe(3);
    expect(riskScoreBucket(4.1)).toBe(4);
  });
});
