CREATE TABLE `memo_entry_links` (
	`memo_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`memo_id`, `entry_id`),
	FOREIGN KEY (`memo_id`) REFERENCES `memos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`entry_id`) REFERENCES `daily_entries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `memo_entry_links_entry_id_idx` ON `memo_entry_links` (`entry_id`);--> statement-breakpoint
CREATE TABLE `memo_goal_links` (
	`memo_id` text NOT NULL,
	`goal_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`memo_id`, `goal_id`),
	FOREIGN KEY (`memo_id`) REFERENCES `memos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `memo_goal_links_goal_id_idx` ON `memo_goal_links` (`goal_id`);--> statement-breakpoint
CREATE TABLE `memos` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	CONSTRAINT "memos_content_check" CHECK(length(trim("memos"."content")) > 0)
);
--> statement-breakpoint
CREATE INDEX `memos_created_at_idx` ON `memos` (`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `memos_deleted_at_idx` ON `memos` (`deleted_at`);