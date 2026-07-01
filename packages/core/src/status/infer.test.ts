import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDb } from "../artifacts/db.js";
import * as schema from "../schema/drizzle/schema.js";
import {
  detectDocsCodeDivergence,
  INFERENCE_SIGNAL_CODES,
  inferOpenWorkStatus,
} from "./infer.js";

const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);
const NOW = Date.UTC(2026, 6, 1);

function seedDb() {
  const dir = mkdtempSync(join(tmpdir(), "gitchange-infer-"));
  const db = openDb(dir);

  const recentAt = NOW - 5 * 86_400_000;
  const staleAt = NOW - 100 * 86_400_000;

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
        sha: SHA_A,
        authorId: alice.id,
        committerId: alice.id,
        summary: "feat: WIP migration",
        message: "feat: WIP migration\n\nRefs: #42",
        committedAt: recentAt,
        authoredAt: recentAt,
        isMerge: false,
        parentCount: 1,
        parentsJson: "[]",
        ccType: "feat",
        ccScope: null,
        ccBreaking: false,
      },
      {
        sha: SHA_B,
        authorId: bob.id,
        committerId: bob.id,
        summary: "chore: cleanup",
        message: "chore: cleanup\n\nCloses: #42",
        committedAt: staleAt,
        authoredAt: staleAt,
        isMerge: false,
        parentCount: 1,
        parentsJson: "[]",
        ccType: "chore",
        ccScope: null,
        ccBreaking: false,
      },
    ])
    .run();

  db.insert(schema.fileChanges)
    .values([
      {
        commitSha: SHA_A,
        path: "src/migration.ts",
        changeType: "M",
        isBinary: false,
        contentIgnored: false,
        contentRedacted: false,
        evidenceJson: "[]",
      },
    ])
    .run();

  return { dir, db, recentAt, staleAt };
}

describe("inferOpenWorkStatus", () => {
  it("classifies keyword and trailer signals as in_progress", () => {
    const { dir, db, recentAt } = seedDb();

    try {
      const result = inferOpenWorkStatus(
        {
          relatedPaths: ["src/migration.ts"],
          events: [
            {
              commitSha: SHA_A,
              committedAt: recentAt,
              summary: "feat: WIP migration",
              paths: ["src/migration.ts"],
            },
          ],
        },
        db,
        [],
        NOW,
      );

      expect(result.status).toBe("in_progress");
      expect(result.confidence).toBeGreaterThanOrEqual(0.55);
      expect(result.signals.map((s) => s.code)).toContain(
        INFERENCE_SIGNAL_CODES.KEYWORD_WIP_TODO,
      );
      expect(result.signals.map((s) => s.code)).toContain(
        INFERENCE_SIGNAL_CODES.TRAILER_REFS_OPEN,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("classifies stale threads when last event is older than 90 days", () => {
    const { dir, db, staleAt } = seedDb();

    try {
      const result = inferOpenWorkStatus(
        {
          relatedPaths: ["src/migration.ts"],
          events: [
            {
              commitSha: SHA_B,
              committedAt: staleAt,
              summary: "chore: cleanup",
              paths: ["src/migration.ts"],
            },
          ],
        },
        db,
        [],
        NOW,
      );

      expect(result.status).toBe("stale");
      expect(result.signals.map((s) => s.code)).toContain(
        INFERENCE_SIGNAL_CODES.STALE_NO_EVENTS,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns possibly_complete when only closes trailer is present", () => {
    const { dir, db, recentAt } = seedDb();

    try {
      const result = inferOpenWorkStatus(
        {
          relatedPaths: ["src/migration.ts"],
          events: [
            {
              commitSha: SHA_B,
              committedAt: recentAt,
              summary: "chore: cleanup",
              paths: ["src/migration.ts"],
            },
          ],
        },
        db,
        [],
        NOW,
      );

      expect(["completed", "open"]).toContain(result.status);
      expect(result.signals.map((s) => s.code)).toContain(
        INFERENCE_SIGNAL_CODES.TRAILER_CLOSES,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("detectDocsCodeDivergence", () => {
  it("flags divergence when docs claim completion but code changed recently", () => {
    const { dir, db } = seedDb();

    try {
      const result = detectDocsCodeDivergence(
        ["src/migration.ts"],
        [
          {
            path: "docs/migration.md",
            commitSha: SHA_A,
            content: "Migration is complete and done.",
          },
        ],
        db,
        NOW,
      );

      expect(result.diverged).toBe(true);
      expect(result.signals[0]?.code).toBe(
        INFERENCE_SIGNAL_CODES.DOCS_CODE_DIVERGENCE,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
