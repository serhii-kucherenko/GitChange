import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const FIXTURE_AUTHOR = {
  name: "GitChange Fixture",
  email: "fixture@gitchange.test",
};

const FIXTURE_BASE_DATE = new Date("2024-01-15T12:00:00.000Z");

export interface CommitSpec {
  message: string;
  files?: Record<string, string | null>;
  renames?: Array<{ from: string; to: string }>;
  merge?: { intoBranch: string; fromBranch: string };
  branch?: string;
  authorName?: string;
  authorEmail?: string;
  committedAt?: Date;
}

export interface BuiltRepo {
  dir: string;
  headSha: string;
  commitShas: string[];
  cleanup: () => void;
}

function git(
  cwd: string,
  args: string[],
  env: Record<string, string> = {},
): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
  }).trim();
}

function gitEnvForCommit(spec: CommitSpec, index: number): Record<string, string> {
  const date = spec.committedAt ?? new Date(FIXTURE_BASE_DATE.getTime() + index * 60_000);
  const iso = date.toISOString();
  const name = spec.authorName ?? FIXTURE_AUTHOR.name;
  const email = spec.authorEmail ?? FIXTURE_AUTHOR.email;
  return {
    GIT_AUTHOR_NAME: name,
    GIT_AUTHOR_EMAIL: email,
    GIT_AUTHOR_DATE: iso,
    GIT_COMMITTER_NAME: name,
    GIT_COMMITTER_EMAIL: email,
    GIT_COMMITTER_DATE: iso,
  };
}

function ensureParentDir(filePath: string): void {
  const parent = path.dirname(filePath);
  if (!fs.existsSync(parent)) {
    fs.mkdirSync(parent, { recursive: true });
  }
}

function applyFiles(cwd: string, files: Record<string, string | null>): void {
  for (const [relPath, content] of Object.entries(files)) {
    const abs = path.join(cwd, relPath);
    if (content === null) {
      if (fs.existsSync(abs)) {
        fs.unlinkSync(abs);
      }
      continue;
    }
    ensureParentDir(abs);
    fs.writeFileSync(abs, content, "utf8");
  }
}

function applyRenames(cwd: string, renames: Array<{ from: string; to: string }>): void {
  for (const { from, to } of renames) {
    ensureParentDir(path.join(cwd, to));
    git(cwd, ["mv", from, to]);
  }
}

function checkoutBranch(cwd: string, branch: string): void {
  const branches = git(cwd, ["branch", "--list", branch]);
  if (branches.includes(branch)) {
    git(cwd, ["checkout", branch]);
  } else {
    git(cwd, ["checkout", "-b", branch]);
  }
}

function resolveHeadSha(cwd: string): string {
  return git(cwd, ["rev-parse", "HEAD"]);
}

function listCommitShasOldestFirst(cwd: string): string[] {
  const output = git(cwd, ["rev-list", "--reverse", "HEAD"]);
  return output ? output.split("\n") : [];
}

function hasMergeCommit(cwd: string): boolean {
  const shas = listCommitShasOldestFirst(cwd);
  for (const sha of shas) {
    const parents = git(cwd, ["rev-list", "--parents", "-n", "1", sha]);
    const parentCount = parents.split(" ").length - 1;
    if (parentCount >= 2) return true;
  }
  return false;
}

export function buildRepo(scenario: CommitSpec[]): BuiltRepo {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gitchange-fix-"));

  git(dir, ["init", "-b", "main"]);
  git(dir, ["config", "user.name", FIXTURE_AUTHOR.name]);
  git(dir, ["config", "user.email", FIXTURE_AUTHOR.email]);

  for (let i = 0; i < scenario.length; i++) {
    const spec = scenario[i];
    if (!spec) continue;

    if (spec.merge) {
      const { intoBranch, fromBranch } = spec.merge;
      git(dir, ["checkout", intoBranch]);
      git(dir, ["merge", "--no-ff", fromBranch, "-m", spec.message], gitEnvForCommit(spec, i));
      continue;
    }

    if (spec.branch) {
      checkoutBranch(dir, spec.branch);
    }

    if (spec.files) {
      applyFiles(dir, spec.files);
      const paths = Object.keys(spec.files);
      if (paths.length > 0) {
        git(dir, ["add", "--", ...paths]);
      }
    }

    if (spec.renames) {
      applyRenames(dir, spec.renames);
      const renamedPaths = spec.renames.map((r) => r.to);
      git(dir, ["add", "--", ...renamedPaths]);
    }

    const hasStaged = git(dir, ["diff", "--cached", "--name-only"]);
    if (hasStaged) {
      git(dir, ["commit", "-m", spec.message], gitEnvForCommit(spec, i));
    }
  }

  const headSha = resolveHeadSha(dir);
  const commitShas = listCommitShasOldestFirst(dir);

  if (!hasMergeCommit(dir) && scenario.some((s) => s.merge)) {
    throw new Error("Expected merge commit with 2 parents but none found");
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

export function shallowCloneOf(repo: BuiltRepo, depth: number): BuiltRepo {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gitchange-shallow-"));
  const fileUrl = `file://${repo.dir}`;
  execFileSync("git", ["clone", "--depth", String(depth), fileUrl, dir], {
    encoding: "utf8",
  });

  const headSha = resolveHeadSha(dir);
  const commitShas = listCommitShasOldestFirst(dir);

  return {
    dir,
    headSha,
    commitShas,
    cleanup: () => {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
