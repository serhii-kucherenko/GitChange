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

async function startIndexedServer(repoDir: string): Promise<{
  port: number;
  process: ChildProcess;
}> {
  const indexResult = runGitchange(["index", "--repo", repoDir]);
  expect(indexResult.exitCode).toBe(0);

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

describe("integration: dashboard commit filters API", () => {
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

  it("GET /api/commits?author=fixture returns matching subset", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    cleanups.push(repo.cleanup);

    const server = await startIndexedServer(repo.dir);
    serveProcess = server.process;

    const allResponse = await fetch(
      `http://127.0.0.1:${server.port}/api/commits?limit=50`,
    );
    expect(allResponse.status).toBe(200);
    const allBody = CommitsResponseSchema.parse(await allResponse.json());

    const filteredResponse = await fetch(
      `http://127.0.0.1:${server.port}/api/commits?author=fixture&limit=50`,
    );
    expect(filteredResponse.status).toBe(200);
    const filteredBody = CommitsResponseSchema.parse(
      await filteredResponse.json(),
    );

    expect(filteredBody.commits.length).toBeGreaterThan(0);
    expect(filteredBody.commits.length).toBeLessThanOrEqual(
      allBody.commits.length,
    );
    for (const commit of filteredBody.commits) {
      expect(commit.authorEmail.toLowerCase()).toContain("fixture");
    }
  });

  it("GET /api/commits?path=src returns commits touching src paths", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    cleanups.push(repo.cleanup);

    const server = await startIndexedServer(repo.dir);
    serveProcess = server.process;

    const response = await fetch(
      `http://127.0.0.1:${server.port}/api/commits?path=src&limit=50`,
    );
    expect(response.status).toBe(200);
    const body = CommitsResponseSchema.parse(await response.json());

    expect(body.commits.length).toBeGreaterThan(0);
    expect(
      body.commits.every((commit) =>
        commit.summary.toLowerCase().includes("scaffold"),
      ),
    ).toBe(false);
  });

  it("GET /api/commits?q=scaffold returns keyword matches", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    cleanups.push(repo.cleanup);

    const server = await startIndexedServer(repo.dir);
    serveProcess = server.process;

    const response = await fetch(
      `http://127.0.0.1:${server.port}/api/commits?q=scaffold&limit=50`,
    );
    expect(response.status).toBe(200);
    const body = CommitsResponseSchema.parse(await response.json());

    expect(body.commits).toHaveLength(1);
    expect(body.commits[0]?.summary.toLowerCase()).toContain("scaffold");
  });

  it("GET /api/commits?after and before accept unix and ISO dates", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    cleanups.push(repo.cleanup);

    const server = await startIndexedServer(repo.dir);
    serveProcess = server.process;

    const allResponse = await fetch(
      `http://127.0.0.1:${server.port}/api/commits?limit=50`,
    );
    const allBody = CommitsResponseSchema.parse(await allResponse.json());
    const oldest = allBody.commits.at(-1);
    expect(oldest).toBeDefined();

    const unixResponse = await fetch(
      `http://127.0.0.1:${server.port}/api/commits?after=${Math.floor((oldest?.committedAt ?? 0) / 1000)}&limit=50`,
    );
    expect(unixResponse.status).toBe(200);
    const unixBody = CommitsResponseSchema.parse(await unixResponse.json());
    expect(unixBody.commits.length).toBeGreaterThan(0);

    const newest = allBody.commits[0];
    const isoResponse = await fetch(
      `http://127.0.0.1:${server.port}/api/commits?before=${encodeURIComponent("2024-01-15T13:00:00.000Z")}&limit=50`,
    );
    expect(isoResponse.status).toBe(200);
    const isoBody = CommitsResponseSchema.parse(await isoResponse.json());
    expect(isoBody.commits.length).toBeGreaterThan(0);
    if (newest) {
      for (const commit of isoBody.commits) {
        expect(commit.committedAt).toBeLessThanOrEqual(newest.committedAt);
      }
    }
  });

  it("returns 400 for invalid after date", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    cleanups.push(repo.cleanup);

    const server = await startIndexedServer(repo.dir);
    serveProcess = server.process;

    const response = await fetch(
      `http://127.0.0.1:${server.port}/api/commits?after=not-a-date`,
    );
    expect(response.status).toBe(400);
  });
});
