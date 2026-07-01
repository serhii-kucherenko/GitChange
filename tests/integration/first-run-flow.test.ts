import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildRepo } from "../fixtures/builder.js";
import { BASIC_SCENARIO } from "../fixtures/scenarios.js";

const REPO_ROOT = join(fileURLToPath(import.meta.url), "../../..");
const CLI_BIN = join(REPO_ROOT, "packages/cli/src/bin.ts");
const DASHBOARD_DIST = join(REPO_ROOT, "packages/dashboard/dist");

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

describe("integration: first-run flow (index → status → serve → dashboard)", () => {
  const cleanups: Array<() => void> = [];
  let serveProcess: ChildProcess | undefined;

  beforeAll(() => {
    execFileSync("pnpm", ["build", "--filter=@gitchange/dashboard"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, NODE_OPTIONS: "" },
    });
    expect(existsSync(join(DASHBOARD_DIST, "index.html"))).toBe(true);
  });

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

  it("simulates a new user on BASIC_SCENARIO: index, status, serve, snapshot API, dashboard HTML", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    cleanups.push(repo.cleanup);

    const indexResult = runGitchange(["index", "--repo", repo.dir]);
    expect(indexResult.exitCode).toBe(0);
    expect(existsSync(join(repo.dir, ".gitchange", "manifest.json"))).toBe(true);

    const statusResult = runGitchange(["status", "--repo", repo.dir]);
    expect(statusResult.exitCode).toBe(0);
    expect(statusResult.stdout).toMatch(/Index completeness:\s+complete/i);
    expect(statusResult.stdout).toMatch(/Commits:\s+\d+/);

    const port = await getFreePort();
    serveProcess = spawn(
      "pnpm",
      ["exec", "tsx", CLI_BIN, "serve", "--repo", repo.dir],
      {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          NODE_OPTIONS: "",
          GITCHANGE_PORT: String(port),
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    await waitForHealth(port);

    const snapshotResponse = await fetch(
      `http://127.0.0.1:${port}/api/snapshot`,
    );
    expect(snapshotResponse.status).toBe(200);

    const snapshot = (await snapshotResponse.json()) as {
      manifest: { schemaVersion: string; indexCompleteness: string };
      stats: { commitCount: number };
    };
    expect(snapshot.manifest.schemaVersion).toBeTruthy();
    expect(snapshot.manifest.indexCompleteness).toBe("complete");
    expect(snapshot.stats.commitCount).toBeGreaterThanOrEqual(1);
    expect(statusResult.stdout).toMatch(
      new RegExp(`Commits:\\s+${snapshot.stats.commitCount}`),
    );

    const rootResponse = await fetch(`http://127.0.0.1:${port}/`);
    expect(rootResponse.status).toBe(200);
    const rootHtml = await rootResponse.text();
    expect(rootHtml).toContain("GitChange");
    expect(rootHtml).toMatch(/id="root"/);
  });
});
