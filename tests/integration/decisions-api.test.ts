import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { writeDecisionsArtifact } from "../../packages/core/src/decisions/decisions-io.js";
import { writeOpenWorkArtifact } from "../../packages/core/src/decisions/open-work-io.js";
import { EVD03_GAP_MESSAGE } from "../../packages/core/src/decisions/threshold.js";
import { listCommits } from "../../packages/core/src/read/commits.js";
import {
  DECISIONS_SCHEMA_VERSION,
  DecisionRecord,
  DecisionsArtifact,
} from "../../packages/core/src/schema/zod/decisions.js";
import {
  OPEN_WORK_SCHEMA_VERSION,
  OpenWorkArtifact,
  OpenWorkThread,
} from "../../packages/core/src/schema/zod/open-work.js";
import { buildRepo } from "../fixtures/builder.js";
import { BASIC_SCENARIO } from "../fixtures/scenarios.js";

const REPO_ROOT = join(fileURLToPath(import.meta.url), "../../..");
const CLI_BIN = join(REPO_ROOT, "packages/cli/src/bin.ts");

const DecisionListResponseSchema = z.object({
  decisions: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      status: z.string(),
      reviewStatus: z.string(),
      confidence: z.number(),
      evidenceCount: z.number().int(),
    }),
  ),
  nextCursor: z.string().nullable(),
});

const OpenWorkListResponseSchema = z.object({
  threads: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      status: z.string(),
      title: z.string(),
      confidence: z.number(),
      lastEventAt: z.number().int().nullable(),
    }),
  ),
});

const OpenWorkThreadDetailSchema = z.object({
  id: z.string(),
  events: z.array(
    z.object({
      commitSha: z.string().length(40),
      committedAt: z.number().int(),
      summary: z.string(),
      paths: z.array(z.string()).min(1),
    }),
  ),
  order: z.literal("chronological"),
});

function sampleDecision(
  commitSha: string,
  overrides: Partial<DecisionRecord> = {},
): DecisionRecord {
  return DecisionRecord.parse({
    id: "decision:01HIGH",
    title: "SQLite index store",
    summary: "Local-first OLTP index in .gitchange/index.sqlite.",
    status: "accepted",
    confidence: 0.8,
    evidence: [{ type: "commit", sha: commitSha }],
    reviewStatus: "pending",
    miningSource: "deterministic",
    ...overrides,
  });
}

function sampleThread(commitSha: string): OpenWorkThread {
  return OpenWorkThread.parse({
    id: "thread:01MIG",
    kind: "migration",
    status: "in_progress",
    title: "API migration",
    summary: "Feature module still evolving.",
    confidence: 0.6,
    relatedPaths: ["src/main.ts"],
    events: [
      {
        commitSha,
        committedAt: 1_700_000_000_000,
        summary: "feat: initial wiring",
        paths: ["src/main.ts"],
      },
    ],
    evidence: [{ type: "commit", sha: commitSha }],
  });
}

function seedDecisionsFixture(
  gitchangeDir: string,
  headSha: string,
  commitSha: string,
): void {
  writeDecisionsArtifact(
    gitchangeDir,
    DecisionsArtifact.parse({
      schemaVersion: DECISIONS_SCHEMA_VERSION,
      computedAt: "2026-07-01T00:00:00.000Z",
      headSha,
      decisions: [
        sampleDecision(commitSha, { id: "decision:01HIGH", confidence: 0.8 }),
        sampleDecision(commitSha, {
          id: "decision:01LOW",
          title: "Uncertain pivot",
          summary: "Should not leak to API detail.",
          confidence: 0.2,
          evidence: [{ type: "commit", sha: commitSha }],
        }),
      ],
    }),
  );

  writeOpenWorkArtifact(
    gitchangeDir,
    OpenWorkArtifact.parse({
      schemaVersion: OPEN_WORK_SCHEMA_VERSION,
      computedAt: "2026-07-01T00:00:00.000Z",
      headSha,
      threads: [sampleThread(commitSha)],
    }),
  );
}

function readManifestHead(gitchangeDir: string): string {
  const manifest = JSON.parse(
    readFileSync(join(gitchangeDir, "manifest.json"), "utf-8"),
  ) as { repo: { head: string } };
  return manifest.repo.head;
}

function readIndexedCommitSha(gitchangeDir: string): string {
  const page = listCommits(gitchangeDir, { limit: 1 });
  const sha = page?.commits[0]?.sha;
  if (!sha) {
    throw new Error("fixture repo has no indexed commits");
  }
  return sha;
}

function runGitchange(
  args: string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv },
): { exitCode: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync("pnpm", ["exec", "tsx", CLI_BIN, ...args], {
      cwd: options?.cwd ?? REPO_ROOT,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, NODE_OPTIONS: "", ...options?.env },
    });
    return { exitCode: 0, stdout, stderr: "" };
  } catch (error) {
    const execError = error as NodeJS.ErrnoException & {
      status?: number;
      stdout?: string;
      stderr?: string;
    };
    return {
      exitCode: execError.status ?? 1,
      stdout: execError.stdout?.toString() ?? "",
      stderr: execError.stderr?.toString() ?? "",
    };
  }
}

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port =
        typeof address === "object" && address !== null ? address.port : 0;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
    server.on("error", reject);
  });
}

async function waitForHealth(port: number, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not become ready on port ${port}`);
}

async function startServer(repoDir: string): Promise<{
  port: number;
  process: ChildProcess;
}> {
  const port = await getFreePort();
  const serveProcess = spawn(
    "pnpm",
    ["exec", "tsx", CLI_BIN, "serve", "--repo", repoDir, "--port", String(port)],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, NODE_OPTIONS: "" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  await waitForHealth(port);
  return { port, process: serveProcess };
}

describe("integration: decisions and open-work API", () => {
  const cleanups: Array<() => void> = [];
  let serveProcess: ChildProcess | undefined;

  afterEach(async () => {
    if (serveProcess && !serveProcess.killed) {
      serveProcess.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        serveProcess?.on("exit", () => resolve());
        setTimeout(resolve, 2_000);
      });
      serveProcess = undefined;
    }
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("returns 404 when decisions.json is missing", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    cleanups.push(repo.cleanup);

    const indexResult = runGitchange(["index", "--repo", repo.dir]);
    expect(indexResult.exitCode).toBe(0);

    const { port, process } = await startServer(repo.dir);
    serveProcess = process;

    const response = await fetch(`http://127.0.0.1:${port}/api/decisions`);
    expect(response.status).toBe(404);
  });

  it("lists decisions and returns EVD-03 gap detail without summary", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    cleanups.push(repo.cleanup);

    const indexResult = runGitchange(["index", "--repo", repo.dir]);
    expect(indexResult.exitCode).toBe(0);

    const gitchangeDir = join(repo.dir, ".gitchange");
    const headSha = readManifestHead(gitchangeDir);
    const commitSha = readIndexedCommitSha(gitchangeDir);
    seedDecisionsFixture(gitchangeDir, headSha, commitSha);

    const { port, process } = await startServer(repo.dir);
    serveProcess = process;

    const listResponse = await fetch(`http://127.0.0.1:${port}/api/decisions`);
    expect(listResponse.status).toBe(200);
    const listBody = DecisionListResponseSchema.parse(await listResponse.json());
    expect(listBody.decisions.length).toBeGreaterThanOrEqual(2);
    expect(listBody.decisions[0]?.confidence).toBeGreaterThanOrEqual(
      listBody.decisions[1]?.confidence ?? 0,
    );

    const gapResponse = await fetch(
      `http://127.0.0.1:${port}/api/decisions/decision:01LOW`,
    );
    expect(gapResponse.status).toBe(200);
    const gapBody = (await gapResponse.json()) as Record<string, unknown>;
    expect(gapBody.gap).toBe(EVD03_GAP_MESSAGE);
    expect(gapBody.evidence).toEqual([]);
    expect(gapBody.summary).toBeUndefined();
    expect(gapBody.title).toBeUndefined();

    const recordResponse = await fetch(
      `http://127.0.0.1:${port}/api/decisions/decision:01HIGH`,
    );
    expect(recordResponse.status).toBe(200);
    const recordBody = (await recordResponse.json()) as Record<string, unknown>;
    expect(recordBody.summary).toContain("sqlite");
    expect(recordBody.gap).toBeUndefined();
  });

  it("returns open-work threads with chronological events and resolvable commit SHAs", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    cleanups.push(repo.cleanup);

    const indexResult = runGitchange(["index", "--repo", repo.dir]);
    expect(indexResult.exitCode).toBe(0);

    const gitchangeDir = join(repo.dir, ".gitchange");
    const headSha = readManifestHead(gitchangeDir);
    const commitSha = readIndexedCommitSha(gitchangeDir);
    seedDecisionsFixture(gitchangeDir, headSha, commitSha);

    const { port, process } = await startServer(repo.dir);
    serveProcess = process;

    const listResponse = await fetch(`http://127.0.0.1:${port}/api/open-work`);
    expect(listResponse.status).toBe(200);
    const listBody = OpenWorkListResponseSchema.parse(await listResponse.json());
    expect(listBody.threads.length).toBeGreaterThanOrEqual(1);

    const threadId = listBody.threads[0]?.id;
    expect(threadId).toBeTruthy();

    const detailResponse = await fetch(
      `http://127.0.0.1:${port}/api/open-work/${threadId}`,
    );
    expect(detailResponse.status).toBe(200);
    const detailBody = OpenWorkThreadDetailSchema.parse(
      await detailResponse.json(),
    );
    expect(detailBody.events.length).toBeGreaterThanOrEqual(1);

    for (const event of detailBody.events) {
      const commitResponse = await fetch(
        `http://127.0.0.1:${port}/api/commits/${event.commitSha}`,
      );
      expect(commitResponse.status).toBe(200);
    }
  });
});
