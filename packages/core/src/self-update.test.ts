import { describe, expect, it } from "vitest";
import { pullLatestFromOrigin } from "./self-update.js";

describe("pullLatestFromOrigin", () => {
  it("returns not a git repository for a non-git directory", () => {
    const result = pullLatestFromOrigin("/tmp");
    expect(result.checked).toBe(false);
    expect(result.updated).toBe(false);
    expect(result.reason).toBe("not a git repository");
  });
});
