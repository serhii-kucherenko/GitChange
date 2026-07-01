CREATE TABLE `authors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `authors_name_email_unique` ON `authors` (`name`,`email`);--> statement-breakpoint
CREATE TABLE `commits` (
	`sha` text PRIMARY KEY NOT NULL,
	`author_id` integer NOT NULL,
	`committer_id` integer NOT NULL,
	`authored_at` integer NOT NULL,
	`committed_at` integer NOT NULL,
	`summary` text NOT NULL,
	`message` text NOT NULL,
	`is_merge` integer NOT NULL,
	`parent_count` integer NOT NULL,
	`parents_json` text NOT NULL,
	`cc_type` text,
	`cc_scope` text,
	`cc_breaking` integer
);
--> statement-breakpoint
CREATE INDEX `commits_committed_at_idx` ON `commits` (`committed_at`);--> statement-breakpoint
CREATE TABLE `doc_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`commit_sha` text NOT NULL,
	`path` text NOT NULL,
	`content_hash` text NOT NULL,
	`content` text,
	`frontmatter_json` text,
	`evidence_json` text NOT NULL,
	FOREIGN KEY (`commit_sha`) REFERENCES `commits`(`sha`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `doc_snapshots_commit_sha_idx` ON `doc_snapshots` (`commit_sha`);--> statement-breakpoint
CREATE TABLE `file_changes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`commit_sha` text NOT NULL,
	`path` text NOT NULL,
	`old_path` text,
	`change_type` text NOT NULL,
	`is_binary` integer NOT NULL,
	`content_ignored` integer NOT NULL,
	`content_redacted` integer NOT NULL,
	`evidence_json` text NOT NULL,
	`hunk_start` integer,
	`hunk_end` integer,
	FOREIGN KEY (`commit_sha`) REFERENCES `commits`(`sha`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `file_changes_commit_sha_idx` ON `file_changes` (`commit_sha`);--> statement-breakpoint
CREATE INDEX `file_changes_path_idx` ON `file_changes` (`path`);--> statement-breakpoint
CREATE TABLE `secret_findings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`commit_sha` text NOT NULL,
	`file_path` text,
	`rule_id` text NOT NULL,
	`location` text NOT NULL
);
