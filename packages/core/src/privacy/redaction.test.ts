import { describe, expect, it } from "vitest";
import { createIgnoreMatcher } from "./gitchangeignore.js";
import { applyPrivacy, redact } from "./redaction.js";

const AWS_SAMPLE = "key=AKIA0123456789ABCDEF";
const GITHUB_PAT = `token=${"ghp_" + "a".repeat(36)}`;
const OPENAI_KEY = "api_key=sk-" + "x".repeat(24);
const PRIVATE_KEY_HEADER = "-----BEGIN RSA PRIVATE KEY-----";
const GENERIC_SECRET = 'password="supersecretvalue12345"';

describe("redact", () => {
  it("redacts AWS access keys and records a finding", () => {
    const { redacted, findings } = redact(AWS_SAMPLE);
    expect(redacted).not.toContain("AKIA0123456789ABCDEF");
    expect(redacted).toContain("«redacted»");
    expect(findings).toEqual([{ ruleId: "aws_access_key" }]);
  });

  it("redacts GitHub PATs", () => {
    const { redacted, findings } = redact(GITHUB_PAT);
    expect(redacted).not.toMatch(/ghp_[0-9A-Za-z]{36}/u);
    expect(findings).toContainEqual({ ruleId: "github_pat" });
  });

  it("redacts OpenAI-style keys", () => {
    const { redacted, findings } = redact(OPENAI_KEY);
    expect(redacted).not.toMatch(/sk-[A-Za-z0-9]{20,}/u);
    expect(findings).toContainEqual({ ruleId: "openai_key" });
  });

  it("redacts private key headers", () => {
    const { redacted, findings } = redact(PRIVATE_KEY_HEADER);
    expect(redacted).not.toContain("BEGIN RSA PRIVATE KEY");
    expect(findings).toContainEqual({ ruleId: "private_key" });
  });

  it("redacts generic token/password assignments", () => {
    const { redacted, findings } = redact(GENERIC_SECRET);
    expect(redacted).not.toContain("supersecretvalue12345");
    expect(findings).toContainEqual({ ruleId: "generic_token" });
  });

  it("never stores raw secret values in findings", () => {
    const { findings } = redact(
      `${AWS_SAMPLE}\n${GITHUB_PAT}\n${OPENAI_KEY}\n${PRIVATE_KEY_HEADER}\n${GENERIC_SECRET}`,
    );
    for (const finding of findings) {
      expect(Object.keys(finding)).toEqual(["ruleId"]);
      expect(JSON.stringify(finding)).not.toMatch(/AKIA|ghp_|sk-|PRIVATE KEY|supersecret/u);
    }
  });

  it("returns clean content unchanged with empty findings", () => {
    const input = "export function greet() { return 'hello'; }";
    const { redacted, findings } = redact(input);
    expect(redacted).toBe(input);
    expect(findings).toEqual([]);
  });

  it("does not miss matches across repeated calls (global regex state)", () => {
    for (let i = 0; i < 5; i += 1) {
      const { redacted, findings } = redact(AWS_SAMPLE);
      expect(redacted).not.toContain("AKIA0123456789ABCDEF");
      expect(findings).toHaveLength(1);
    }
  });
});

describe("applyPrivacy", () => {
  const matcher = createIgnoreMatcher([".env*"]);

  it("drops content for ignored paths without running redaction", () => {
    const result = applyPrivacy({
      path: ".env",
      content: AWS_SAMPLE,
      matcher,
    });
    expect(result).toEqual({
      content: null,
      contentIgnored: true,
      contentRedacted: false,
      findings: [],
    });
  });

  it("redacts secrets on non-ignored paths while preserving commit metadata downstream", () => {
    const result = applyPrivacy({
      path: "src/config.ts",
      content: AWS_SAMPLE,
      matcher,
    });
    expect(result.contentIgnored).toBe(false);
    expect(result.contentRedacted).toBe(true);
    expect(result.content).not.toContain("AKIA0123456789ABCDEF");
    expect(result.findings).toEqual([{ ruleId: "aws_access_key" }]);
  });

  it("passes through clean non-ignored content unchanged", () => {
    const input = "const version = 1;";
    const result = applyPrivacy({
      path: "src/version.ts",
      content: input,
      matcher,
    });
    expect(result).toEqual({
      content: input,
      contentIgnored: false,
      contentRedacted: false,
      findings: [],
    });
  });
});
