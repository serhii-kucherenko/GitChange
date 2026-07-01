import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const GITCHANGE_IGNORE_ENTRY = ".gitchange/";

function hasGitchangeEntry(lines: string[]): boolean {
  return lines.some((line) => {
    const trimmed = line.trim();
    return (
      trimmed === ".gitchange" ||
      trimmed === ".gitchange/" ||
      trimmed === "/.gitchange" ||
      trimmed === "/.gitchange/"
    );
  });
}

export function ensureGitignored(repoRoot: string): void {
  const gitignorePath = join(repoRoot, ".gitignore");
  const lines = existsSync(gitignorePath)
    ? readFileSync(gitignorePath, "utf8").split(/\r?\n/u)
    : [];

  if (hasGitchangeEntry(lines)) {
    return;
  }

  if (existsSync(gitignorePath)) {
    const needsLeadingNewline = lines.length > 0 && lines[lines.length - 1] !== "";
    appendFileSync(
      gitignorePath,
      `${needsLeadingNewline ? "\n" : ""}${GITCHANGE_IGNORE_ENTRY}\n`,
      "utf8",
    );
    return;
  }

  writeFileSync(gitignorePath, `${GITCHANGE_IGNORE_ENTRY}\n`, "utf8");
}
