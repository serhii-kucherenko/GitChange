import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { openDb } from "../../packages/core/src/artifacts/db.js";
import { openRepo } from "../../packages/core/src/ingestion/git-walk.js";
import { indexFull } from "../../packages/core/src/index/full.js";
import { resolveHeadSha } from "../../packages/core/src/index/repo-head.js";
import { ManifestSchema } from "../../packages/core/src/schema/manifest.js";
import { checkEvidenceIntegrity } from "../../packages/core/src/verify/evidence-integrity.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const NETWORK_IMPORT_PATTERN =
  "from ['\"](node:)?(http|https|net|dns|dgram)['\"]|require\\(['\"](node:)?(http|https|net|dns|dgram)['\"]|\\bfetch\\(|(from|require\\()\\s*['\"][^'\"]*(telemetry|analytics)";

describe("golden: PRIV-01 core network surface", () => {
  it("has no network imports or telemetry hooks in packages/core/src", () => {
    let output = "";
    try {
      output = execFileSync(
        "grep",
        ["-rEn", NETWORK_IMPORT_PATTERN, "packages/core/src"],
        { cwd: REPO_ROOT, encoding: "utf8" },
      );
    } catch (error) {
      const status = (error as NodeJS.ErrnoException & { status?: number }).status;
      if (status === 1) {
        output = "";
      } else {
        throw error;
      }
    }

    expect(output.trim()).toBe("");
  });
});

const dogfoodEnabled = Boolean(process.env.GITCHANGE_DOGFOOD);

describe.skipIf(!dogfoodEnabled)("golden: dogfood index (D-11)", () => {
  let gitchangeDir = "";

  afterEach(() => {
    if (gitchangeDir) {
      rmSync(gitchangeDir, { recursive: true, force: true });
      gitchangeDir = "";
    }
  });

  it("indexes the GitChange repo with schema-valid manifest and evidence integrity", async () => {
    gitchangeDir = mkdtempSync(join(tmpdir(), "gitchange-dogfood-"));
    const repo = await openRepo(REPO_ROOT);
    const headSha = resolveHeadSha(repo);

    const result = await indexFull({ repoPath: REPO_ROOT, gitchangeDir });

    const manifest = ManifestSchema.parse(
      JSON.parse(readFileSync(join(gitchangeDir, "manifest.json"), "utf8")),
    );

    expect(manifest.lastIndexedCommit).toBe(headSha);
    expect(manifest.repo.head).toBe(headSha);
    expect(result.commitsIndexed).toBeGreaterThan(0);

    const db = openDb(gitchangeDir);
    const integrity = checkEvidenceIntegrity(db);
    expect(integrity).toEqual({
      ok: true,
      danglingCommitRefs: [],
      danglingFileRefs: [],
    });
  });
});
