CREATE TEMP TABLE `_genealogy_audit_guard` (`issue` text NOT NULL CHECK (`issue` = ''));--> statement-breakpoint
INSERT INTO `_genealogy_audit_guard` SELECT 'missing-parent:' || group_concat(f.id) FROM filiation f LEFT JOIN person p ON p.id = f.parent_id WHERE p.id IS NULL HAVING count(*) > 0;--> statement-breakpoint
INSERT INTO `_genealogy_audit_guard` SELECT 'missing-child:' || group_concat(f.id) FROM filiation f LEFT JOIN person p ON p.id = f.child_id WHERE p.id IS NULL HAVING count(*) > 0;--> statement-breakpoint
INSERT INTO `_genealogy_audit_guard` SELECT 'self-link:' || group_concat(id) FROM filiation WHERE parent_id = child_id HAVING count(*) > 0;--> statement-breakpoint
INSERT INTO `_genealogy_audit_guard` SELECT 'duplicate-pair:' || group_concat(id) FROM filiation WHERE (parent_id, child_id) IN (SELECT parent_id, child_id FROM filiation GROUP BY parent_id, child_id HAVING count(*) > 1) HAVING count(*) > 0;--> statement-breakpoint
INSERT INTO `_genealogy_audit_guard` WITH RECURSIVE paths(origin, node, ids) AS (SELECT parent_id, child_id, printf('%d', id) FROM filiation UNION ALL SELECT paths.origin, f.child_id, paths.ids || ',' || f.id FROM paths JOIN filiation f ON f.parent_id = paths.node WHERE instr(',' || paths.ids || ',', ',' || f.id || ',') = 0) SELECT 'cycle:' || group_concat(ids) FROM paths WHERE node = origin HAVING count(*) > 0;--> statement-breakpoint
DROP TABLE `_genealogy_audit_guard`;--> statement-breakpoint
CREATE INDEX `event_person_idx` ON `event` (`person_id`);--> statement-breakpoint
CREATE INDEX `event_union_idx` ON `event` (`union_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_filiation` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`parent_id` integer NOT NULL,
	`child_id` integer NOT NULL,
	`role` text NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`child_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "filiation_distinct_people" CHECK("__new_filiation"."parent_id" <> "__new_filiation"."child_id")
);
--> statement-breakpoint
INSERT INTO `__new_filiation`("id", "parent_id", "child_id", "role") SELECT "id", "parent_id", "child_id", "role" FROM `filiation`;--> statement-breakpoint
DROP TABLE `filiation`;--> statement-breakpoint
ALTER TABLE `__new_filiation` RENAME TO `filiation`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `filiation_parent_child_unique` ON `filiation` (`parent_id`,`child_id`);--> statement-breakpoint
CREATE INDEX `filiation_parent_idx` ON `filiation` (`parent_id`);--> statement-breakpoint
CREATE INDEX `filiation_child_idx` ON `filiation` (`child_id`);--> statement-breakpoint
CREATE TRIGGER `filiation_no_cycle_insert` BEFORE INSERT ON `filiation` BEGIN
  SELECT RAISE(ABORT, 'cycle de filiation') WHERE EXISTS (
    WITH RECURSIVE descendants(id) AS (
      SELECT NEW.child_id UNION SELECT f.child_id FROM filiation f JOIN descendants d ON f.parent_id = d.id
    ) SELECT 1 FROM descendants WHERE id = NEW.parent_id
  );
END;--> statement-breakpoint
CREATE TRIGGER `filiation_no_cycle_update` BEFORE UPDATE OF parent_id, child_id ON `filiation` BEGIN
  SELECT RAISE(ABORT, 'cycle de filiation') WHERE EXISTS (
    WITH RECURSIVE descendants(id) AS (
      SELECT NEW.child_id UNION SELECT f.child_id FROM filiation f JOIN descendants d ON f.parent_id = d.id WHERE f.id <> OLD.id
    ) SELECT 1 FROM descendants WHERE id = NEW.parent_id
  );
END;--> statement-breakpoint
CREATE INDEX `media_person_idx` ON `media` (`person_id`);--> statement-breakpoint
CREATE INDEX `media_event_idx` ON `media` (`event_id`);--> statement-breakpoint
CREATE INDEX `union_partner_person_idx` ON `union_partner` (`person_id`);