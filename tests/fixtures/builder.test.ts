import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildRepo, shallowCloneOf } from "./builder.js";
import {
  BASIC_SCENARIO,
  DOC_SECRET,
  IGNORED_SECRET,
  MESSAGE_SECRET,
} from "./scenarios.js";

describe("fixture builder", () => {
  it("builds BASIC_SCENARIO with merge, rename, secrets, and ignored path", () => {
    const repo = buildRepo(BASIC_SCENARIO);

    try {
      expect(fs.existsSync(path.join(repo.dir, ".git"))).toBe(true);
      expect(repo.commitShas.length).toBeGreaterThanOrEqual(3);
      expect(repo.commitShas.length).toBeLessThanOrEqual(8);
      expect(repo.headSha).toMatch(/^[0-9a-f]{40}$/);
      expect(repo.commitShas.at(-1)).toBe(repo.headSha);

      const log = fs.readFileSync(path.join(repo.dir, ".git", "logs", "HEAD"), "utf8");
      expect(log).toContain(MESSAGE_SECRET);

      const leakDoc = fs.readFileSync(path.join(repo.dir, "docs", "leak.md"), "utf8");
      expect(leakDoc).toContain(DOC_SECRET);

      const envContent = fs.readFileSync(path.join(repo.dir, ".env"), "utf8");
      expect(envContent).toContain(IGNORED_SECRET);

      const mergeParents = execParentCount(repo.dir, repo.headSha);
      expect(mergeParents).toBeGreaterThanOrEqual(2);
    } finally {
      repo.cleanup();
      expect(fs.existsSync(repo.dir)).toBe(false);
    }
  });

  it("shallowCloneOf produces a shallow repository", () => {
    const repo = buildRepo(BASIC_SCENARIO);
    const shallow = shallowCloneOf(repo, 3);

    try {
      expect(fs.existsSync(path.join(shallow.dir, ".git", "shallow"))).toBe(true);
      expect(shallow.headSha).toMatch(/^[0-9a-f]{40}$/);
    } finally {
      shallow.cleanup();
      repo.cleanup();
    }
  });
});

function execParentCount(repoDir: string, sha: string): number {
  const output = execFileSync("git", ["rev-list", "--parents", "-n", "1", sha], {
    cwd: repoDir,
    encoding: "utf8",
  }).trim();
  return output.split(" ").length - 1;
}
