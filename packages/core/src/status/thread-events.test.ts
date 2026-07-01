import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDb } from "../artifacts/db.js";
import * as schema from "../schema/drizzle/schema.js";
import { buildThreadEvents, MAX_THREAD_EVENTS } from "./thread-events.js";

const SHA_OLD = "1".repeat(40);
const SHA_NEW = "2".repeat(40);

function seedThreadDb() {
  const dir = mkdtempSync(join(tmpdir(), "gitchange-thread-events-"));
  const db = openDb(dir);

  const alice = db
    .insert(schema.authors)
    .values({ name: "Alice", email: "alice@test" })
    .returning({ id: schema.authors.id })
    .get();
  const bob = db
    .insert(schema.authors)
    .values({ name: "Bob", email: "bob@test" })
    .returning({ id: schema.authors.id })
    .get();

  db.insert(schema.commits)
    .values([
      {
        sha: SHA_OLD,
        authorId: alice.id,
        committerId: alice.id,
        summary: "feat: older touch",
        message: "feat: older touch",
        committedAt: 1_700_000_000_000,
        authoredAt: 1_700_000_000_000,
        isMerge: false,
        parentCount: 1,
        parentsJson: "[]",
        ccType: "feat",
        ccScope: null,
        ccBreaking: false,
      },
      {
        sha: SHA_NEW,
        authorId: bob.id,
        committerId: bob.id,
        summary: "feat: newer touch",
        message: "feat: newer touch",
        committedAt: 1_800_000_000_000,
        authoredAt: 1_800_000_000_000,
        isMerge: false,
        parentCount: 1,
        parentsJson: "[]",
        ccType: "feat",
        ccScope: null,
        ccBreaking: false,
      },
    ])
    .run();

  db.insert(schema.fileChanges)
    .values([
      {
        commitSha: SHA_OLD,
        path: "src/feature.ts",
        changeType: "M",
        isBinary: false,
        contentIgnored: false,
        contentRedacted: false,
        evidenceJson: "[]",
      },
      {
        commitSha: SHA_NEW,
        path: "src/feature.ts",
        changeType: "M",
        isBinary: false,
        contentIgnored: false,
        contentRedacted: false,
        evidenceJson: "[]",
      },
      {
        commitSha: SHA_NEW,
        path: "src/feature-extra.ts",
        changeType: "A",
        isBinary: false,
        contentIgnored: false,
        contentRedacted: false,
        evidenceJson: "[]",
      },
    ])
    .run();

  return { dir, db };
}

describe("buildThreadEvents", () => {
  it("returns commits touching related paths newest-first with merged paths", () => {
    const { dir, db } = seedThreadDb();

    try {
      const events = buildThreadEvents(db, ["src/feature.ts"]);

      expect(events).toHaveLength(2);
      expect(events[0]?.commitSha).toBe(SHA_NEW);
      expect(events[0]?.paths).toEqual(["src/feature.ts"]);
      expect(events[1]?.commitSha).toBe(SHA_OLD);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("caps events at MAX_THREAD_EVENTS", () => {
    expect(MAX_THREAD_EVENTS).toBe(100);
  });
});
