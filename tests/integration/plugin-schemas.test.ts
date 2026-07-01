import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { afterEach, describe, expect, it } from "vitest";
import { getRepoSnapshot } from "../../packages/core/src/read/snapshot.js";
import { indexBasicScenario } from "../golden/helpers.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const SCHEMA_DIR = join(REPO_ROOT, "packages/plugin/schemas");

const LLM_SDK_PATTERN =
  "openai|@anthropic-ai|langchain|@ai-sdk";

function readSchema(filename: string): object {
  return JSON.parse(
    readFileSync(join(SCHEMA_DIR, filename), "utf8"),
  ) as object;
}

function createValidator(): Ajv {
  const ajv = new Ajv({
    allErrors: true,
    strict: false,
    validateSchema: false,
  });
  addFormats(ajv);
  ajv.addSchema(readSchema("manifest.schema.json"));
  ajv.addSchema(readSchema("intelligence-summary.schema.json"));
  ajv.addSchema(readSchema("intelligence-full.schema.json"));
  ajv.addSchema(readSchema("snapshot.schema.json"));
  ajv.addSchema(readSchema("era-synthesis-context.schema.json"));
  ajv.addSchema(readSchema("eras.schema.json"));
  return ajv;
}

function grepPackages(pattern: string, paths: string[]): string {
  try {
    return execFileSync("grep", ["-rEn", pattern, ...paths], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
  } catch (error) {
    const status = (error as NodeJS.ErrnoException & { status?: number }).status;
    if (status === 1) {
      return "";
    }
    throw error;
  }
}

function trimIntelligenceSummary(intelligence: Record<string, unknown>) {
  return {
    schemaVersion: intelligence.schemaVersion,
    computedAt: intelligence.computedAt,
    headSha: intelligence.headSha,
    attributionConfidence: intelligence.attributionConfidence,
    churn: intelligence.churn,
    expertise: intelligence.expertise,
  };
}

describe("integration: plugin host-AI schemas", () => {
  const ajv = createValidator();
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("validates BASIC_SCENARIO manifest against manifest.schema.json", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    const manifest = JSON.parse(
      readFileSync(join(fixture.gitchangeDir, "manifest.json"), "utf8"),
    );

    const validate = ajv.getSchema(
      "https://gitchange.dev/schemas/manifest.schema.json",
    );
    expect(validate).toBeDefined();
    expect(validate?.(manifest)).toBe(true);
  });

  it("validates repo snapshot against snapshot.schema.json", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    const snapshot = getRepoSnapshot(fixture.gitchangeDir);
    expect(snapshot.manifest).not.toBeNull();

    const body = {
      manifest: snapshot.manifest,
      stats: snapshot.stats,
      intelligence: snapshot.intelligence,
      highlights: snapshot.highlights,
    };

    const validate = ajv.getSchema(
      "https://gitchange.dev/schemas/snapshot.schema.json",
    );
    expect(validate).toBeDefined();
    expect(validate?.(body)).toBe(true);
  });

  it("validates golden era artifact against eras.schema.json", () => {
    const eras = JSON.parse(
      readFileSync(
        join(REPO_ROOT, "tests/fixtures/semantic/eras-basic-scenario.json"),
        "utf8",
      ),
    );

    const validate = ajv.getSchema("https://gitchange.dev/schemas/eras.schema.json");
    expect(validate).toBeDefined();
    expect(validate?.(eras)).toBe(true);
  });

  it("validates trimmed intelligence against intelligence-summary.schema.json", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    const intelligence = JSON.parse(
      readFileSync(join(fixture.gitchangeDir, "intelligence.json"), "utf8"),
    ) as Record<string, unknown>;

    const summary = trimIntelligenceSummary(intelligence);

    const validate = ajv.getSchema(
      "https://gitchange.dev/schemas/intelligence-summary.schema.json",
    );
    expect(validate).toBeDefined();
    expect(validate?.(summary)).toBe(true);
  });
});

describe("integration: PLUG-05 no embedded LLM SDK", () => {
  const scanPaths = [
    "packages/plugin",
    "packages/cli",
    "packages/server",
    "packages/core/src/semantic",
  ];

  it("has no LLM SDK imports in plugin, cli, or server packages", () => {
    const matches = grepPackages(LLM_SDK_PATTERN, scanPaths);
    expect(matches.trim()).toBe("");
  });

  it("has no fetch calls to non-localhost URLs in plugin, cli, or server", () => {
    const fetchMatches = grepPackages("fetch\\(", scanPaths);
    const lines = fetchMatches
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      expect(line).toMatch(
        /fetch\(\s*['"`]\/|fetch\(\s*['"`]https?:\/\/127\.0\.0\.1|fetch\(\s*['"`]http:\/\/localhost/,
      );
    }
  });

  it("plugin package has zero LLM SDK pattern matches", () => {
    const matches = grepPackages(LLM_SDK_PATTERN, ["packages/plugin"]);
    expect(matches.trim()).toBe("");
  });
});
