CREATE TABLE `entry_links` (
	`source_entry_id` text NOT NULL,
	`target_entry_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`source_entry_id`, `target_entry_id`),
	FOREIGN KEY (`source_entry_id`) REFERENCES `daily_entries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_entry_id`) REFERENCES `daily_entries`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "entry_links_not_self_check" CHECK("entry_links"."source_entry_id" <> "entry_links"."target_entry_id")
);
--> statement-breakpoint
CREATE INDEX `entry_links_source_idx` ON `entry_links` (`source_entry_id`);--> statement-breakpoint
CREATE INDEX `entry_links_target_idx` ON `entry_links` (`target_entry_id`);--> statement-breakpoint
ALTER TABLE `daily_entries` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `goals` ADD `essay_title` text;