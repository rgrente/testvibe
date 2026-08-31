PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_event` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`person_id` integer NOT NULL,
	`union_id` integer,
	`type` text NOT NULL,
	`label` text,
	`event_date` text,
	`description` text,
	`place` text,
	`latitude` real,
	`longitude` real,
	`visibility` text,
	FOREIGN KEY (`person_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`union_id`) REFERENCES `unions`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "event_visibility_valid" CHECK("__new_event"."visibility" is null or "__new_event"."visibility" in ('public', 'family', 'private'))
);
--> statement-breakpoint
INSERT INTO `__new_event`("id", "person_id", "union_id", "type", "label", "event_date", "description", "place", "latitude", "longitude", "visibility") SELECT "id", "person_id", "union_id", "type", "label", "event_date", "description", "place", "latitude", "longitude", NULL FROM `event`;--> statement-breakpoint
DROP TABLE `event`;--> statement-breakpoint
ALTER TABLE `__new_event` RENAME TO `event`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `event_visibility_idx` ON `event` (`visibility`);--> statement-breakpoint
CREATE TABLE `__new_media` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`person_id` integer,
	`event_id` integer,
	`filename` text NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` text NOT NULL,
	`visibility` text,
	FOREIGN KEY (`person_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `event`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "media_visibility_valid" CHECK("__new_media"."visibility" is null or "__new_media"."visibility" in ('public', 'family', 'private'))
);
--> statement-breakpoint
INSERT INTO `__new_media`("id", "person_id", "event_id", "filename", "original_name", "mime_type", "size", "created_at", "visibility") SELECT "id", "person_id", "event_id", "filename", "original_name", "mime_type", "size", "created_at", NULL FROM `media`;--> statement-breakpoint
DROP TABLE `media`;--> statement-breakpoint
ALTER TABLE `__new_media` RENAME TO `media`;--> statement-breakpoint
CREATE INDEX `media_visibility_idx` ON `media` (`visibility`);--> statement-breakpoint
CREATE TABLE `__new_person` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`birth_name` text,
	`birth_date` text,
	`death_date` text,
	`gender` text,
	`living_status` text,
	`visibility` text,
	CONSTRAINT "person_living_status_valid" CHECK("__new_person"."living_status" is null or "__new_person"."living_status" in ('living', 'deceased')),
	CONSTRAINT "person_visibility_valid" CHECK("__new_person"."visibility" is null or "__new_person"."visibility" in ('public', 'family', 'private'))
);
--> statement-breakpoint
INSERT INTO `__new_person`("id", "first_name", "last_name", "birth_name", "birth_date", "death_date", "gender", "living_status", "visibility") SELECT "id", "first_name", "last_name", "birth_name", "birth_date", "death_date", "gender", NULL, NULL FROM `person`;--> statement-breakpoint
DROP TABLE `person`;--> statement-breakpoint
ALTER TABLE `__new_person` RENAME TO `person`;--> statement-breakpoint
CREATE INDEX `person_privacy_idx` ON `person` (`visibility`,`living_status`);