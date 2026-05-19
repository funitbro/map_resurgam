import { describe, expect, it } from "vitest";
import { confidenceOpacity, normalizeHex } from "../data/colors";
import { formatScore, riskLabel } from "../data/scoring";

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
});
