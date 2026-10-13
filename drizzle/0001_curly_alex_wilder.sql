CREATE TABLE `quest_participants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quest_id` integer NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'claimed' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`quest_id`) REFERENCES `quests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quest_participants_quest_name` ON `quest_participants` (`quest_id`,`name`);