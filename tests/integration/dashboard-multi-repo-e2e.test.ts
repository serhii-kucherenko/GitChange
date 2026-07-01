/**
 * Phase 8 MULTI-01/02 + SCALE-01: federated workspace dashboard E2E.
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { runDecisionsPipeline, runSemanticPipeline } from "../../packages/core/src/semantic/pipeline.js";
import { buildRepo } from "../fixtures/builder.js";
import { BASIC_SCENARIO } from "../fixtures/scenarios.js";
import { applyBasicScenarioDecisionsFixture } from "../golden/decisions-fixture.js";
import { applyBasicScenarioErasFixture } from "../golden/semantic-fixture.js";
import { applyBasicScenarioToursFixture } from "../golden/tours-fixture.js";

const REPO_ROOT = join(fileURLToPath(import.meta.url), "../../..");
const CLI_BIN = join(REPO_ROOT, "packages/cli/src/bin.ts");

const WorkspaceResponseSchema = z.object({
  isMultiRepo: z.boolean(),
  primaryRepoId: z.string().nullable(),
  repos: z.array(
    z.object({
      repoId: z.string(),
      label: z.string(),
    }),
  ),
  links: z.array(z.unknown()),
});

const CommitsResponseSchema = z.object({
  commits: z.array(
    z.object({
      sha: z.string(),
      repoId: z.string().optional(),
    }),
  ),
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

async function bindScenarioArtifacts(gitchangeDir: string): Promise<void> {
  applyBasicScenarioErasFixture(gitchangeDir);
  runSemanticPipeline(gitchangeDir);
  applyBasicScenarioDecisionsFixture(gitchangeDir);
  runDecisionsPipeline(gitchangeDir);
  applyBasicScenarioToursFixture(gitchangeDir);
}

describe("integration: multi-repo workspace dashboard E2E", () => {
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

  it(
    "workspace index → serve → federated commits with repo badges and incremental re-index",
    async () => {
      const primary = buildRepo(BASIC_SCENARIO);
      const secondary = buildRepo(BASIC_SCENARIO);
      cleanups.push(primary.cleanup, secondary.cleanup);

      const addPrimary = runGitchange(
        [
          "workspace",
          "add",
          primary.dir,
          "--label",
          "Primary",
          "--id",
          "alpha",
          "--cwd",
          primary.dir,
        ],
      );
      expect(addPrimary.exitCode).toBe(0);

      const addSecondary = runGitchange(
        [
          "workspace",
          "add",
          secondary.dir,
          "--label",
          "Secondary",
          "--id",
          "beta",
          "--cwd",
          primary.dir,
        ],
      );
      expect(addSecondary.exitCode).toBe(0);

      const firstIndex = runGitchange(["workspace", "index", "--cwd", primary.dir]);
      expect(firstIndex.exitCode).toBe(0);
      expect(firstIndex.stdout).toMatch(/Indexed alpha: \d+ commit/);
      expect(firstIndex.stdout).toMatch(/Indexed beta: \d+ commit/);

      const secondIndex = runGitchange(["workspace", "index", "--cwd", primary.dir]);
      expect(secondIndex.exitCode).toBe(0);
      expect(secondIndex.stdout).toMatch(/Indexed alpha: 0 commit/);
      expect(secondIndex.stdout).toMatch(/Indexed beta: 0 commit/);

      await bindScenarioArtifacts(join(primary.dir, ".gitchange"));
      await bindScenarioArtifacts(join(secondary.dir, ".gitchange"));

      const { port, process } = await startServer(primary.dir);
      serveProcess = process;
      const base = `http://127.0.0.1:${port}/api`;

      const workspaceResponse = await fetch(`${base}/workspace`);
      expect(workspaceResponse.status).toBe(200);
      const workspace = WorkspaceResponseSchema.parse(
        await workspaceResponse.json(),
      );
      expect(workspace.isMultiRepo).toBe(true);
      expect(workspace.repos).toHaveLength(2);
      expect(workspace.repos.map((repo) => repo.repoId).sort()).toEqual([
        "alpha",
        "beta",
      ]);

      const commitsResponse = await fetch(`${base}/commits?limit=200`);
      expect(commitsResponse.status).toBe(200);
      const commitsBody = CommitsResponseSchema.parse(
        await commitsResponse.json(),
      );
      expect(commitsBody.commits.length).toBeGreaterThan(0);

      const repoIds = new Set(
        commitsBody.commits.map((commit) => commit.repoId).filter(Boolean),
      );
      expect(repoIds).toEqual(new Set(["alpha", "beta"]));

      const alphaOnly = CommitsResponseSchema.parse(
        await (await fetch(`${base}/commits?repoId=alpha&limit=200`)).json(),
      );
      expect(alphaOnly.commits.length).toBeGreaterThan(0);
      expect(alphaOnly.commits.every((commit) => commit.repoId === "alpha")).toBe(
        true,
      );

      const betaOnly = CommitsResponseSchema.parse(
        await (await fetch(`${base}/commits?repoId=beta&limit=200`)).json(),
      );
      expect(betaOnly.commits.length).toBeGreaterThan(0);
      expect(betaOnly.commits.every((commit) => commit.repoId === "beta")).toBe(
        true,
      );
    },
    120_000,
  );
});
