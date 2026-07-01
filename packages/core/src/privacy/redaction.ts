import type { IgnoreMatcher } from "./gitchangeignore.js";

export interface SecretFinding {
  ruleId: string;
}

interface SecretRule {
  id: string;
  source: string;
  flags: string;
}

/** Data-driven secret patterns (D-08). Extend here without touching call sites. */
export const SECRET_RULES: readonly SecretRule[] = [
  { id: "aws_access_key", source: "AKIA[0-9A-Z]{16}", flags: "g" },
  { id: "github_pat", source: "ghp_[0-9A-Za-z]{36}", flags: "g" },
  { id: "openai_key", source: "sk-[A-Za-z0-9]{20,}", flags: "g" },
  {
    id: "private_key",
    source: "-----BEGIN (?:RSA |EC )?PRIVATE KEY-----",
    flags: "g",
  },
  {
    id: "generic_token",
    source: "(?:token|secret|password|api[_-]?key)\\s*[=:]\\s*['\"]?[A-Za-z0-9\\-_]{16,}",
    flags: "gi",
  },
];

function compileRule(rule: SecretRule): RegExp {
  return new RegExp(rule.source, rule.flags);
}

export function redact(content: string): {
  redacted: string;
  findings: SecretFinding[];
} {
  const findings: SecretFinding[] = [];
  let redacted = content;

  for (const rule of SECRET_RULES) {
    const pattern = compileRule(rule);
    redacted = redacted.replace(pattern, () => {
      findings.push({ ruleId: rule.id });
      return "«redacted»";
    });
  }

  return { redacted, findings };
}

export function applyPrivacy(input: {
  path: string;
  content: string | null;
  matcher: IgnoreMatcher;
}): {
  content: string | null;
  contentIgnored: boolean;
  contentRedacted: boolean;
  findings: SecretFinding[];
} {
  if (input.matcher.isIgnored(input.path)) {
    return {
      content: null,
      contentIgnored: true,
      contentRedacted: false,
      findings: [],
    };
  }

  if (input.content === null) {
    return {
      content: null,
      contentIgnored: false,
      contentRedacted: false,
      findings: [],
    };
  }

  const { redacted, findings } = redact(input.content);

  return {
    content: redacted,
    contentIgnored: false,
    contentRedacted: findings.length > 0,
    findings,
  };
}
