import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { DrizzleDb } from "../artifacts/db.js";
import * as schema from "../schema/drizzle/schema.js";

export const SECRET_PREFIX_PATTERNS = [
  "AKIA",
  "ghp_",
  "sk-",
  "-----BEGIN RSA PRIVATE KEY",
  "-----BEGIN PRIVATE KEY",
] as const;

export function findSecretPrefixesInText(text: string): string[] {
  return SECRET_PREFIX_PATTERNS.filter((prefix) => text.includes(prefix));
}

export function grepSecretPrefixesInSqliteFiles(gitchangeDir: string): string[] {
  const hits = new Set<string>();

  for (const name of readdirSync(gitchangeDir)) {
    if (!name.startsWith("index.sqlite")) {
      continue;
    }

    const buffer = readFileSync(join(gitchangeDir, name));
    for (const prefix of findSecretPrefixesInText(buffer.toString("utf8"))) {
      hits.add(prefix);
    }
  }

  return [...hits];
}

function pushTextValue(values: string[], value: string | null | undefined): void {
  if (value) {
    values.push(value);
  }
}

export function collectIndexedTextValues(db: DrizzleDb): string[] {
  const values: string[] = [];

  for (const row of db.select().from(schema.authors).all()) {
    pushTextValue(values, row.name);
    pushTextValue(values, row.email);
  }

  for (const row of db.select().from(schema.commits).all()) {
    pushTextValue(values, row.sha);
    pushTextValue(values, row.summary);
    pushTextValue(values, row.message);
    pushTextValue(values, row.parentsJson);
    pushTextValue(values, row.ccType);
    pushTextValue(values, row.ccScope);
  }

  for (const row of db.select().from(schema.fileChanges).all()) {
    pushTextValue(values, row.commitSha);
    pushTextValue(values, row.path);
    pushTextValue(values, row.oldPath);
    pushTextValue(values, row.changeType);
    pushTextValue(values, row.evidenceJson);
  }

  for (const row of db.select().from(schema.docSnapshots).all()) {
    pushTextValue(values, row.commitSha);
    pushTextValue(values, row.path);
    pushTextValue(values, row.contentHash);
    pushTextValue(values, row.content);
    pushTextValue(values, row.frontmatterJson);
    pushTextValue(values, row.evidenceJson);
  }

  for (const row of db.select().from(schema.secretFindings).all()) {
    pushTextValue(values, row.commitSha);
    pushTextValue(values, row.filePath);
    pushTextValue(values, row.ruleId);
    pushTextValue(values, row.location);
  }

  return values;
}

export function findSecretPrefixesInIndexedText(db: DrizzleDb): string[] {
  const hits = new Set<string>();
  for (const text of collectIndexedTextValues(db)) {
    for (const prefix of findSecretPrefixesInText(text)) {
      hits.add(prefix);
    }
  }
  return [...hits];
}
