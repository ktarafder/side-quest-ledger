CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`size` integer NOT NULL,
	`content_type` text NOT NULL,
	`status` text DEFAULT 'reserved' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `attendance` (
	`id` text PRIMARY KEY NOT NULL,
	`quest_id` integer NOT NULL,
	`member_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`quest_id`) REFERENCES `quests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_member_quest` ON `attendance` (`quest_id`,`member_id`);--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`target_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `commands` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`digest` text NOT NULL,
	`response` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `kudos` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`member_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_kudos_per_member` ON `kudos` (`submission_id`,`member_id`);--> statement-breakpoint
CREATE TABLE `listings` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`price` integer NOT NULL,
	`stock` integer DEFAULT 1 NOT NULL,
	`asset_id` text,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`auth_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_auth_id_unique` ON `members` (`auth_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `members_email_unique` ON `members` (`email`);--> statement-breakpoint
CREATE TABLE `operation_checks` (
	`ok` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pp_events` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`actor_id` text NOT NULL,
	`from_id` text,
	`to_id` text,
	`amount` integer NOT NULL,
	`quest_id` integer,
	`purchase_id` text,
	`reason` text DEFAULT '' NOT NULL,
	`reverses_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`from_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`quest_id`) REFERENCES `quests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pp_events_reverses_id_unique` ON `pp_events` (`reverses_id`);--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`buyer_id` text NOT NULL,
	`seller_id` text NOT NULL,
	`title` text NOT NULL,
	`price` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buyer_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`seller_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `quiz_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`auth_id` text NOT NULL,
	`question_ids` text NOT NULL,
	`expires_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`used` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`reviewer_id` text NOT NULL,
	`decision` text DEFAULT 'pending' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`decided_at` text,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewer_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_distinct_member` ON `reviews` (`submission_id`,`reviewer_id`);--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`quest_id` integer NOT NULL,
	`member_id` text NOT NULL,
	`story` text NOT NULL,
	`asset_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`decided_at` text,
	FOREIGN KEY (`quest_id`) REFERENCES `quests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `quests` ADD `owner_id` text;--> statement-breakpoint
ALTER TABLE `quests` ADD `funded` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `quests` ADD `winner_submission_id` text;--> statement-breakpoint
ALTER TABLE `quests` ADD `event_at` text;--> statement-breakpoint
ALTER TABLE `quests` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `quests` ADD `request_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `quests_request_key_unique` ON `quests` (`request_key`);
--> statement-breakpoint
CREATE TRIGGER operation_guard BEFORE INSERT ON operation_checks WHEN NEW.ok != 1 BEGIN SELECT RAISE(ABORT,'CHECK operation precondition failed'); END;
--> statement-breakpoint
CREATE TRIGGER pp_validate BEFORE INSERT ON pp_events BEGIN
  SELECT CASE WHEN typeof(NEW.amount) != 'integer' OR NEW.amount <= 0 OR NEW.amount > 100000 THEN RAISE(ABORT,'CHECK invalid PP amount') END;
  SELECT CASE WHEN (NEW.from_id IS NULL AND NEW.to_id IS NULL) OR NEW.from_id = NEW.to_id THEN RAISE(ABORT,'CHECK invalid PP parties') END;
  SELECT CASE WHEN NEW.kind IN ('tip','purchase_hold') AND COALESCE((SELECT balance FROM members WHERE id=NEW.from_id),-1) < NEW.amount THEN RAISE(ABORT,'CHECK insufficient PP') END;
END;
--> statement-breakpoint
CREATE TRIGGER pp_apply AFTER INSERT ON pp_events BEGIN
  UPDATE members SET balance=balance-NEW.amount WHERE id=NEW.from_id;
  UPDATE members SET balance=balance+NEW.amount WHERE id=NEW.to_id;
END;
--> statement-breakpoint
CREATE TRIGGER pp_immutable_update BEFORE UPDATE ON pp_events BEGIN SELECT RAISE(ABORT,'CHECK PP history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER pp_immutable_delete BEFORE DELETE ON pp_events BEGIN SELECT RAISE(ABORT,'CHECK PP history is immutable'); END;
--> statement-breakpoint
CREATE UNIQUE INDEX one_pending_submission ON submissions(quest_id,member_id) WHERE status='pending';
--> statement-breakpoint
CREATE INDEX submissions_quest_status ON submissions(quest_id,status);
--> statement-breakpoint
CREATE INDEX reviews_assignee ON reviews(reviewer_id,decision);
--> statement-breakpoint
CREATE INDEX pp_from ON pp_events(from_id);
--> statement-breakpoint
CREATE INDEX pp_to ON pp_events(to_id);
--> statement-breakpoint
CREATE TRIGGER review_validate BEFORE INSERT ON reviews BEGIN
  SELECT CASE WHEN (SELECT COUNT(*) FROM reviews WHERE submission_id=NEW.submission_id)>=2 THEN RAISE(ABORT,'CHECK two reviewers maximum') END;
  SELECT CASE WHEN EXISTS(SELECT 1 FROM submissions s JOIN quests q ON q.id=s.quest_id WHERE s.id=NEW.submission_id AND (s.member_id=NEW.reviewer_id OR q.owner_id=NEW.reviewer_id)) THEN RAISE(ABORT,'CHECK independent reviewers required') END;
END;
