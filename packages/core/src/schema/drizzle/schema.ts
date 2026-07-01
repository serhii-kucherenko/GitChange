import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const authors = sqliteTable(
  "authors",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    email: text("email").notNull(),
  },
  (table) => [unique().on(table.name, table.email)],
);

export const commits = sqliteTable(
  "commits",
  {
    sha: text("sha").primaryKey(),
    authorId: integer("author_id").notNull(),
    committerId: integer("committer_id").notNull(),
    authoredAt: integer("authored_at").notNull(),
    committedAt: integer("committed_at").notNull(),
    summary: text("summary").notNull(),
    message: text("message").notNull(),
    isMerge: integer("is_merge", { mode: "boolean" }).notNull(),
    parentCount: integer("parent_count").notNull(),
    parentsJson: text("parents_json").notNull(),
    ccType: text("cc_type"),
    ccScope: text("cc_scope"),
    ccBreaking: integer("cc_breaking", { mode: "boolean" }),
  },
  (table) => [index("commits_committed_at_idx").on(table.committedAt)],
);

export const fileChanges = sqliteTable(
  "file_changes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    commitSha: text("commit_sha")
      .notNull()
      .references(() => commits.sha),
    path: text("path").notNull(),
    oldPath: text("old_path"),
    changeType: text("change_type").notNull(),
    isBinary: integer("is_binary", { mode: "boolean" }).notNull(),
    contentIgnored: integer("content_ignored", { mode: "boolean" }).notNull(),
    contentRedacted: integer("content_redacted", { mode: "boolean" }).notNull(),
    evidenceJson: text("evidence_json").notNull(),
    hunkStart: integer("hunk_start"),
    hunkEnd: integer("hunk_end"),
  },
  (table) => [
    index("file_changes_commit_sha_idx").on(table.commitSha),
    index("file_changes_path_idx").on(table.path),
  ],
);

export const docSnapshots = sqliteTable(
  "doc_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    commitSha: text("commit_sha")
      .notNull()
      .references(() => commits.sha),
    path: text("path").notNull(),
    contentHash: text("content_hash").notNull(),
    content: text("content"),
    frontmatterJson: text("frontmatter_json"),
    evidenceJson: text("evidence_json").notNull(),
  },
  (table) => [index("doc_snapshots_commit_sha_idx").on(table.commitSha)],
);

export const secretFindings = sqliteTable("secret_findings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  commitSha: text("commit_sha").notNull(),
  filePath: text("file_path"),
  ruleId: text("rule_id").notNull(),
  location: text("location").notNull(),
});
