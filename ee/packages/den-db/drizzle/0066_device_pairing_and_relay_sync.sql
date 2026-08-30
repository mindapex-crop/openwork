CREATE TABLE `device` (
	`id` varchar(64) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`device_type` varchar(16) NOT NULL,
	`device_name` varchar(255) NOT NULL,
	`last_seen_at` timestamp(3) NOT NULL DEFAULT (now(3)),
	`created_at` timestamp(3) NOT NULL DEFAULT (now(3)),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now(3)) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `device_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `device_user_id` ON `device` (`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `device_user_type_name` ON `device` (`user_id`, `device_type`, `device_name`);
--> statement-breakpoint
CREATE TABLE `device_pairing_code` (
	`id` varchar(64) NOT NULL,
	`code` varchar(16) NOT NULL,
	`initiated_by_device_id` varchar(64) NOT NULL,
	`initiated_by_user_id` varchar(64) NOT NULL,
	`completed_by_device_id` varchar(64),
	`completed_by_user_id` varchar(64),
	`expires_at` timestamp(3) NOT NULL,
	`consumed_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now(3)),
	CONSTRAINT `device_pairing_code_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `device_pairing_code_code` ON `device_pairing_code` (`code`);
--> statement-breakpoint
CREATE INDEX `device_pairing_code_expires_at` ON `device_pairing_code` (`expires_at`);
--> statement-breakpoint
CREATE INDEX `device_pairing_code_initiated_by` ON `device_pairing_code` (`initiated_by_user_id`);
--> statement-breakpoint
CREATE TABLE `relay_sync_change_log` (
	`id` varchar(64) NOT NULL,
	`session_id` varchar(64) NOT NULL,
	`device_id` varchar(64) NOT NULL,
	`change_type` varchar(32) NOT NULL,
	`payload` json NOT NULL,
	`version` bigint NOT NULL,
	`vector_clock` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now(3)),
	CONSTRAINT `relay_sync_change_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `relay_sync_change_log_session_id` ON `relay_sync_change_log` (`session_id`);
--> statement-breakpoint
CREATE INDEX `relay_sync_change_log_session_version` ON `relay_sync_change_log` (`session_id`, `version`);
--> statement-breakpoint
CREATE INDEX `relay_sync_change_log_device_id` ON `relay_sync_change_log` (`device_id`);
--> statement-breakpoint
CREATE TABLE `session_presence` (
	`id` varchar(64) NOT NULL,
	`session_id` varchar(64) NOT NULL,
	`device_id` varchar(64) NOT NULL,
	`device_type` varchar(16) NOT NULL,
	`cursor_position` json,
	`last_seen_at` timestamp(3) NOT NULL DEFAULT (now(3)),
	`created_at` timestamp(3) NOT NULL DEFAULT (now(3)),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now(3)) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `session_presence_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_presence_session_device` ON `session_presence` (`session_id`, `device_id`);
--> statement-breakpoint
CREATE INDEX `session_presence_session_id` ON `session_presence` (`session_id`);
--> statement-breakpoint
CREATE INDEX `session_presence_last_seen` ON `session_presence` (`last_seen_at`);
