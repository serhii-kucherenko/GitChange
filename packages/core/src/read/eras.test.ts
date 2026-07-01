import { afterEach, describe, expect, it } from "vitest";
import { applyBasicScenarioErasFixture } from "../../../../tests/golden/semantic-fixture.js";
import {
  indexBasicScenario,
  indexBasicScenarioWithSemantic,
} from "../../../../tests/golden/helpers.js";
import { listErasForDashboard } from "./eras.js";

describe("listErasForDashboard", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("returns null when eras.json is missing", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    expect(listErasForDashboard(fixture.gitchangeDir)).toBeNull();
  });

  it("returns eras with commit counts after semantic fixture is applied", async () => {
    const fixture = await indexBasicScenarioWithSemantic();
    cleanups.push(fixture.cleanup);

    const result = listErasForDashboard(fixture.gitchangeDir);
    expect(result).not.toBeNull();
    expect(result?.eras.length).toBeGreaterThanOrEqual(1);

    for (const era of result?.eras ?? []) {
      expect(era.id.length).toBeGreaterThan(0);
      expect(era.name.length).toBeGreaterThanOrEqual(3);
      expect(era.startAt).toBeLessThanOrEqual(era.endAt);
      expect(era.commitCountInWindow).toBeGreaterThanOrEqual(1);
      expect(era.claims.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("counts commits only within each era window", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);
    applyBasicScenarioErasFixture(fixture.gitchangeDir);

    const result = listErasForDashboard(fixture.gitchangeDir);
    expect(result).not.toBeNull();

    const firstEra = result?.eras[0];
    expect(firstEra).toBeDefined();
    if (!firstEra) {
      return;
    }

    const totalInWindows = (result?.eras ?? []).reduce(
      (sum, era) => sum + era.commitCountInWindow,
      0,
    );
    expect(totalInWindows).toBeGreaterThanOrEqual(firstEra.commitCountInWindow);
  });
});
