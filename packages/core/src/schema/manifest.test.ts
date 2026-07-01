import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  IndexCompleteness,
  ManifestSchema,
  ManifestWarningCode,
  narrowIndexCompleteness,
  narrowWarningCode,
  readManifest,
  writeManifest,
  type Manifest,
} from "./manifest.js";

const SHA = "b".repeat(40);

function sampleManifest(overrides: Partial<Manifest> = {}): Manifest {
  return {
    schemaVersion: "1",
    lastIndexedCommit: SHA,
    indexedAt: "2026-07-01T00:00:00.000Z",
    repo: { head: SHA, branch: "main" },
    indexCompleteness: "complete",
    warnings: [],
    ...overrides,
  };
}

describe("manifest read/write", () => {
  it("round-trips through write then read", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-manifest-"));
    const manifest = sampleManifest({
      warnings: [{ code: "shallow_clone", message: "depth=1" }],
    });

    try {
      writeManifest(dir, manifest);
      expect(readManifest(dir)).toEqual(manifest);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns null when manifest is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-manifest-"));

    try {
      expect(readManifest(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("creates the directory when writing", () => {
    const parent = mkdtempSync(join(tmpdir(), "gitchange-manifest-"));
    const dir = join(parent, "nested", ".gitchange");

    try {
      writeManifest(dir, sampleManifest());
      expect(readManifest(dir)).not.toBeNull();
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});

describe("ManifestSchema", () => {
  it("rejects unknown warning codes", () => {
    const invalid = {
      ...sampleManifest(),
      warnings: [{ code: "unknown_code", message: "nope" }],
    };

    expect(() => ManifestSchema.parse(invalid as unknown as Manifest)).toThrow();
  });

  it("accepts the three allowed warning codes", () => {
    for (const code of [
      "shallow_clone",
      "force_push_detected",
      "out_of_order_commits",
    ] as const) {
      expect(
        ManifestSchema.parse(
          sampleManifest({ warnings: [{ code, message: "ok" }] }),
        ).warnings[0]?.code,
      ).toBe(code);
    }
  });

  it("only accepts complete or partial indexCompleteness", () => {
    expect(
      ManifestSchema.parse(sampleManifest({ indexCompleteness: "complete" }))
        .indexCompleteness,
    ).toBe("complete");
    expect(
      ManifestSchema.parse(sampleManifest({ indexCompleteness: "partial" }))
        .indexCompleteness,
    ).toBe("partial");
    expect(() =>
      ManifestSchema.parse(
        sampleManifest({ indexCompleteness: "broken" as "complete" }),
      ),
    ).toThrow();
  });
});

describe("exhaustive narrowing helpers", () => {
  it("narrows indexCompleteness without throwing", () => {
    for (const value of IndexCompleteness.options) {
      expect(() => narrowIndexCompleteness(value)).not.toThrow();
    }
  });

  it("narrows warning codes without throwing", () => {
    for (const code of ManifestWarningCode.options) {
      expect(() => narrowWarningCode(code)).not.toThrow();
    }
  });
});
