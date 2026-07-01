import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildRepo } from "../../../../tests/fixtures/builder.js";
import { BASIC_SCENARIO } from "../../../../tests/fixtures/scenarios.js";
import { diffCommit, openRepo } from "./index.js";

function commitBinaryFile(repoDir: string, relPath: string, bytes: Buffer, message: string): string {
  const absPath = path.join(repoDir, relPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, bytes);
  execFileSync("git", ["add", "--", relPath], { cwd: repoDir });
  execFileSync(
    "git",
    ["commit", "-m", message],
    {
      cwd: repoDir,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "GitChange Fixture",
        GIT_AUTHOR_EMAIL: "fixture@gitchange.test",
        GIT_COMMITTER_NAME: "GitChange Fixture",
        GIT_COMMITTER_EMAIL: "fixture@gitchange.test",
      },
    },
  );
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoDir, encoding: "utf8" }).trim();
}

describe("diffCommit", () => {
  it("reports root commit files as added", async () => {
    const repo = buildRepo(BASIC_SCENARIO);

    try {
      const gitRepo = await openRepo(repo.dir);
      const rootSha = repo.commitShas[0];
      const changes = diffCommit(gitRepo, rootSha);

      expect(changes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            commitSha: rootSha,
            path: "README.md",
            oldPath: null,
            changeType: "added",
            isBinary: false,
          }),
          expect.objectContaining({
            commitSha: rootSha,
            path: "src/index.ts",
            oldPath: null,
            changeType: "added",
            isBinary: false,
          }),
        ]),
      );
    } finally {
      repo.cleanup();
    }
  });

  it("detects renames via findSimilar", async () => {
    const repo = buildRepo(BASIC_SCENARIO);

    try {
      const gitRepo = await openRepo(repo.dir);
      const renameIndex = BASIC_SCENARIO.findIndex((step) => step.renames);
      const renameSha = repo.commitShas[renameIndex];
      const changes = diffCommit(gitRepo, renameSha);

      expect(changes).toContainEqual({
        commitSha: renameSha,
        path: "src/main.ts",
        oldPath: "src/index.ts",
        changeType: "renamed",
        isBinary: false,
      });
    } finally {
      repo.cleanup();
    }
  });

  it("reports deleted files", async () => {
    const repo = buildRepo([
      { message: "init", files: { "temp.txt": "hello\n" } },
      { message: "remove temp", files: { "temp.txt": null } },
    ]);

    try {
      const gitRepo = await openRepo(repo.dir);
      const deleteSha = repo.commitShas[1];
      const changes = diffCommit(gitRepo, deleteSha);

      expect(changes).toContainEqual({
        commitSha: deleteSha,
        path: "temp.txt",
        oldPath: null,
        changeType: "deleted",
        isBinary: false,
      });
    } finally {
      repo.cleanup();
    }
  });

  it("flags binary blobs without requiring content in the change record", async () => {
    const repo = buildRepo([{ message: "init", files: { "README.md": "# init\n" } }]);

    try {
      const sha = commitBinaryFile(
        repo.dir,
        "assets/logo.bin",
        Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x00, 0x01, 0x02, 0xff]),
        "add binary asset",
      );
      const gitRepo = await openRepo(repo.dir);
      const changes = diffCommit(gitRepo, sha);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toMatchObject({
        commitSha: sha,
        path: "assets/logo.bin",
        oldPath: null,
        changeType: "added",
        isBinary: true,
      });
      expect(changes[0]).not.toHaveProperty("content");
    } finally {
      repo.cleanup();
    }
  });
});
