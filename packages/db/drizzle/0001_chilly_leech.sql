CREATE TABLE `filiation` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`parent_id` integer NOT NULL,
	`child_id` integer NOT NULL,
	`role` text NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`child_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `person` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`birth_date` text,
	`death_date` text,
	`gender` text
);
--> statement-breakpoint
CREATE TABLE `union_partner` (
	`union_id` integer NOT NULL,
	`person_id` integer NOT NULL,
	PRIMARY KEY(`union_id`, `person_id`),
	FOREIGN KEY (`union_id`) REFERENCES `unions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `unions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`start_date` text,
	`end_date` text
);
