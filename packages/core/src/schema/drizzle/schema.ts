import { index, integer, real, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

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
    hunksJson: text("hunks_json"),
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

export const fileChurn = sqliteTable(
  "file_churn",
  {
    path: text("path").primaryKey(),
    changeCount: integer("change_count").notNull(),
    insertions: integer("insertions").notNull(),
    deletions: integer("deletions").notNull(),
    lastTouchedAt: integer("last_touched_at").notNull(),
    evidenceJson: text("evidence_json").notNull(),
  },
  (table) => [index("file_churn_last_touched_at_idx").on(table.lastTouchedAt)],
);

export const coChangeEdges = sqliteTable(
  "co_change_edges",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    pathA: text("path_a").notNull(),
    pathB: text("path_b").notNull(),
    coOccurrence: integer("co_occurrence").notNull(),
    lastCoChangeAt: integer("last_co_change_at").notNull(),
    weight: real("weight").notNull(),
  },
  (table) => [
    unique().on(table.pathA, table.pathB),
    index("co_change_edges_weight_idx").on(table.weight),
  ],
);

export const fileOwnership = sqliteTable(
  "file_ownership",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    path: text("path").notNull(),
    authorId: integer("author_id").notNull(),
    lineCount: integer("line_count").notNull(),
    percentage: real("percentage").notNull(),
    evidenceJson: text("evidence_json").notNull(),
  },
  (table) => [
    unique().on(table.path, table.authorId),
    index("file_ownership_path_idx").on(table.path),
  ],
);

export const eraBoundaries = sqliteTable("era_boundaries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  startCommitSha: text("start_commit_sha").notNull(),
  endCommitSha: text("end_commit_sha").notNull(),
  startAt: integer("start_at").notNull(),
  endAt: integer("end_at").notNull(),
  signalType: text("signal_type").notNull(),
  score: real("score").notNull(),
  evidenceJson: text("evidence_json").notNull(),
});

export const eraOwnership = sqliteTable(
  "era_ownership",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eraId: integer("era_id")
      .notNull()
      .references(() => eraBoundaries.id),
    path: text("path").notNull(),
    authorId: integer("author_id").notNull(),
    touchCount: integer("touch_count").notNull(),
    percentage: real("percentage").notNull(),
    evidenceJson: text("evidence_json").notNull(),
  },
  (table) => [
    unique().on(table.eraId, table.path, table.authorId),
    index("era_ownership_era_id_idx").on(table.eraId),
  ],
);

export const contributorExpertise = sqliteTable(
  "contributor_expertise",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    authorId: integer("author_id").notNull(),
    topic: text("topic").notNull(),
    score: real("score").notNull(),
    evidenceJson: text("evidence_json").notNull(),
  },
  (table) => [
    unique().on(table.authorId, table.topic),
    index("contributor_expertise_author_id_idx").on(table.authorId),
  ],
);
