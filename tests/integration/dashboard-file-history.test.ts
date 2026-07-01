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

const FileHistoryResponseSchema = z.object({
  events: z.array(
    z.object({
      commitSha: z.string(),
      committedAt: z.number().int(),
      changeType: z.string(),
      summary: z.string(),
      path: z.string(),
      oldPath: z.string().nullable(),
    }),
  ),
  nextCursor: z.string().nullable(),
  order: z.literal("newest_first"),
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
    [
      "exec",
      "tsx",
      CLI_BIN,
      "serve",
      "--repo",
      repoDir,
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
  return { port, process: serveProcess };
}

describe("integration: dashboard file history API", () => {
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

  it("GET /api/files/:path/history returns >= 2 events for churned file", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    cleanups.push(repo.cleanup);

    const indexResult = runGitchange(["index", "--repo", repo.dir]);
    expect(indexResult.exitCode).toBe(0);

    const started = await startServer(repo.dir);
    serveProcess = started.process;

    const encodedPath = encodeURIComponent("src/feature.ts");
    const response = await fetch(
      `http://127.0.0.1:${started.port}/api/files/${encodedPath}/history`,
    );
    expect(response.status).toBe(200);

    const body = FileHistoryResponseSchema.parse(await response.json());
    expect(body.order).toBe("newest_first");
    expect(body.events.length).toBeGreaterThanOrEqual(2);
    expect(body.events.every((event) => event.path === "src/feature.ts")).toBe(
      true,
    );
  });

  it("returns empty events for unknown path", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    cleanups.push(repo.cleanup);

    const indexResult = runGitchange(["index", "--repo", repo.dir]);
    expect(indexResult.exitCode).toBe(0);

    const started = await startServer(repo.dir);
    serveProcess = started.process;

    const encodedPath = encodeURIComponent("missing/file.ts");
    const response = await fetch(
      `http://127.0.0.1:${started.port}/api/files/${encodedPath}/history`,
    );
    expect(response.status).toBe(200);

    const body = FileHistoryResponseSchema.parse(await response.json());
    expect(body.events).toEqual([]);
    expect(body.nextCursor).toBeNull();
  });

  it("rejects directory traversal paths with 400", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    cleanups.push(repo.cleanup);

    const indexResult = runGitchange(["index", "--repo", repo.dir]);
    expect(indexResult.exitCode).toBe(0);

    const started = await startServer(repo.dir);
    serveProcess = started.process;

    const encodedPath = encodeURIComponent("src/../etc/passwd");
    const response = await fetch(
      `http://127.0.0.1:${started.port}/api/files/${encodedPath}/history`,
    );
    expect(response.status).toBe(400);
  });
});
