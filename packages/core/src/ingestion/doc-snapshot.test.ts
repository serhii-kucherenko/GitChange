import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildRepo } from "../../../../tests/fixtures/builder.js";
import { openRepo } from "./git-walk.js";
import { diffCommit } from "./diff.js";
import {
  DEFAULT_DOC_GLOBS,
  captureDocSnapshots,
  isDocPath,
} from "./doc-snapshot.js";
import { createIgnoreMatcher } from "../privacy/gitchangeignore.js";

const MAX_BLOB_BYTES = 1_048_576;

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

describe("isDocPath", () => {
  it("matches default doc globs (D-13)", () => {
    expect(DEFAULT_DOC_GLOBS).toEqual(
      expect.arrayContaining(["README*", "CHANGELOG*", "docs/**", "**/adr/**"]),
    );
    expect(isDocPath("README.md")).toBe(true);
    expect(isDocPath("CHANGELOG")).toBe(true);
    expect(isDocPath("docs/guide.md")).toBe(true);
    expect(isDocPath("foo/adr/0001.md")).toBe(true);
    expect(isDocPath("NOTES.md")).toBe(true);
  });

  it("excludes non-doc source paths", () => {
    expect(isDocPath("src/app.ts")).toBe(false);
    expect(isDocPath("packages/foo/notes.md")).toBe(false);
  });
});

describe("captureDocSnapshots", () => {
  it("returns content-addressed snapshots for changed doc paths", async () => {
    const repo = buildRepo([
      {
        message: "init",
        files: {
          "README.md": "# Hello\n",
          "src/index.ts": "export {};\n",
        },
      },
      {
        message: "docs: add guide with frontmatter",
        files: {
          "docs/guide.md": "---\ntitle: Guide\n---\n\nBody text\n",
        },
      },
    ]);

    try {
      const gitRepo = await openRepo(repo.dir);
      const sha = repo.commitShas[1];
      const changes = diffCommit(gitRepo, sha);
      const matcher = createIgnoreMatcher([]);

      const snapshots = captureDocSnapshots(gitRepo, sha, changes, {
        matcher,
        maxBlobBytes: MAX_BLOB_BYTES,
      });

      expect(snapshots).toHaveLength(1);
      expect(snapshots[0]).toMatchObject({
        path: "docs/guide.md",
        commitSha: sha,
        content: "Body text",
        frontmatter: { title: "Guide" },
      });
      expect(snapshots[0]?.contentHash).toBe(sha256("Body text"));
    } finally {
      repo.cleanup();
    }
  });

  it("dedupes identical doc bodies via the same contentHash", async () => {
    const body = "# Stable\n";
    const repo = buildRepo([
      { message: "init", files: { "README.md": body } },
      { message: "docs: tweak readme", files: { "README.md": `${body}\n` } },
      { message: "docs: restore readme", files: { "README.md": body } },
    ]);

    try {
      const gitRepo = await openRepo(repo.dir);
      const matcher = createIgnoreMatcher([]);

      const first = captureDocSnapshots(
        gitRepo,
        repo.commitShas[0],
        diffCommit(gitRepo, repo.commitShas[0]),
        { matcher, maxBlobBytes: MAX_BLOB_BYTES },
      );
      const restored = captureDocSnapshots(
        gitRepo,
        repo.commitShas[2],
        diffCommit(gitRepo, repo.commitShas[2]),
        { matcher, maxBlobBytes: MAX_BLOB_BYTES },
      );

      expect(first[0]?.contentHash).toBe(restored[0]?.contentHash);
      expect(first[0]?.contentHash).toBe(sha256(body.trim()));
    } finally {
      repo.cleanup();
    }
  });

  it("stores metadata only for ignored doc paths (D-07)", async () => {
    const repo = buildRepo([
      {
        message: "init",
        files: {
          "docs/secret.md": "token=supersecretvalue12345\n",
          ".gitchangeignore": "docs/secret.md\n",
        },
      },
    ]);

    try {
      const gitRepo = await openRepo(repo.dir);
      const sha = repo.commitShas[0];
      const matcher = createIgnoreMatcher(["docs/secret.md"]);
      const snapshots = captureDocSnapshots(gitRepo, sha, diffCommit(gitRepo, sha), {
        matcher,
        maxBlobBytes: MAX_BLOB_BYTES,
      });

      expect(snapshots).toHaveLength(1);
      expect(snapshots[0]).toMatchObject({
        path: "docs/secret.md",
        commitSha: sha,
        content: null,
      });
      expect(snapshots[0]?.contentHash).toBe(
        sha256("token=supersecretvalue12345\n"),
      );
    } finally {
      repo.cleanup();
    }
  });

  it("skips deleted and binary doc changes", async () => {
    const repo = buildRepo([
      { message: "init", files: { "docs/readme.md": "hello\n" } },
      { message: "remove doc", files: { "docs/readme.md": null } },
    ]);

    try {
      const gitRepo = await openRepo(repo.dir);
      const sha = repo.commitShas[1];
      const matcher = createIgnoreMatcher([]);
      const snapshots = captureDocSnapshots(gitRepo, sha, diffCommit(gitRepo, sha), {
        matcher,
        maxBlobBytes: MAX_BLOB_BYTES,
      });

      expect(snapshots).toHaveLength(0);
    } finally {
      repo.cleanup();
    }
  });
});
