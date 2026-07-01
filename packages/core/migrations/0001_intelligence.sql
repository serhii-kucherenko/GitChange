CREATE TABLE `file_churn` (
	`path` text PRIMARY KEY NOT NULL,
	`change_count` integer NOT NULL,
	`insertions` integer NOT NULL,
	`deletions` integer NOT NULL,
	`last_touched_at` integer NOT NULL,
	`evidence_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `file_churn_last_touched_at_idx` ON `file_churn` (`last_touched_at`);--> statement-breakpoint
CREATE TABLE `co_change_edges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`path_a` text NOT NULL,
	`path_b` text NOT NULL,
	`co_occurrence` integer NOT NULL,
	`last_co_change_at` integer NOT NULL,
	`weight` real NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `co_change_edges_path_a_path_b_unique` ON `co_change_edges` (`path_a`,`path_b`);--> statement-breakpoint
CREATE INDEX `co_change_edges_weight_idx` ON `co_change_edges` (`weight`);--> statement-breakpoint
CREATE TABLE `file_ownership` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`path` text NOT NULL,
	`author_id` integer NOT NULL,
	`line_count` integer NOT NULL,
	`percentage` real NOT NULL,
	`evidence_json` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `file_ownership_path_author_id_unique` ON `file_ownership` (`path`,`author_id`);--> statement-breakpoint
CREATE INDEX `file_ownership_path_idx` ON `file_ownership` (`path`);--> statement-breakpoint
CREATE TABLE `era_boundaries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`start_commit_sha` text NOT NULL,
	`end_commit_sha` text NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`signal_type` text NOT NULL,
	`score` real NOT NULL,
	`evidence_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `era_ownership` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`era_id` integer NOT NULL,
	`path` text NOT NULL,
	`author_id` integer NOT NULL,
	`touch_count` integer NOT NULL,
	`percentage` real NOT NULL,
	`evidence_json` text NOT NULL,
	FOREIGN KEY (`era_id`) REFERENCES `era_boundaries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `era_ownership_era_id_path_author_id_unique` ON `era_ownership` (`era_id`,`path`,`author_id`);--> statement-breakpoint
CREATE INDEX `era_ownership_era_id_idx` ON `era_ownership` (`era_id`);--> statement-breakpoint
CREATE TABLE `contributor_expertise` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`author_id` integer NOT NULL,
	`topic` text NOT NULL,
	`score` real NOT NULL,
	`evidence_json` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contributor_expertise_author_id_topic_unique` ON `contributor_expertise` (`author_id`,`topic`);--> statement-breakpoint
CREATE INDEX `contributor_expertise_author_id_idx` ON `contributor_expertise` (`author_id`);
