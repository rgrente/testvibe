PRAGMA foreign_keys=OFF;
CREATE TABLE `__rollback_media` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `person_id` integer REFERENCES `person`(`id`) ON DELETE cascade,
  `event_id` integer REFERENCES `event`(`id`) ON DELETE cascade,
  `filename` text NOT NULL,
  `original_name` text NOT NULL,
  `mime_type` text NOT NULL,
  `size` integer NOT NULL,
  `created_at` text NOT NULL
);
INSERT INTO `__rollback_media` SELECT `id`, `person_id`, `event_id`, `filename`, `original_name`, `mime_type`, `size`, `created_at` FROM `media`;
DROP TABLE `media`;
ALTER TABLE `__rollback_media` RENAME TO `media`;
CREATE TABLE `__rollback_event` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `person_id` integer NOT NULL REFERENCES `person`(`id`) ON DELETE cascade,
  `union_id` integer REFERENCES `unions`(`id`) ON DELETE set null,
  `type` text NOT NULL,
  `label` text,
  `event_date` text,
  `description` text,
  `place` text,
  `latitude` real,
  `longitude` real
);
INSERT INTO `__rollback_event` SELECT `id`, `person_id`, `union_id`, `type`, `label`, `event_date`, `description`, `place`, `latitude`, `longitude` FROM `event`;
DROP TABLE `event`;
ALTER TABLE `__rollback_event` RENAME TO `event`;
CREATE TABLE `__rollback_person` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `first_name` text NOT NULL,
  `last_name` text NOT NULL,
  `birth_name` text,
  `birth_date` text,
  `death_date` text,
  `gender` text
);
INSERT INTO `__rollback_person` SELECT `id`, `first_name`, `last_name`, `birth_name`, `birth_date`, `death_date`, `gender` FROM `person`;
DROP TABLE `person`;
ALTER TABLE `__rollback_person` RENAME TO `person`;
PRAGMA foreign_keys=ON;
