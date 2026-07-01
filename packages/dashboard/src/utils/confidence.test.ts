import { describe, expect, it } from "vitest";
import {
  attributionLabel,
  evidenceCountToLevel,
  evidenceLevelLabel,
  resolveDisplayedAttribution,
} from "./confidence.js";

describe("evidenceCountToLevel", () => {
  it("maps 3 or more evidence items to high", () => {
    expect(evidenceCountToLevel(3)).toBe("high");
    expect(evidenceCountToLevel(5)).toBe("high");
  });

  it("maps 2 evidence items to medium", () => {
    expect(evidenceCountToLevel(2)).toBe("medium");
  });

  it("maps 1 evidence item to low", () => {
    expect(evidenceCountToLevel(1)).toBe("low");
  });

  it("maps zero evidence items to low", () => {
    expect(evidenceCountToLevel(0)).toBe("low");
  });
});

describe("resolveDisplayedAttribution", () => {
  it("downgrades to degraded when manifest has warnings", () => {
    expect(resolveDisplayedAttribution("complete", true)).toBe("degraded");
  });

  it("preserves complete attribution when no warnings", () => {
    expect(resolveDisplayedAttribution("complete", false)).toBe("complete");
  });

  it("defaults to degraded when attribution is missing", () => {
    expect(resolveDisplayedAttribution(undefined, false)).toBe("degraded");
  });
});

describe("confidence labels", () => {
  it("provides accessible evidence level labels", () => {
    expect(evidenceLevelLabel("high")).toBe("High confidence");
    expect(evidenceLevelLabel("medium")).toBe("Medium confidence");
    expect(evidenceLevelLabel("low")).toBe("Low confidence");
  });

  it("provides accessible attribution labels", () => {
    expect(attributionLabel("complete")).toBe("Attribution complete");
    expect(attributionLabel("degraded")).toBe("Attribution degraded");
  });
});
