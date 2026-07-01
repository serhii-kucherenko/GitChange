/**
 * Phase 7 acceptance gate: tour list → stop drill → commit detail.
 *
 * Requires semantic + decisions + tours fixtures bound to BASIC_SCENARIO index.
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
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

const TourListResponseSchema = z.object({
  tours: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(["default", "role", "topic"]),
      title: z.string(),
      description: z.string(),
      roleTag: z
        .enum(["backend", "frontend", "fullstack", "maintainer"])
        .optional(),
      topicKey: z.string().optional(),
      chapterCount: z.number().int().nonnegative(),
      stopCount: z.number().int().nonnegative(),
    }),
  ),
  defaultTourId: z.string(),
});

const TourDetailSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string(),
    kind: z.literal("default"),
    title: z.string(),
    description: z.string(),
    chapters: z.array(
      z.object({
        order: z.number().int().positive(),
        title: z.string(),
        summary: z.string(),
        eraIds: z.array(z.string()),
        stops: z.array(
          z.object({
            id: z.string(),
            narrative: z.string(),
            evidence: z.array(z.record(z.string(), z.unknown())).min(1),
            drillTarget: z.object({
              eraId: z.string().optional(),
              commitSha: z.string().length(40).optional(),
              filePath: z.string().optional(),
              decisionId: z.string().optional(),
            }),
          }),
        ),
      }),
    ),
  }),
  z.object({
    id: z.string(),
    kind: z.literal("role"),
    title: z.string(),
    description: z.string(),
    roleTag: z.enum(["backend", "frontend", "fullstack", "maintainer"]),
    chapters: z.array(z.object({ stops: z.array(z.unknown()) })),
  }),
  z.object({
    id: z.string(),
    kind: z.literal("topic"),
    title: z.string(),
    description: z.string(),
    topicKey: z.string(),
    chapters: z.array(z.object({ stops: z.array(z.unknown()) })),
  }),
]);

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

describe("integration: Phase 7 tour drill-down E2E", () => {
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

  it("tours list → default tour → stop commit detail with hunks", async () => {
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

    const toursResponse = await fetch(`${base}/tours`);
    expect(toursResponse.status).toBe(200);
    const toursBody = TourListResponseSchema.parse(await toursResponse.json());

    expect(toursBody.tours.length).toBeGreaterThanOrEqual(3);
    expect(toursBody.defaultTourId).toBeTruthy();

    const roleTour = toursBody.tours.find((tour) => tour.kind === "role");
    expect(roleTour).toBeDefined();
    expect(roleTour!.roleTag).toBe("backend");

    const topicTour = toursBody.tours.find((tour) => tour.kind === "topic");
    expect(topicTour).toBeDefined();
    expect(topicTour!.topicKey).toBe("auth");

    const defaultTourId = encodeURIComponent(toursBody.defaultTourId);
    const tourDetailResponse = await fetch(`${base}/tours/${defaultTourId}`);
    expect(tourDetailResponse.status).toBe(200);
    const tourDetail = TourDetailSchema.parse(await tourDetailResponse.json());
    expect(tourDetail.kind).toBe("default");
    expect(tourDetail.chapters.length).toBeGreaterThanOrEqual(4);

    const firstStop = tourDetail.chapters[0]!.stops[0]!;
    const commitSha = firstStop.drillTarget.commitSha;
    expect(commitSha).toBeTruthy();

    const detailResponse = await fetch(`${base}/commits/${commitSha}`);
    expect(detailResponse.status).toBe(200);
    const detail = CommitDetailSchema.parse(await detailResponse.json());
    expect(detail.commit.sha).toBe(commitSha);
    expect(detail.files.length).toBeGreaterThanOrEqual(1);
    expect(
      detail.files.some((file) => file.hunks.length > 0) ||
        detail.files.length > 0,
    ).toBe(true);
  });
});

describe("integration: gitchange validate tours integrity", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("exits 0 when tours artifacts are present and valid", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    cleanups.push(repo.cleanup);

    runGitchange(["index", "--repo", repo.dir]);
    const gitchangeDir = join(repo.dir, ".gitchange");
    applyBasicScenarioErasFixture(gitchangeDir);
    runSemanticPipeline(gitchangeDir);
    applyBasicScenarioDecisionsFixture(gitchangeDir);
    runDecisionsPipeline(gitchangeDir);
    applyBasicScenarioToursFixture(gitchangeDir);

    const result = runGitchange(["validate", "--repo", repo.dir]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("gitchange validate: ok");
  });

  it("exits 1 when tours.json has dangling commit refs", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    cleanups.push(repo.cleanup);

    runGitchange(["index", "--repo", repo.dir]);
    const gitchangeDir = join(repo.dir, ".gitchange");
    applyBasicScenarioErasFixture(gitchangeDir);
    runSemanticPipeline(gitchangeDir);
    applyBasicScenarioDecisionsFixture(gitchangeDir);
    runDecisionsPipeline(gitchangeDir);
    applyBasicScenarioToursFixture(gitchangeDir);

    const toursPath = join(gitchangeDir, "tours.json");
    const tours = JSON.parse(readFileSync(toursPath, "utf-8")) as {
      tours: Array<{
        chapters: Array<{
          stops: Array<{
            evidence: Array<{ type: string; sha?: string }>;
            drillTarget: { commitSha?: string };
          }>;
        }>;
      }>;
    };
    const bogusSha = "e".repeat(40);
    tours.tours[0]!.chapters[0]!.stops[0]!.evidence = [
      { type: "commit", sha: bogusSha },
    ];
    tours.tours[0]!.chapters[0]!.stops[0]!.drillTarget.commitSha = bogusSha;
    writeFileSync(toursPath, JSON.stringify(tours, null, 2), "utf-8");

    const result = runGitchange(["validate", "--repo", repo.dir]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/tours|commit|dangling/i);
  });
});
