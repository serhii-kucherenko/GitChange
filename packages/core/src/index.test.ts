import { describe, expect, it } from "vitest";
import { CORE_SCHEMA_VERSION } from "./index.js";

describe("core smoke", () => {
  it("exports CORE_SCHEMA_VERSION", () => {
    expect(CORE_SCHEMA_VERSION).toBe("1");
  });
});
