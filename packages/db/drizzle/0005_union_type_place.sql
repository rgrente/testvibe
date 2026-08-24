ALTER TABLE `unions` ADD `type` text DEFAULT 'libre' NOT NULL;--> statement-breakpoint
UPDATE `unions` SET `type` = 'mariage' WHERE `id` IN (SELECT DISTINCT `union_id` FROM `event` WHERE `type` = 'mariage' AND `union_id` IS NOT NULL);--> statement-breakpoint
ALTER TABLE `unions` ADD `place` text;--> statement-breakpoint
ALTER TABLE `unions` ADD `latitude` real;--> statement-breakpoint
ALTER TABLE `unions` ADD `longitude` real;