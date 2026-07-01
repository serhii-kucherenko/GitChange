import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { IntelligenceArtifact } from "../../packages/core/src/schema/zod/intelligence.js";
import { checkIntelligenceIntegrity } from "../../packages/core/src/verify/intelligence-integrity.js";
import {
  BASIC_SCENARIO_INTELLIGENCE_SNAPSHOT,
  collectIntelligenceSnapshot,
} from "../../packages/core/src/verify/intelligence-snapshot.js";
import {
  DOC_SECRET,
  MESSAGE_SECRET,
  OWNERSHIP_ALICE,
  OWNSHIP_SCENARIO,
} from "../fixtures/scenarios.js";
import { indexBasicScenario, indexScenario } from "./helpers.js";

describe("golden: intelligence (CONT-01, CONT-03, CONT-04)", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("locks BASIC_SCENARIO intelligence snapshot counts", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    expect(collectIntelligenceSnapshot(fixture.gitchangeDir)).toEqual(
      BASIC_SCENARIO_INTELLIGENCE_SNAPSHOT,
    );
  });

  it("passes intelligence evidence integrity on BASIC_SCENARIO", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    const report = checkIntelligenceIntegrity(fixture.gitchangeDir);
    expect(report.ok).toBe(true);
    expect(report.errors).toEqual([]);
  });

  it("ranks Alice as top owner on OWNSHIP_SCENARIO after rename and merge", async () => {
    const fixture = await indexScenario(OWNSHIP_SCENARIO);
    cleanups.push(fixture.cleanup);

    const artifact = IntelligenceArtifact.parse(
      JSON.parse(
        readFileSync(join(fixture.gitchangeDir, "intelligence.json"), "utf8"),
      ),
    );

    const libApp = artifact.ownership.files.find(
      (file) => file.path === "src/lib/app.ts",
    );
    expect(libApp).toBeDefined();
    expect(libApp?.authors[0]).toMatchObject({
      name: OWNERSHIP_ALICE.authorName,
      email: OWNERSHIP_ALICE.authorEmail,
    });
    expect(libApp?.authors[0]?.percentage).toBeGreaterThan(50);
  });

  it("exports all intelligence sections in intelligence.json", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    const artifact = IntelligenceArtifact.parse(
      JSON.parse(
        readFileSync(join(fixture.gitchangeDir, "intelligence.json"), "utf8"),
      ),
    );

    expect(artifact.churn.files.length).toBeGreaterThan(0);
    expect(artifact.coChange.edges.length).toBeGreaterThan(0);
    expect(artifact.ownership.files.length).toBeGreaterThan(0);
    expect(artifact.eraSignals.boundaries.length).toBeGreaterThan(0);
    expect(artifact.eraOwnership.eras.length).toBeGreaterThan(0);
    expect(artifact.expertise.topics.length).toBeGreaterThan(0);
  });

  it("does not leak fixture secret prefixes into intelligence.json", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    const raw = readFileSync(
      join(fixture.gitchangeDir, "intelligence.json"),
      "utf8",
    );

    expect(raw).not.toContain(MESSAGE_SECRET);
    expect(raw).not.toContain(DOC_SECRET);
    expect(raw).not.toMatch(/ghp_[a-z0-9]{36}/u);
    expect(raw).not.toMatch(/AKIA[A-Z0-9]{16}/u);
  });
});
