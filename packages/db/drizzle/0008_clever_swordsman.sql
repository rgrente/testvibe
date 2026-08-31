PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_person` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`birth_name` text,
	`birth_date` text,
	`death_date` text,
	`gender` text,
	`living_status` text,
	`visibility` text DEFAULT 'public',
	CONSTRAINT "person_living_status_valid" CHECK("__new_person"."living_status" is null or "__new_person"."living_status" in ('living', 'deceased')),
	CONSTRAINT "person_visibility_valid" CHECK("__new_person"."visibility" is null or "__new_person"."visibility" in ('public', 'family', 'private'))
);
--> statement-breakpoint
INSERT INTO `__new_person`("id", "first_name", "last_name", "birth_name", "birth_date", "death_date", "gender", "living_status", "visibility") SELECT "id", "first_name", "last_name", "birth_name", "birth_date", "death_date", "gender", "living_status", COALESCE("visibility", 'public') FROM `person`;--> statement-breakpoint
DROP TABLE `person`;--> statement-breakpoint
ALTER TABLE `__new_person` RENAME TO `person`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `person_privacy_idx` ON `person` (`visibility`,`living_status`);