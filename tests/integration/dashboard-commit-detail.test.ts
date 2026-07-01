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

const CommitDetailResponseSchema = z.object({
  commit: z.object({
    sha: z.string(),
    summary: z.string(),
    message: z.string(),
    committedAt: z.number().int(),
    authorName: z.string(),
    authorEmail: z.string(),
  }),
  files: z.array(
    z.object({
      path: z.string(),
      changeType: z.string(),
      hunks: z.array(
        z.object({
          startLine: z.number().int(),
          endLine: z.number().int(),
          patch: z.string(),
        }),
      ),
      contentIgnored: z.boolean(),
      contentRedacted: z.boolean(),
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

describe("integration: dashboard commit detail API", () => {
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

  it("GET /api/commits/:sha returns files with hunks for modified file", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    cleanups.push(repo.cleanup);

    const indexResult = runGitchange(["index", "--repo", repo.dir]);
    expect(indexResult.exitCode).toBe(0);

    const featureCommitIdx = BASIC_SCENARIO.findIndex((spec) =>
      spec.message?.includes("wire endpoint"),
    );
    const sha = repo.commitShas[featureCommitIdx];

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

    const response = await fetch(`http://127.0.0.1:${port}/api/commits/${sha}`);
    expect(response.status).toBe(200);

    const body = CommitDetailResponseSchema.parse(await response.json());
    expect(body.commit.sha).toBe(sha);

    const featureFile = body.files.find((file) => file.path === "src/feature.ts");
    expect(featureFile).toBeDefined();
    expect(featureFile!.hunks.length).toBeGreaterThanOrEqual(1);
  });

  it("returns 404 for unknown sha", async () => {
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

    const unknownSha = "f".repeat(40);
    const response = await fetch(
      `http://127.0.0.1:${port}/api/commits/${unknownSha}`,
    );
    expect(response.status).toBe(404);
  });
});
