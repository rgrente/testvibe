CREATE TABLE `genealogical_date` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_kind` text NOT NULL,
	`owner_id` integer NOT NULL,
	`field` text NOT NULL,
	`original` text NOT NULL,
	`qualification` text NOT NULL,
	`precision` text NOT NULL,
	`lower_bound` text,
	`upper_bound` text,
	CONSTRAINT "genealogical_date_owner_valid" CHECK("genealogical_date"."owner_kind" in ('person', 'union', 'event')),
	CONSTRAINT "genealogical_date_qualification_valid" CHECK("genealogical_date"."qualification" in ('exact', 'about', 'before', 'after', 'between', 'legacy_unresolved')),
	CONSTRAINT "genealogical_date_precision_valid" CHECK("genealogical_date"."precision" in ('year', 'month', 'day')),
	CONSTRAINT "genealogical_date_bounds_ordered" CHECK("genealogical_date"."lower_bound" is null or "genealogical_date"."upper_bound" is null or "genealogical_date"."lower_bound" <= "genealogical_date"."upper_bound")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `genealogical_date_owner_field_unique` ON `genealogical_date` (`owner_kind`,`owner_id`,`field`);--> statement-breakpoint
CREATE INDEX `genealogical_date_sort_idx` ON `genealogical_date` (`lower_bound`,`upper_bound`,`qualification`,`owner_id`);--> statement-breakpoint
WITH legacy(owner_kind, owner_id, field, original) AS (
  SELECT 'person', id, 'birth_date', birth_date FROM person WHERE birth_date IS NOT NULL
  UNION ALL SELECT 'person', id, 'death_date', death_date FROM person WHERE death_date IS NOT NULL
  UNION ALL SELECT 'union', id, 'start_date', start_date FROM unions WHERE start_date IS NOT NULL
  UNION ALL SELECT 'union', id, 'end_date', end_date FROM unions WHERE end_date IS NOT NULL
  UNION ALL SELECT 'event', id, 'event_date', event_date FROM event WHERE event_date IS NOT NULL
)
INSERT INTO genealogical_date(owner_kind, owner_id, field, original, qualification, precision, lower_bound, upper_bound)
SELECT owner_kind, owner_id, field, original,
  CASE WHEN length(original) = 10 AND substr(original, 6) = '01-01' THEN 'legacy_unresolved' ELSE 'exact' END,
  CASE length(original) WHEN 4 THEN 'year' WHEN 7 THEN 'month' ELSE 'day' END,
  CASE length(original) WHEN 4 THEN original || '-01-01' WHEN 7 THEN original || '-01' ELSE original END,
  CASE length(original) WHEN 4 THEN original || '-12-31' WHEN 7 THEN date(original || '-01', '+1 month', '-1 day') ELSE original END
FROM legacy WHERE length(original) IN (4, 7, 10);