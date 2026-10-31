CREATE TABLE `goal_materials` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`source_name` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "goal_materials_title_check" CHECK(length(trim("goal_materials"."title")) > 0)
);
--> statement-breakpoint
CREATE INDEX `goal_materials_goal_id_idx` ON `goal_materials` (`goal_id`);