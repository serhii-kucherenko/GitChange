import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { listErasForDashboard } from "../../packages/core/src/read/eras.js";
import { buildRepo } from "../fixtures/builder.js";
import { BASIC_SCENARIO } from "../fixtures/scenarios.js";
import { applyBasicScenarioErasFixture } from "../golden/semantic-fixture.js";

const REPO_ROOT = join(fileURLToPath(import.meta.url), "../../..");
const CLI_BIN = join(REPO_ROOT, "packages/cli/src/bin.ts");

const DashboardEraSchema = z.object({
  id: z.string(),
  name: z.string(),
  summary: z.string(),
  startCommitSha: z.string(),
  endCommitSha: z.string(),
  startAt: z.number().int(),
  endAt: z.number().int(),
  inflections: z.array(
    z.object({
      type: z.enum([
        "tech_pivot",
        "scope_steering",
        "process_shift",
        "team_ownership_change",
      ]),
      title: z.string(),
      description: z.string(),
      evidence: z.array(z.record(z.string(), z.unknown())).min(1),
    }),
  ),
  claims: z.array(
    z.object({
      text: z.string(),
      evidence: z.array(z.record(z.string(), z.unknown())).min(1),
    }),
  ),
  commitCountInWindow: z.number().int().nonnegative(),
});

const ErasResponseSchema = z.array(DashboardEraSchema);

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

describe("integration: dashboard eras API", () => {
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

  it("returns 404 when eras.json is missing", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    cleanups.push(repo.cleanup);

    const indexResult = runGitchange(["index", "--repo", repo.dir]);
    expect(indexResult.exitCode).toBe(0);

    const { port, process } = await startServer(repo.dir);
    serveProcess = process;

    const response = await fetch(`http://127.0.0.1:${port}/api/eras`);
    expect(response.status).toBe(404);
  });

  it("GET /api/eras returns era list with commit counts after semantic fixture", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    cleanups.push(repo.cleanup);

    const indexResult = runGitchange(["index", "--repo", repo.dir]);
    expect(indexResult.exitCode).toBe(0);

    const gitchangeDir = join(repo.dir, ".gitchange");
    applyBasicScenarioErasFixture(gitchangeDir);

    const { port, process } = await startServer(repo.dir);
    serveProcess = process;

    const response = await fetch(`http://127.0.0.1:${port}/api/eras`);
    expect(response.status).toBe(200);

    const eras = ErasResponseSchema.parse(await response.json());
    expect(eras.length).toBeGreaterThanOrEqual(1);

    for (const era of eras) {
      expect(era.commitCountInWindow).toBeGreaterThanOrEqual(1);
      expect(era.claims.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("era window after/before filters commits to era commit count", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    cleanups.push(repo.cleanup);

    const indexResult = runGitchange(["index", "--repo", repo.dir]);
    expect(indexResult.exitCode).toBe(0);

    const gitchangeDir = join(repo.dir, ".gitchange");
    applyBasicScenarioErasFixture(gitchangeDir);

    const dashboardEras = listErasForDashboard(gitchangeDir)?.eras ?? [];
    expect(dashboardEras.length).toBeGreaterThanOrEqual(1);

    const firstEra = dashboardEras[0]!;

    const after = Math.floor(firstEra.startAt / 1000);
    const before = Math.floor(firstEra.endAt / 1000);

    const { port, process } = await startServer(repo.dir);
    serveProcess = process;

    const filteredResponse = await fetch(
      `http://127.0.0.1:${port}/api/commits?after=${after}&before=${before}&limit=200`,
    );
    expect(filteredResponse.status).toBe(200);

    const filtered = (await filteredResponse.json()) as {
      commits: Array<{ sha: string }>;
    };
    expect(filtered.commits.length).toBe(firstEra.commitCountInWindow);
  });
});
