CREATE TABLE `goal_targets` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`type` text NOT NULL,
	`count` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "goal_targets_type_check" CHECK("goal_targets"."type" in ('streak', 'cumulative')),
	CONSTRAINT "goal_targets_count_check" CHECK("goal_targets"."count" > 0)
);
--> statement-breakpoint
CREATE INDEX `goal_targets_goal_id_idx` ON `goal_targets` (`goal_id`);