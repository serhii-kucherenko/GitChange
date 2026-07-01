import { afterEach, describe, expect, it } from "vitest";
import { openDb } from "../../packages/core/src/artifacts/db.js";
import * as schema from "../../packages/core/src/schema/drizzle/schema.js";
import {
  BASIC_SCENARIO_SNAPSHOT,
  collectIngestionSnapshot,
} from "../../packages/core/src/verify/ingestion-snapshot.js";
import { indexBasicScenario } from "./helpers.js";

describe("golden: ingestion snapshot (SCALE-03)", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("locks canonical BASIC_SCENARIO ingestion counts", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    const db = openDb(fixture.gitchangeDir);
    expect(collectIngestionSnapshot(db)).toEqual(BASIC_SCENARIO_SNAPSHOT);
  });

  it("stores ignored .gitchangeignore paths without doc content bodies", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    const db = openDb(fixture.gitchangeDir);
    const ignoredChange = db
      .select()
      .from(schema.fileChanges)
      .all()
      .find((row) => row.path === ".env");

    expect(ignoredChange).toBeDefined();
    expect(ignoredChange?.contentIgnored).toBe(true);
  });
});
