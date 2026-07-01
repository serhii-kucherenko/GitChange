/**
 * DASH-02 milestone acceptance: timeline + temporal graph + tour player surfaces
 * reachable in one dashboard session via API smoke sequence (no live LLM).
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

const CommitsResponseSchema = z.object({
  commits: z.array(
    z.object({
      sha: z.string(),
      summary: z.string(),
    }),
  ),
});

const GraphResponseSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["era", "commit", "file", "contributor", "inflection"]),
    }),
  ),
  edges: z.array(z.unknown()),
});

const ToursResponseSchema = z.object({
  tours: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(["default", "role", "topic"]),
      title: z.string(),
    }),
  ),
  defaultTourId: z.string(),
});

function runGitchange(
  args: string[],
  options?: { cwd?: string },
): { exitCode: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync("pnpm", ["exec", "tsx", CLI_BIN, ...args], {
      cwd: options?.cwd ?? REPO_ROOT,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, NODE_OPTIONS: "" },
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

describe("integration: DASH-02 acceptance (timeline + graph + tours)", () => {
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
    "loads timeline commits, temporal graph nodes, and default tour in one session",
    async () => {
      const repo = buildRepo(BASIC_SCENARIO);
      cleanups.push(repo.cleanup);

      const indexResult = runGitchange(["index", "--repo", repo.dir]);
      expect(indexResult.exitCode).toBe(0);

      const gitchangeDir = join(repo.dir, ".gitchange");
      applyBasicScenarioErasFixture(gitchangeDir);
      runSemanticPipeline(gitchangeDir);
      applyBasicScenarioDecisionsFixture(gitchangeDir);
      runDecisionsPipeline(gitchangeDir);
      applyBasicScenarioToursFixture(gitchangeDir);

      const { port, process } = await startServer(repo.dir);
      serveProcess = process;
      const base = `http://127.0.0.1:${port}/api`;

      const commitsResponse = await fetch(`${base}/commits?limit=50`);
      expect(commitsResponse.status).toBe(200);
      const commitsBody = CommitsResponseSchema.parse(
        await commitsResponse.json(),
      );
      expect(commitsBody.commits.length).toBeGreaterThan(0);

      const graphResponse = await fetch(`${base}/graph`);
      expect(graphResponse.status).toBe(200);
      const graphBody = GraphResponseSchema.parse(await graphResponse.json());
      expect(graphBody.nodes.length).toBeGreaterThan(0);
      expect(graphBody.edges.length).toBeGreaterThanOrEqual(0);

      const toursResponse = await fetch(`${base}/tours`);
      expect(toursResponse.status).toBe(200);
      const toursBody = ToursResponseSchema.parse(await toursResponse.json());
      expect(toursBody.tours.length).toBeGreaterThanOrEqual(1);
      expect(toursBody.defaultTourId).toBeTruthy();
      expect(
        toursBody.tours.some((tour) => tour.id === toursBody.defaultTourId),
      ).toBe(true);

      const defaultTourResponse = await fetch(
        `${base}/tours/${encodeURIComponent(toursBody.defaultTourId)}`,
      );
      expect(defaultTourResponse.status).toBe(200);
    },
    60_000,
  );
});
