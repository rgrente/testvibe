CREATE TABLE `admin_session` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`revoked_at` text
);
--> statement-breakpoint
CREATE TABLE `login_rate_limit` (
	`fingerprint` text PRIMARY KEY NOT NULL,
	`failures` integer NOT NULL,
	`window_started_at` text NOT NULL
);
