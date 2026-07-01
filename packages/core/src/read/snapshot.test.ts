import { afterEach, describe, expect, it } from "vitest";
import { getRepoSnapshot } from "./snapshot.js";
import {
  indexBasicScenario,
  indexBasicScenarioWithSemantic,
} from "../../../../tests/golden/helpers.js";

describe("getRepoSnapshot erasSummary", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("returns null erasSummary when semantic artifacts are absent", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    const snapshot = getRepoSnapshot(fixture.gitchangeDir);
    expect(snapshot.erasSummary).toBeNull();
  });

  it("exposes era names and inflection counts after semantic pipeline", async () => {
    const fixture = await indexBasicScenarioWithSemantic();
    cleanups.push(fixture.cleanup);

    const snapshot = getRepoSnapshot(fixture.gitchangeDir);
    expect(snapshot.erasSummary).not.toBeNull();
    expect(snapshot.erasSummary?.eraCount).toBe(2);
    expect(snapshot.erasSummary?.inflectionCount).toBe(2);
    expect(snapshot.erasSummary?.eras).toHaveLength(2);
    expect(snapshot.erasSummary?.eras[0]?.name).toBe("Bootstrap era");
    expect(snapshot.erasSummary?.eras[0]?.inflectionTypes).toContain(
      "tech_pivot",
    );
    expect(snapshot.erasSummary?.eras[1]?.name).toBe("Growth era");
    expect(snapshot.erasSummary?.eras[1]?.inflectionTypes).toContain(
      "scope_steering",
    );
  });

  it("truncates long era summaries to 200 characters", async () => {
    const fixture = await indexBasicScenarioWithSemantic();
    cleanups.push(fixture.cleanup);

    const snapshot = getRepoSnapshot(fixture.gitchangeDir);
    for (const era of snapshot.erasSummary?.eras ?? []) {
      expect(era.summary.length).toBeLessThanOrEqual(200);
    }
  });
});
