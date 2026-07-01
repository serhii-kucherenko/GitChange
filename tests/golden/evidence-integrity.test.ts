import { afterEach, describe, expect, it } from "vitest";
import { openDb } from "../../packages/core/src/artifacts/db.js";
import { checkEvidenceIntegrity } from "../../packages/core/src/verify/evidence-integrity.js";
import { corruptFirstFileEvidence } from "../../packages/core/src/verify/test-utils.js";
import { indexBasicScenario } from "./helpers.js";

describe("golden: evidence integrity (EVD-04)", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("passes referential integrity on a clean BASIC_SCENARIO index", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    const db = openDb(fixture.gitchangeDir);
    const report = checkEvidenceIntegrity(db);
    expect(report).toEqual({
      ok: true,
      danglingCommitRefs: [],
      danglingFileRefs: [],
    });
  });

  it("detects a corrupted file evidence ref after tampering", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    const fakeSha = "0".repeat(40);
    const fakePath = "nonexistent/corrupted.ts";
    const db = openDb(fixture.gitchangeDir);
    corruptFirstFileEvidence(db, { path: fakePath, commitSha: fakeSha });

    const report = checkEvidenceIntegrity(db);

    expect(report.ok).toBe(false);
    expect(report.danglingFileRefs).toContainEqual({
      path: fakePath,
      commitSha: fakeSha,
    });
  });
});
