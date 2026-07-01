import { describe, expect, it } from "vitest";
import { buildRepo } from "../../../../tests/fixtures/builder.js";
import { BASIC_SCENARIO, MESSAGE_SECRET } from "../../../../tests/fixtures/scenarios.js";
import { createIgnoreMatcher } from "../privacy/gitchangeignore.js";
import { openRepo } from "./git-walk.js";
import { diffCommit } from "./diff.js";
import {
  captureDiffHunks,
  MAX_HUNKS_PER_FILE,
  MAX_PATCH_BYTES_PER_FILE,
} from "./hunks.js";

describe("captureDiffHunks", () => {
  it("returns hunks with line ranges for a modified file", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    try {
      const gitRepo = await openRepo(repo.dir);
      const featureCommitIdx = BASIC_SCENARIO.findIndex((spec) =>
        spec.message?.includes("wire endpoint"),
      );
      const sha = repo.commitShas[featureCommitIdx];
      const changes = diffCommit(gitRepo, sha);
      const featureChange = changes.find((change) => change.path === "src/feature.ts");
      expect(featureChange).toBeDefined();

      const matcher = createIgnoreMatcher([]);
      const result = captureDiffHunks({
        repo: gitRepo,
        sha,
        path: featureChange!.path,
        changeType: featureChange!.changeType,
        isBinary: featureChange!.isBinary,
        contentIgnored: false,
        matcher,
      });

      expect(result.hunks.length).toBeGreaterThanOrEqual(1);
      expect(result.hunks[0]?.startLine).toBeGreaterThanOrEqual(1);
      expect(result.hunks[0]?.endLine).toBeGreaterThanOrEqual(result.hunks[0]!.startLine);
      expect(result.hunks[0]?.patch).toMatch(/^@@ /);
    } finally {
      repo.cleanup();
    }
  });

  it("redacts secret patterns in patch text via applyPrivacy", async () => {
    const repo = buildRepo([
      {
        message: "feat: add secret in patch",
        files: {
          "src/config.ts": `export const token = "${MESSAGE_SECRET}";\n`,
        },
      },
      {
        message: "feat: rotate token",
        files: {
          "src/config.ts": `export const token = "public-value";\n`,
        },
      },
    ]);

    try {
      const gitRepo = await openRepo(repo.dir);
      const sha = repo.commitShas[1];
      const matcher = createIgnoreMatcher([]);

      const result = captureDiffHunks({
        repo: gitRepo,
        sha,
        path: "src/config.ts",
        changeType: "modified",
        isBinary: false,
        contentIgnored: false,
        matcher,
      });

      expect(result.hunks.length).toBeGreaterThanOrEqual(1);
      expect(result.hunks.some((hunk) => hunk.patch.includes("«redacted»"))).toBe(true);
      expect(result.contentRedacted).toBe(true);
      expect(result.secretFindings.length).toBeGreaterThan(0);
    } finally {
      repo.cleanup();
    }
  });

  it("returns zero hunks for contentIgnored paths", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    try {
      const gitRepo = await openRepo(repo.dir);
      const envCommitIdx = BASIC_SCENARIO.findIndex((spec) =>
        spec.message?.includes("ignored env"),
      );
      const sha = repo.commitShas[envCommitIdx];
      const matcher = createIgnoreMatcher([".env"]);

      const result = captureDiffHunks({
        repo: gitRepo,
        sha,
        path: ".env",
        changeType: "added",
        isBinary: false,
        contentIgnored: true,
        matcher,
      });

      expect(result.hunks).toEqual([]);
    } finally {
      repo.cleanup();
    }
  });

  it("returns zero hunks for binary files", async () => {
    const repo = buildRepo([
      {
        message: "add binary",
        files: {
          "assets/logo.png": "\x89PNG\r\n\x1a\n",
        },
      },
    ]);

    try {
      const gitRepo = await openRepo(repo.dir);
      const sha = repo.commitShas[0];
      const matcher = createIgnoreMatcher([]);

      const result = captureDiffHunks({
        repo: gitRepo,
        sha,
        path: "assets/logo.png",
        changeType: "added",
        isBinary: true,
        contentIgnored: false,
        matcher,
      });

      expect(result.hunks).toEqual([]);
    } finally {
      repo.cleanup();
    }
  });

  it("enforces hunk count and byte caps", () => {
    expect(MAX_HUNKS_PER_FILE).toBe(20);
    expect(MAX_PATCH_BYTES_PER_FILE).toBe(32 * 1024);
  });
});
