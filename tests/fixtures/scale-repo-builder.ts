import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { BuiltRepo } from "./builder.js";

const SCALE_AUTHOR = {
  name: "GitChange Scale Fixture",
  email: "scale@gitchange.test",
};

const SCALE_BASE_DATE = new Date("2024-06-01T00:00:00.000Z");

function git(
  cwd: string,
  args: string[],
  options: { input?: string; env?: Record<string, string> } = {},
): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    input: options.input,
    env: { ...process.env, ...options.env },
  }).trim();
}

function resolveHeadSha(cwd: string): string {
  return git(cwd, ["rev-parse", "HEAD"]);
}

function listCommitShasOldestFirst(cwd: string): string[] {
  const output = git(cwd, ["rev-list", "--reverse", "HEAD"]);
  return output ? output.split("\n") : [];
}

function committerLine(index: number): string {
  const timestamp =
    Math.floor(SCALE_BASE_DATE.getTime() / 1000) + index * 60;
  return `committer ${SCALE_AUTHOR.name} <${SCALE_AUTHOR.email}> ${timestamp} +0000`;
}

function appendBlob(
  chunks: string[],
  mark: string,
  content: string,
): void {
  chunks.push("blob\n");
  chunks.push(`mark :${mark}\n`);
  chunks.push("data <<EOF\n");
  chunks.push(content);
  chunks.push("EOF\n");
}

function buildFastImportPayload(commitCount: number): string {
  const chunks: string[] = [];
  let readmeContent = "# Scale fixture\n";
  let nextMark = 1;

  for (let index = 0; index < commitCount; index += 1) {
    const touchesReadme = index === 0 || index % 25 === 0;
    let readmeMark: number | undefined;

    if (touchesReadme) {
      if (index > 0) {
        readmeContent += `line ${index}\n`;
      }
      readmeMark = nextMark;
      nextMark += 1;
      appendBlob(chunks, String(readmeMark), readmeContent);
    }

    chunks.push("commit refs/heads/main\n");
    chunks.push(`mark :${nextMark}\n`);
    nextMark += 1;
    chunks.push(`${committerLine(index)}\n`);
    chunks.push("data <<EOF\n");
    chunks.push(
      index === 0
        ? "chore: scale fixture seed\n"
        : `chore: scale commit ${index}\n`,
    );
    chunks.push("EOF\n");

    if (readmeMark !== undefined) {
      chunks.push(`M 100644 :${readmeMark} README.md\n`);
    }
  }

  chunks.push("done\n");
  return chunks.join("");
}

export interface BuildScaleRepoOptions {
  commitCount?: number;
}

/**
 * Synthetic repository with many linear commits for scale benchmarks.
 * Uses git fast-import for bulk history; default 10k commits for CI gate.
 */
export function buildScaleRepo(options: BuildScaleRepoOptions = {}): BuiltRepo {
  const commitCount = options.commitCount ?? 10_000;
  if (commitCount < 1) {
    throw new Error(`commitCount must be >= 1, got ${commitCount}`);
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gitchange-scale-"));
  git(dir, ["init", "-b", "main"]);
  git(dir, ["config", "user.name", SCALE_AUTHOR.name]);
  git(dir, ["config", "user.email", SCALE_AUTHOR.email]);
  git(dir, ["fast-import"], { input: buildFastImportPayload(commitCount) });

  const headSha = resolveHeadSha(dir);
  const commitShas = listCommitShasOldestFirst(dir);

  if (commitShas.length !== commitCount) {
    throw new Error(
      `Expected ${commitCount} commits in scale fixture, got ${commitShas.length}`,
    );
  }

  return {
    dir,
    headSha,
    commitShas,
    cleanup: () => {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
