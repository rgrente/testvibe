DROP TRIGGER IF EXISTS filiation_no_cycle_update;
DROP TRIGGER IF EXISTS filiation_no_cycle_insert;
DROP INDEX IF EXISTS union_partner_person_idx;
DROP INDEX IF EXISTS media_event_idx;
DROP INDEX IF EXISTS media_person_idx;
DROP INDEX IF EXISTS filiation_child_idx;
DROP INDEX IF EXISTS filiation_parent_idx;
DROP INDEX IF EXISTS filiation_parent_child_unique;
DROP INDEX IF EXISTS event_union_idx;
DROP INDEX IF EXISTS event_person_idx;
PRAGMA foreign_keys=OFF;
CREATE TABLE __rollback_filiation (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  parent_id integer NOT NULL REFERENCES person(id) ON DELETE cascade,
  child_id integer NOT NULL REFERENCES person(id) ON DELETE cascade,
  role text NOT NULL
);
INSERT INTO __rollback_filiation SELECT id, parent_id, child_id, role FROM filiation;
DROP TABLE filiation;
ALTER TABLE __rollback_filiation RENAME TO filiation;
PRAGMA foreign_keys=ON;