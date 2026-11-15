CREATE INDEX `approvals_requested` ON `approvals` (`requested_at`);--> statement-breakpoint
CREATE INDEX `audit_at` ON `audit_events` (`at`);--> statement-breakpoint
CREATE INDEX `audit_action` ON `audit_events` (`action`,`at`);--> statement-breakpoint
CREATE INDEX `exceptions_status` ON `exceptions` (`status`,`type`);--> statement-breakpoint
CREATE INDEX `jobs_submitted` ON `jobs` (`submitted_at`);