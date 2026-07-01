import { afterEach, describe, expect, it } from "vitest";
import { openDb } from "../../packages/core/src/artifacts/db.js";
import { indexBasicScenario } from "./helpers.js";

describe("golden: hunk capture at index time", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("persists non-null hunks_json for a known modified file after re-index", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    const db = openDb(fixture.gitchangeDir);
    const rows = db.$client
      .prepare(
        `SELECT path, change_type, hunks_json
         FROM file_changes
         WHERE path = ?`,
      )
      .all("src/feature.ts") as Array<{
      path: string;
      change_type: string;
      hunks_json: string | null;
    }>;

    const modifiedWithHunks = rows.find(
      (row) => row.change_type === "modified" && row.hunks_json,
    );

    expect(modifiedWithHunks).toBeDefined();
    const hunks = JSON.parse(modifiedWithHunks!.hunks_json!) as Array<{
      startLine: number;
      endLine: number;
      patch: string;
    }>;
    expect(hunks.length).toBeGreaterThanOrEqual(1);
    expect(hunks[0]?.patch).toMatch(/^@@ /);
  });
});
