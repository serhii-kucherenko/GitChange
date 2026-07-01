/**
 * Phase 5 acceptance gate: full drill-down path via API only.
 *
 * Requires semantic fixture (eras.json) after index — era portion depends on
 * applyBasicScenarioErasFixture binding template eras to indexed commits.
 *
 * Flow: eras → era-window commits → commit detail hunks → file history.
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { buildRepo } from "../fixtures/builder.js";
import { BASIC_SCENARIO } from "../fixtures/scenarios.js";
import { applyBasicScenarioErasFixture } from "../golden/semantic-fixture.js";

const REPO_ROOT = join(fileURLToPath(import.meta.url), "../../..");
const CLI_BIN = join(REPO_ROOT, "packages/cli/src/bin.ts");

const EraSchema = z.object({
  id: z.string(),
  name: z.string(),
  startAt: z.number().int(),
  endAt: z.number().int(),
  commitCountInWindow: z.number().int().nonnegative(),
});

const CommitDetailSchema = z.object({
  commit: z.object({ sha: z.string() }),
  files: z.array(
    z.object({
      path: z.string(),
      hunks: z.array(
        z.object({
          startLine: z.number().int(),
          endLine: z.number().int(),
          patch: z.string(),
        }),
      ),
    }),
  ),
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

describe("integration: Phase 5 drill-down E2E", () => {
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

  it("era select → commits → hunk detail → file history on fixture", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    cleanups.push(repo.cleanup);

    const indexResult = runGitchange(["index", "--repo", repo.dir]);
    expect(indexResult.exitCode).toBe(0);

    const gitchangeDir = join(repo.dir, ".gitchange");
    applyBasicScenarioErasFixture(gitchangeDir);

    const { port, process } = await startServer(repo.dir);
    serveProcess = process;
    const base = `http://127.0.0.1:${port}/api`;

    const erasResponse = await fetch(`${base}/eras`);
    expect(erasResponse.status).toBe(200);
    const eras = z.array(EraSchema).parse(await erasResponse.json());
    expect(eras.length).toBeGreaterThanOrEqual(1);

    const era = eras[0]!;
    const after = Math.floor(era.startAt / 1000);
    const before = Math.floor(era.endAt / 1000);

    const commitsResponse = await fetch(
      `${base}/commits?after=${after}&before=${before}&limit=200`,
    );
    expect(commitsResponse.status).toBe(200);
    const commitsBody = (await commitsResponse.json()) as {
      commits: Array<{ sha: string }>;
    };
    expect(commitsBody.commits.length).toBe(era.commitCountInWindow);
    expect(commitsBody.commits.length).toBeGreaterThanOrEqual(1);

    const commitSha = commitsBody.commits[0]!.sha;
    const detailResponse = await fetch(`${base}/commits/${commitSha}`);
    expect(detailResponse.status).toBe(200);
    const detail = CommitDetailSchema.parse(await detailResponse.json());
    expect(detail.commit.sha).toBe(commitSha);

    const featureCommitIdx = BASIC_SCENARIO.findIndex((spec) =>
      spec.message?.includes("wire endpoint"),
    );
    const featureSha = repo.commitShas[featureCommitIdx];
    const featureDetailResponse = await fetch(`${base}/commits/${featureSha}`);
    expect(featureDetailResponse.status).toBe(200);
    const featureDetail = CommitDetailSchema.parse(
      await featureDetailResponse.json(),
    );
    const featureFile = featureDetail.files.find(
      (file) => file.path === "src/feature.ts",
    );
    expect(featureFile).toBeDefined();
    expect(featureFile!.hunks.length).toBeGreaterThanOrEqual(1);

    const encodedPath = encodeURIComponent("src/feature.ts");
    const historyResponse = await fetch(
      `${base}/files/${encodedPath}/history`,
    );
    expect(historyResponse.status).toBe(200);
    const history = (await historyResponse.json()) as {
      events: Array<{ path: string; commitSha: string }>;
      order: string;
    };
    expect(history.order).toBe("newest_first");
    expect(history.events.length).toBeGreaterThanOrEqual(2);
    expect(
      history.events.every((event) => event.path === "src/feature.ts"),
    ).toBe(true);
  });
});
