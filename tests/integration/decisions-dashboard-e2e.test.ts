/**
 * Phase 6 acceptance gate: decisions + open-work drill-down via API.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { EVD03_GAP_MESSAGE } from "../../packages/core/src/decisions/threshold.js";
import { runDecisionsPipeline, runSemanticPipeline } from "../../packages/core/src/semantic/pipeline.js";
import { buildRepo } from "../fixtures/builder.js";
import { BASIC_SCENARIO } from "../fixtures/scenarios.js";
import { applyBasicScenarioDecisionsFixture } from "../golden/decisions-fixture.js";
import { applyBasicScenarioErasFixture } from "../golden/semantic-fixture.js";

const REPO_ROOT = join(fileURLToPath(import.meta.url), "../../..");
const CLI_BIN = join(REPO_ROOT, "packages/cli/src/bin.ts");

const DecisionListSchema = z.object({
  decisions: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      confidence: z.number(),
    }),
  ),
});

const OpenWorkListSchema = z.object({
  threads: z.array(
    z.object({
      id: z.string(),
      status: z.string(),
      title: z.string(),
    }),
  ),
});

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

describe("integration: Phase 6 decisions dashboard E2E", () => {
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

  it("decisions list → gap detail → open-work thread drill commit SHA", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    cleanups.push(repo.cleanup);

    const indexProcess = spawn(
      "pnpm",
      ["exec", "tsx", CLI_BIN, "index", "--repo", repo.dir],
      {
        cwd: REPO_ROOT,
        env: { ...globalThis.process.env, NODE_OPTIONS: "" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const indexExit = await new Promise<number>((resolve) => {
      indexProcess.on("exit", (code) => resolve(code ?? 1));
    });
    expect(indexExit).toBe(0);

    const gitchangeDir = join(repo.dir, ".gitchange");
    applyBasicScenarioErasFixture(gitchangeDir);
    runSemanticPipeline(gitchangeDir);
    applyBasicScenarioDecisionsFixture(gitchangeDir);
    runDecisionsPipeline(gitchangeDir);

    const { port, process: serverProcess } = await startServer(repo.dir);
    serveProcess = serverProcess;
    const base = `http://127.0.0.1:${port}/api`;

    const decisionsResponse = await fetch(`${base}/decisions`);
    expect(decisionsResponse.status).toBe(200);
    const decisionsBody = DecisionListSchema.parse(
      await decisionsResponse.json(),
    );
    expect(decisionsBody.decisions.length).toBeGreaterThanOrEqual(2);

    const lowConfidence = decisionsBody.decisions.find(
      (item) => item.confidence < 0.35,
    );
    if (lowConfidence) {
      const gapResponse = await fetch(
        `${base}/decisions/${encodeURIComponent(lowConfidence.id)}`,
      );
      expect(gapResponse.status).toBe(200);
      const gapBody = (await gapResponse.json()) as { gap?: string };
      expect(gapBody.gap).toBe(EVD03_GAP_MESSAGE);
    }

    const highConfidence = decisionsBody.decisions.find(
      (item) => item.confidence >= 0.35,
    );
    expect(highConfidence).toBeDefined();
    const detailResponse = await fetch(
      `${base}/decisions/${encodeURIComponent(highConfidence!.id)}`,
    );
    expect(detailResponse.status).toBe(200);
    const detail = (await detailResponse.json()) as {
      attribution?: { name: string; rationale: string };
      summary?: string;
    };
    expect(detail.summary ?? detail.attribution?.name).toBeTruthy();
    if (detail.attribution) {
      expect(detail.attribution.rationale.length).toBeGreaterThan(0);
    }

    const openWorkResponse = await fetch(`${base}/open-work`);
    expect(openWorkResponse.status).toBe(200);
    const openWorkBody = OpenWorkListSchema.parse(await openWorkResponse.json());
    expect(openWorkBody.threads.length).toBeGreaterThanOrEqual(1);

    const threadId = openWorkBody.threads[0]!.id;
    const threadResponse = await fetch(
      `${base}/open-work/${encodeURIComponent(threadId)}`,
    );
    expect(threadResponse.status).toBe(200);
    const thread = (await threadResponse.json()) as {
      events: Array<{ commitSha: string }>;
      order: string;
    };
    expect(thread.order).toBe("chronological");
    expect(thread.events.length).toBeGreaterThanOrEqual(1);

    const eventSha = thread.events[0]!.commitSha;
    const commitResponse = await fetch(`${base}/commits/${eventSha}`);
    expect(commitResponse.status).toBe(200);
  });
});
