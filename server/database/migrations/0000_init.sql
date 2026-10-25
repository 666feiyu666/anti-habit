CREATE TABLE `daily_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`entry_date` text NOT NULL,
	`status` text NOT NULL,
	`reflection` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "daily_entries_status_check" CHECK("daily_entries"."status" in ('completed', 'missed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_entries_goal_id_entry_date_unique` ON `daily_entries` (`goal_id`,`entry_date`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
