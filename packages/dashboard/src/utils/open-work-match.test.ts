import { describe, expect, it } from "vitest";
import {
  type MatchableOpenWorkThread,
  matchOpenWorkToSurface,
} from "./open-work-match.js";

function thread(
  overrides: Partial<MatchableOpenWorkThread> &
    Pick<MatchableOpenWorkThread, "id">,
): MatchableOpenWorkThread {
  return {
    kind: "migration",
    status: "in_progress",
    title: "API migration",
    confidence: 0.6,
    lastEventAt: 1_700_000_010_000,
    relatedPaths: ["src/feature.ts"],
    events: [
      {
        commitSha: "cccccccccccccccccccccccccccccccccccccccc",
        committedAt: 1_700_000_010_000,
        summary: "feat: wire endpoint",
        paths: ["src/feature.ts"],
      },
    ],
    ...overrides,
  };
}

describe("matchOpenWorkToSurface", () => {
  const threads = [
    thread({ id: "thread:01MIG" }),
    thread({
      id: "thread:02DONE",
      status: "completed",
      events: [
        {
          commitSha: "dddddddddddddddddddddddddddddddddddddddd",
          committedAt: 1_700_000_020_000,
          summary: "chore: finish",
          paths: ["src/done.ts"],
        },
      ],
      relatedPaths: ["src/done.ts"],
    }),
  ];

  it("matches threads by commitSha in events", () => {
    const matched = matchOpenWorkToSurface(threads, {
      commitSha: "cccccccccccccccccccccccccccccccccccccccc",
    });
    expect(matched).toHaveLength(1);
    expect(matched[0]?.id).toBe("thread:01MIG");
  });

  it("matches threads by path prefix overlap on relatedPaths", () => {
    const matched = matchOpenWorkToSurface(threads, {
      path: "src/feature.ts",
    });
    expect(matched).toHaveLength(1);
    expect(matched[0]?.id).toBe("thread:01MIG");
  });

  it("matches threads when event paths overlap surface path", () => {
    const matched = matchOpenWorkToSurface(threads, {
      path: "src/feature.ts",
    });
    expect(matched[0]?.title).toBe("API migration");
  });

  it("matches threads when events fall inside era window", () => {
    const matched = matchOpenWorkToSurface(threads, {
      eraWindow: { startAt: 1_700_000_000_000, endAt: 1_700_000_015_000 },
    });
    expect(matched.map((item) => item.id)).toContain("thread:01MIG");
    expect(matched.map((item) => item.id)).not.toContain("thread:02DONE");
  });

  it("excludes completed threads from matches", () => {
    const matched = matchOpenWorkToSurface(threads, {
      commitSha: "dddddddddddddddddddddddddddddddddddddddd",
    });
    expect(matched).toHaveLength(0);
  });

  it("returns summary shape without events or relatedPaths", () => {
    const matched = matchOpenWorkToSurface(threads, {
      commitSha: "cccccccccccccccccccccccccccccccccccccccc",
    });
    expect(matched).toHaveLength(1);
    const [summary] = matched;
    expect(summary).toBeDefined();
    if (!summary) {
      return;
    }
    expect(summary).not.toHaveProperty("events");
    expect(summary).not.toHaveProperty("relatedPaths");
    expect(summary.lastEventAt).toBe(1_700_000_010_000);
  });
});
