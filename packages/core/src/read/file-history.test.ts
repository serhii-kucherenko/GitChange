import { afterEach, describe, expect, it } from "vitest";
import {
  decodeFileHistoryCursor,
  encodeFileHistoryCursor,
  getFileHistory,
  InvalidFileHistoryCursorError,
  InvalidFilePathError,
  validateFilePath,
} from "./file-history.js";
import { indexBasicScenario } from "../../../../tests/golden/helpers.js";

describe("validateFilePath", () => {
  it("rejects paths containing .. segments", () => {
    expect(() => validateFilePath("src/../etc/passwd")).toThrow(
      InvalidFilePathError,
    );
  });

  it("rejects null bytes", () => {
    expect(() => validateFilePath("src\0/evil.ts")).toThrow(
      InvalidFilePathError,
    );
  });

  it("accepts normal repo-relative paths", () => {
    expect(validateFilePath("src/feature.ts")).toBe("src/feature.ts");
  });
});

describe("getFileHistory", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("returns events newest-first for a path touched in multiple commits", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    const page = getFileHistory(fixture.gitchangeDir, "src/feature.ts", {
      limit: 50,
    });

    expect(page.events.length).toBeGreaterThanOrEqual(2);

    for (let index = 1; index < page.events.length; index += 1) {
      const previous = page.events[index - 1];
      const current = page.events[index];
      expect(previous.committedAt).toBeGreaterThanOrEqual(current.committedAt);
    }

    for (const event of page.events) {
      expect(event.path).toBe("src/feature.ts");
      expect(event.commitSha).toMatch(/^[0-9a-f]{40}$/);
      expect(event.summary.length).toBeGreaterThan(0);
      expect(event.changeType.length).toBeGreaterThan(0);
    }
  });

  it("includes rename events when querying the old path", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    const page = getFileHistory(fixture.gitchangeDir, "src/index.ts", {
      limit: 50,
    });

    const renameEvent = page.events.find(
      (event) => event.oldPath === "src/index.ts",
    );
    expect(renameEvent).toBeDefined();
    expect(renameEvent!.path).toBe("src/main.ts");
  });

  it("returns empty events for unknown path without error", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    const page = getFileHistory(
      fixture.gitchangeDir,
      "does/not/exist.ts",
      { limit: 50 },
    );
    expect(page.events).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });

  it("paginates with stable cursors", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    const firstPage = getFileHistory(fixture.gitchangeDir, "src/feature.ts", {
      limit: 1,
    });
    expect(firstPage.events).toHaveLength(1);
    expect(firstPage.nextCursor).toBeTruthy();

    const secondPage = getFileHistory(fixture.gitchangeDir, "src/feature.ts", {
      limit: 1,
      cursor: firstPage.nextCursor ?? undefined,
    });
    expect(secondPage.events).toHaveLength(1);
    expect(secondPage.events[0].commitSha).not.toBe(
      firstPage.events[0].commitSha,
    );
  });

  it("round-trips file history cursors", () => {
    const encoded = encodeFileHistoryCursor(1_700_000_000_000, "abc", 42);
    const decoded = decodeFileHistoryCursor(encoded);
    expect(decoded).toEqual({
      committedAt: 1_700_000_000_000,
      commitSha: "abc",
      fileChangeId: 42,
    });
  });

  it("throws on invalid cursor", () => {
    expect(() => decodeFileHistoryCursor("not-valid")).toThrow(
      InvalidFileHistoryCursorError,
    );
  });
});
