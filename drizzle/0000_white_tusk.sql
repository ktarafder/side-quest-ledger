CREATE TABLE `quests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`reward` text DEFAULT '' NOT NULL,
	`points` integer DEFAULT 10 NOT NULL,
	`category` text DEFAULT 'misc' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`claimed_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text
);
