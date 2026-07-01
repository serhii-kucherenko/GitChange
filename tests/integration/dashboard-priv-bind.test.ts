/**
 * PRIV-04: gitchange serve must bind localhost by default.
 * Verifies default host is 127.0.0.1 and --host 0.0.0.0 emits a stderr warning.
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
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

function getListenAddress(port: number): string {
  return execFileSync("lsof", [`-iTCP:${port}`, "-sTCP:LISTEN", "-n", "-P"], {
    encoding: "utf8",
  });
}

function collectStderr(process: ChildProcess, timeoutMs = 3_000): Promise<string> {
  return new Promise((resolve) => {
    const chunks: string[] = [];
    process.stderr?.on("data", (chunk: Buffer | string) => {
      chunks.push(chunk.toString());
    });
    setTimeout(() => resolve(chunks.join("")), timeoutMs);
  });
}

describe("integration: PRIV-04 localhost bind policy", () => {
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

  it("serve without --host listens on 127.0.0.1 only", async () => {
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

    const listenOutput = getListenAddress(port);
    expect(listenOutput).toMatch(/127\.0\.0\.1/);
    expect(listenOutput).not.toMatch(/0\.0\.0\.0/);

    const health = await fetch(`http://127.0.0.1:${port}/api/health`);
    expect(health.status).toBe(200);
  });

  it("serve --host 0.0.0.0 logs unsafe bind warning on stderr", async () => {
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
        "--host",
        "0.0.0.0",
      ],
      {
        cwd: REPO_ROOT,
        env: { ...process.env, NODE_OPTIONS: "" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    const stderr = await collectStderr(serveProcess);
    expect(stderr).toMatch(/0\.0\.0\.0 exposes the API on all interfaces/i);

    await waitForHealth(port);
    const health = await fetch(`http://127.0.0.1:${port}/api/health`);
    expect(health.status).toBe(200);
  });
});
