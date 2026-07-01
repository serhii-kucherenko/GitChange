import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { buildOwnershipRepo } from "../../../../../tests/fixtures/ownership-builder.js";
import {
  OWNERSHIP_ALICE,
  OWNERSHIP_BOB,
} from "../../../../../tests/fixtures/scenarios.js";
import { openDb } from "../../artifacts/db.js";
import { indexFull } from "../../index/full.js";
import * as schema from "../../schema/drizzle/schema.js";
import { IntelligenceArtifact } from "../../schema/zod/intelligence.js";
import { computeIntelligence } from "../compute.js";

const TARGET_PATH = "src/lib/app.ts";

describe("line-survival ownership at HEAD", () => {
  const repos: Array<{ cleanup: () => void }> = [];

  afterEach(() => {
    while (repos.length > 0) {
      repos.pop()?.cleanup();
    }
  });

  async function runPipeline(repoDir: string) {
    const gitchangeDir = join(repoDir, ".gitchange");
    await indexFull({ repoPath: repoDir, gitchangeDir });
    await computeIntelligence({ repoPath: repoDir, gitchangeDir });
    return { gitchangeDir, db: openDb(gitchangeDir) };
  }

  function topOwnerByLines(
    rows: Array<{ authorId: number; lineCount: number; percentage: number }>,
    authors: Array<{ id: number; email: string }>,
  ) {
    const sorted = [...rows].sort((a, b) => b.lineCount - a.lineCount);
    const top = sorted[0];
    if (!top) return null;
    const author = authors.find((entry) => entry.id === top.authorId);
    return { ...top, email: author?.email ?? "" };
  }

  it("attributes renamed file lines to the original author, not only the last editor", async () => {
    const repo = buildOwnershipRepo();
    repos.push(repo);

    const { gitchangeDir, db } = await runPipeline(repo.dir);

    const authors = db.select().from(schema.authors).all();
    const ownershipRows = db
      .select()
      .from(schema.fileOwnership)
      .where(eq(schema.fileOwnership.path, TARGET_PATH))
      .all();

    expect(ownershipRows.length).toBeGreaterThan(0);

    const top = topOwnerByLines(ownershipRows, authors);
    expect(top?.email).toBe(OWNERSHIP_ALICE.authorEmail);
    expect(top?.percentage).toBeGreaterThan(50);

    const artifact = IntelligenceArtifact.parse(
      JSON.parse(readFileSync(join(gitchangeDir, "intelligence.json"), "utf8")),
    );
    const fileEntry = artifact.ownership.files.find(
      (entry) => entry.path === TARGET_PATH,
    );
    expect(fileEntry).toBeDefined();
    const artifactTop = [...(fileEntry?.authors ?? [])].sort(
      (a, b) => b.lineCount - a.lineCount,
    )[0];
    expect(artifactTop?.email).toBe(OWNERSHIP_ALICE.authorEmail);
    expect(fileEntry?.evidence.some((ref) => ref.type === "file")).toBe(true);
  });

  it("honors .git-blame-ignore-revs so formatting commits receive no line credit", async () => {
    const repo = buildOwnershipRepo({
      withFormattingCommit: true,
      withIgnoreRevs: true,
    });
    repos.push(repo);

    const formatSha = repo.commitShas[2];
    expect(formatSha).toBeTruthy();

    const { db } = await runPipeline(repo.dir);
    const authors = db.select().from(schema.authors).all();
    const ownershipRows = db
      .select()
      .from(schema.fileOwnership)
      .where(eq(schema.fileOwnership.path, TARGET_PATH))
      .all();

    const top = topOwnerByLines(ownershipRows, authors);
    expect(top?.email).toBe(OWNERSHIP_ALICE.authorEmail);

    const bobRow = ownershipRows.find((row) => {
      const author = authors.find((entry) => entry.id === row.authorId);
      return author?.email === OWNERSHIP_BOB.authorEmail;
    });
    expect(bobRow?.lineCount ?? 0).toBeLessThanOrEqual(1);

    for (const row of ownershipRows) {
      const evidence = JSON.parse(row.evidenceJson) as Array<{
        commitSha?: string;
      }>;
      for (const ref of evidence) {
        expect(ref.commitSha).not.toBe(formatSha);
      }
    }
  });

  it("does not credit the merge commit author with surviving lines", async () => {
    const repo = buildOwnershipRepo();
    repos.push(repo);

    const mergeSha = repo.commitShas.at(-1);
    expect(mergeSha).toBeTruthy();

    const { db } = await runPipeline(repo.dir);
    const mergeCommit = db
      .select()
      .from(schema.commits)
      .where(eq(schema.commits.sha, mergeSha ?? ""))
      .get();
    expect(mergeCommit?.isMerge).toBe(true);

    const mergeAuthor = db
      .select()
      .from(schema.authors)
      .where(eq(schema.authors.id, mergeCommit?.authorId ?? -1))
      .get();

    const mergeAuthorOwnership = db
      .select()
      .from(schema.fileOwnership)
      .where(eq(schema.fileOwnership.authorId, mergeAuthor?.id ?? -1))
      .all();

    expect(mergeAuthorOwnership.every((row) => row.lineCount === 0)).toBe(true);
    expect(
      mergeAuthorOwnership.length === 0 ||
        mergeAuthorOwnership.every((row) => row.lineCount === 0),
    ).toBe(true);
  });
});
