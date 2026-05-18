import { describe, expect, it } from "vitest";
import { colorForScore } from "../data/colors";
import { formatScore } from "../data/scoring";

describe("scoring helpers", () => {
  it("formats confidence as a percentage", () => {
    expect(formatScore(0.82, "confidence_score")).toBe("82%");
  });

  it("returns neutral color for missing scores", () => {
    expect(colorForScore(null)).toBe("#e5e7eb");
  });
});

