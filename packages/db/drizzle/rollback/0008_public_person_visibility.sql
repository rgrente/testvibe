PRAGMA foreign_keys=OFF;
CREATE TABLE `__rollback_person` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `first_name` text NOT NULL,
  `last_name` text NOT NULL,
  `birth_name` text,
  `birth_date` text,
  `death_date` text,
  `gender` text,
  `living_status` text,
  `visibility` text,
  CONSTRAINT "person_living_status_valid" CHECK("__rollback_person"."living_status" is null or "__rollback_person"."living_status" in ('living', 'deceased')),
  CONSTRAINT "person_visibility_valid" CHECK("__rollback_person"."visibility" is null or "__rollback_person"."visibility" in ('public', 'family', 'private'))
);
INSERT INTO `__rollback_person` SELECT `id`, `first_name`, `last_name`, `birth_name`, `birth_date`, `death_date`, `gender`, `living_status`, `visibility` FROM `person`;
DROP TABLE `person`;
ALTER TABLE `__rollback_person` RENAME TO `person`;
CREATE INDEX `person_privacy_idx` ON `person` (`visibility`, `living_status`);
PRAGMA foreign_keys=ON;
