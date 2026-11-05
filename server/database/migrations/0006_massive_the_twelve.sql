CREATE TABLE `memo_relations` (
	`source_memo_id` text NOT NULL,
	`target_memo_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`source_memo_id`, `target_memo_id`),
	FOREIGN KEY (`source_memo_id`) REFERENCES `memos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_memo_id`) REFERENCES `memos`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "memo_relations_not_self_check" CHECK("memo_relations"."source_memo_id" <> "memo_relations"."target_memo_id")
);
--> statement-breakpoint
CREATE INDEX `memo_relations_source_idx` ON `memo_relations` (`source_memo_id`);--> statement-breakpoint
CREATE INDEX `memo_relations_target_idx` ON `memo_relations` (`target_memo_id`);--> statement-breakpoint
CREATE TABLE `review_states` (
	`id` text PRIMARY KEY NOT NULL,
	`memo_id` text,
	`entry_id` text,
	`last_reviewed_at` integer,
	`next_review_at` integer,
	`dismissed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`memo_id`) REFERENCES `memos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`entry_id`) REFERENCES `daily_entries`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "review_states_one_source_check" CHECK(("review_states"."memo_id" is null) <> ("review_states"."entry_id" is null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_states_memo_id_unique` ON `review_states` (`memo_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `review_states_entry_id_unique` ON `review_states` (`entry_id`);--> statement-breakpoint
CREATE INDEX `review_states_next_review_at_idx` ON `review_states` (`next_review_at`);