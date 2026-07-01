import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { buildRepo } from "../fixtures/builder.js";
import { BASIC_SCENARIO } from "../fixtures/scenarios.js";

const REPO_ROOT = join(fileURLToPath(import.meta.url), "../../..");
const CLI_BIN = join(REPO_ROOT, "packages/cli/src/bin.ts");

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

async function waitForHealth(port: number, timeoutMs = 10_000): Promise<void> {
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

function getListenAddress(port: number): string {
  return execFileSync("lsof", [`-iTCP:${port}`, "-sTCP:LISTEN", "-n", "-P"], {
    encoding: "utf8",
  });
}

describe("integration: gitchange serve and status CLI", () => {
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

  it("status reports indexed repo stats; serve exposes snapshot on localhost", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    cleanups.push(repo.cleanup);

    const indexResult = runGitchange(["index", "--repo", repo.dir]);
    expect(indexResult.exitCode).toBe(0);

    const manifestPath = join(repo.dir, ".gitchange", "manifest.json");
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      lastIndexedCommit: string;
    };

    const statusResult = runGitchange(["status", "--repo", repo.dir]);
    expect(statusResult.exitCode).toBe(0);
    expect(statusResult.stdout).toContain(manifest.lastIndexedCommit);
    expect(statusResult.stdout).toMatch(/commit/i);

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

    const listenOutput = getListenAddress(port);
    expect(listenOutput).toMatch(/127\.0\.0\.1/);
    expect(listenOutput).not.toMatch(/0\.0\.0\.0/);

    const snapshotResponse = await fetch(
      `http://127.0.0.1:${port}/api/snapshot`,
    );
    expect(snapshotResponse.status).toBe(200);

    const snapshot = (await snapshotResponse.json()) as {
      manifest: { schemaVersion: string };
      stats: { commitCount: number };
    };
    expect(snapshot.manifest.schemaVersion).toBeTruthy();
    expect(snapshot.stats.commitCount).toBeGreaterThanOrEqual(1);
  });
});
