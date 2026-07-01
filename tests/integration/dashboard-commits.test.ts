import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { buildRepo } from "../fixtures/builder.js";
import { BASIC_SCENARIO } from "../fixtures/scenarios.js";

const REPO_ROOT = join(fileURLToPath(import.meta.url), "../../..");
const CLI_BIN = join(REPO_ROOT, "packages/cli/src/bin.ts");

const CommitSummarySchema = z.object({
  sha: z.string(),
  summary: z.string(),
  committedAt: z.number().int(),
  authorName: z.string(),
  authorEmail: z.string(),
});

const CommitsResponseSchema = z.object({
  commits: z.array(CommitSummarySchema),
  nextCursor: z.string().nullable(),
});

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

describe("integration: dashboard commits API", () => {
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

  it("GET /api/commits returns paginated commits aligned with snapshot commitCount", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    cleanups.push(repo.cleanup);

    const indexResult = runGitchange(["index", "--repo", repo.dir]);
    expect(indexResult.exitCode).toBe(0);

    const port = await getFreePort();
    serveProcess = spawn(
      "pnpm",
      [
        "exec",
        "tsx",
        CLI_BIN,
        "serve",
        "--repo",
        repo.dir,
        "--port",
        String(port),
      ],
      {
        cwd: REPO_ROOT,
        env: { ...process.env, NODE_OPTIONS: "" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    await waitForHealth(port);

    const snapshotResponse = await fetch(
      `http://127.0.0.1:${port}/api/snapshot`,
    );
    expect(snapshotResponse.status).toBe(200);
    const snapshot = (await snapshotResponse.json()) as {
      stats: { commitCount: number };
    };

    const commitsResponse = await fetch(
      `http://127.0.0.1:${port}/api/commits?limit=10`,
    );
    expect(commitsResponse.status).toBe(200);

    const body = CommitsResponseSchema.parse(await commitsResponse.json());
    expect(body.commits.length).toBeGreaterThanOrEqual(1);
    expect(body.commits.length).toBeLessThanOrEqual(10);

    const allShas = new Set<string>();
    let cursor: string | null = null;
    let totalFetched = 0;

    do {
      const url = cursor
        ? `http://127.0.0.1:${port}/api/commits?limit=10&cursor=${encodeURIComponent(cursor)}`
        : `http://127.0.0.1:${port}/api/commits?limit=10`;
      const pageResponse = await fetch(url);
      expect(pageResponse.status).toBe(200);
      const page = CommitsResponseSchema.parse(await pageResponse.json());

      for (const commit of page.commits) {
        expect(allShas.has(commit.sha)).toBe(false);
        allShas.add(commit.sha);
      }

      totalFetched += page.commits.length;
      cursor = page.nextCursor;
    } while (cursor !== null);

    expect(totalFetched).toBe(snapshot.stats.commitCount);
  });

  it("returns 400 for malformed cursor", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    cleanups.push(repo.cleanup);

    const indexResult = runGitchange(["index", "--repo", repo.dir]);
    expect(indexResult.exitCode).toBe(0);

    const port = await getFreePort();
    serveProcess = spawn(
      "pnpm",
      [
        "exec",
        "tsx",
        CLI_BIN,
        "serve",
        "--repo",
        repo.dir,
        "--port",
        String(port),
      ],
      {
        cwd: REPO_ROOT,
        env: { ...process.env, NODE_OPTIONS: "" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    await waitForHealth(port);

    const response = await fetch(
      `http://127.0.0.1:${port}/api/commits?cursor=not-valid`,
    );
    expect(response.status).toBe(400);
  });
});
