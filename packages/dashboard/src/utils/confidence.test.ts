import { describe, expect, it } from "vitest";
import {
  attributionLabel,
  classifyDecisionConfidence,
  decisionConfidenceToLevel,
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

describe("decisionConfidenceToLevel", () => {
  it("maps confirmed high-confidence decisions to high (verified)", () => {
    expect(decisionConfidenceToLevel(0.85, "confirmed", 2)).toBe("high");
    expect(classifyDecisionConfidence(0.85, "confirmed", 2)).toBe("verified");
  });

  it("maps pending high-confidence decisions to high (inferred_high)", () => {
    expect(decisionConfidenceToLevel(0.75, "pending", 2)).toBe("high");
    expect(classifyDecisionConfidence(0.75, "pending", 2)).toBe("inferred_high");
  });

  it("maps medium confidence to medium", () => {
    expect(decisionConfidenceToLevel(0.55, "pending", 2)).toBe("medium");
    expect(classifyDecisionConfidence(0.55, "pending", 2)).toBe("medium");
  });

  it("maps below-threshold evidence to low", () => {
    expect(decisionConfidenceToLevel(0.8, "confirmed", 0)).toBe("low");
    expect(decisionConfidenceToLevel(0.2, "pending", 1)).toBe("low");
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
