CREATE TABLE `approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`action_id` text NOT NULL,
	`record_refs` text NOT NULL,
	`maker` text NOT NULL,
	`requested_at` text NOT NULL,
	`reason` text NOT NULL,
	`before` text,
	`after` text,
	`evidence` text,
	`status` text NOT NULL,
	`checker` text,
	`decided_at` text,
	`note` text
);
--> statement-breakpoint
CREATE INDEX `approvals_status` ON `approvals` (`status`);--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`record_type` text NOT NULL,
	`record_id` text NOT NULL,
	`actor` text NOT NULL,
	`at` text NOT NULL,
	`effective_date` text,
	`before` text,
	`after` text,
	`note` text,
	`evidence` text,
	`batch_id` text,
	`immutable` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_record` ON `audit_events` (`record_type`,`record_id`,`at`);--> statement-breakpoint
CREATE INDEX `audit_batch` ON `audit_events` (`batch_id`);--> statement-breakpoint
CREATE TABLE `cash_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`portfolio_id` text NOT NULL,
	`bank_account` text NOT NULL,
	`type` text NOT NULL,
	`amount` text NOT NULL,
	`currency` text NOT NULL,
	`value_date` text NOT NULL,
	`status` text NOT NULL,
	`reference` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cash_portfolio_date` ON `cash_activity` (`portfolio_id`,`value_date`);--> statement-breakpoint
CREATE INDEX `cash_status` ON `cash_activity` (`status`);--> statement-breakpoint
CREATE TABLE `close_sign_offs` (
	`period_id` text PRIMARY KEY NOT NULL,
	`signed_by` text NOT NULL,
	`at` text NOT NULL,
	`note` text,
	`package_job_id` text
);
--> statement-breakpoint
CREATE TABLE `exceptions` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`severity` text NOT NULL,
	`record_ref` text NOT NULL,
	`portfolio_id` text NOT NULL,
	`period_end` text NOT NULL,
	`detected_at` text NOT NULL,
	`detected_by` text NOT NULL,
	`owner` text,
	`status` text NOT NULL,
	`values` text,
	`root_cause` text,
	`root_cause_category` text,
	`due_by` text,
	`matched_rule_id` text,
	`proposal` text,
	`evidence` text NOT NULL,
	`thread` text NOT NULL,
	`version` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `exceptions_portfolio_period` ON `exceptions` (`portfolio_id`,`period_end`,`severity`,`status`);--> statement-breakpoint
CREATE INDEX `exceptions_detected` ON `exceptions` (`detected_at`);--> statement-breakpoint
CREATE TABLE `import_mappings` (
	`user_id` text NOT NULL,
	`target_type` text NOT NULL,
	`columns` text NOT NULL,
	PRIMARY KEY(`user_id`, `target_type`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`submitted_by` text NOT NULL,
	`submitted_at` text NOT NULL,
	`queue` text NOT NULL,
	`status` text NOT NULL,
	`progress` text,
	`outputs` text,
	`result` text,
	`inputs` text NOT NULL,
	`scheduled_for` text,
	`log` text
);
--> statement-breakpoint
CREATE INDEX `jobs_status` ON `jobs` (`status`);--> statement-breakpoint
CREATE TABLE `market_holidays` (
	`market` text NOT NULL,
	`date` text NOT NULL,
	`name` text NOT NULL,
	PRIMARY KEY(`market`, `date`)
);
--> statement-breakpoint
CREATE TABLE `periods` (
	`id` text PRIMARY KEY NOT NULL,
	`portfolio_id` text NOT NULL,
	`period_end` text NOT NULL,
	`cutoff` text NOT NULL,
	`state` text NOT NULL,
	`closes` text NOT NULL,
	`version` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `periods_portfolio_end` ON `periods` (`portfolio_id`,`period_end`);--> statement-breakpoint
CREATE TABLE `permissions` (
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`access_level` text NOT NULL,
	`allowed` integer NOT NULL,
	`reason` text,
	`explanation` text,
	`group` text,
	PRIMARY KEY(`user_id`, `action`)
);
--> statement-breakpoint
CREATE TABLE `portfolios` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`base_currency` text NOT NULL,
	`calendar` text NOT NULL,
	`manager` text NOT NULL,
	`controller_id` text NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `positions` (
	`id` text PRIMARY KEY NOT NULL,
	`portfolio_id` text NOT NULL,
	`security_id` text NOT NULL,
	`quantity` text NOT NULL,
	`original_face` text,
	`market_value` text,
	`currency` text NOT NULL,
	`as_of` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `positions_portfolio_security` ON `positions` (`portfolio_id`,`security_id`);--> statement-breakpoint
CREATE TABLE `prices` (
	`id` text PRIMARY KEY NOT NULL,
	`security_id` text NOT NULL,
	`price_date` text NOT NULL,
	`price` text,
	`prior_price` text,
	`currency` text NOT NULL,
	`source` text NOT NULL,
	`tolerance_status` text NOT NULL,
	`version` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prices_security_date` ON `prices` (`security_id`,`price_date`);--> statement-breakpoint
CREATE INDEX `prices_date_status` ON `prices` (`price_date`,`tolerance_status`);--> statement-breakpoint
CREATE TABLE `recurring_break_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`match` text NOT NULL,
	`root_cause_category` text NOT NULL,
	`proposed_action_id` text NOT NULL,
	`created_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`params` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `root_causes` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `securities` (
	`id` text PRIMARY KEY NOT NULL,
	`isin` text NOT NULL,
	`cusip` text,
	`sedol` text,
	`ticker` text,
	`description` text NOT NULL,
	`asset_class` text NOT NULL,
	`currency` text NOT NULL,
	`issuer` text NOT NULL,
	`market` text NOT NULL,
	`status` text NOT NULL,
	`held` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `securities_isin` ON `securities` (`isin`);--> statement-breakpoint
CREATE INDEX `securities_cusip` ON `securities` (`cusip`);--> statement-breakpoint
CREATE INDEX `securities_sedol` ON `securities` (`sedol`);--> statement-breakpoint
CREATE INDEX `securities_ticker` ON `securities` (`ticker`);--> statement-breakpoint
CREATE INDEX `securities_held` ON `securities` (`held`);--> statement-breakpoint
CREATE TABLE `statements` (
	`id` text PRIMARY KEY NOT NULL,
	`portfolio_id` text NOT NULL,
	`period_end` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `statements_portfolio` ON `statements` (`portfolio_id`,`period_end`);--> statement-breakpoint
CREATE TABLE `tolerance_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`asset_class` text NOT NULL,
	`currency` text,
	`source` text,
	`check` text NOT NULL,
	`threshold` text NOT NULL,
	`holiday_aware` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`portfolio_id` text NOT NULL,
	`security_id` text,
	`type` text NOT NULL,
	`trade_date` text NOT NULL,
	`settle_date` text,
	`quantity` text,
	`price` text,
	`amount` text NOT NULL,
	`currency` text NOT NULL,
	`status` text NOT NULL,
	`warning_code` text,
	`origin` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`version` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `transactions_portfolio` ON `transactions` (`portfolio_id`);--> statement-breakpoint
CREATE INDEX `transactions_security` ON `transactions` (`security_id`);--> statement-breakpoint
CREATE INDEX `transactions_trade_date` ON `transactions` (`trade_date`);--> statement-breakpoint
CREATE INDEX `transactions_status` ON `transactions` (`status`,`trade_date`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`team` text NOT NULL,
	`role` text NOT NULL,
	`segment` text NOT NULL,
	`default_density` text NOT NULL,
	`blotter_scope` text
);
--> statement-breakpoint
CREATE TABLE `views` (
	`id` text PRIMARY KEY NOT NULL,
	`grid_id` text NOT NULL,
	`name` text NOT NULL,
	`ownership` text NOT NULL,
	`owner` text NOT NULL,
	`default_for_role` text,
	`state` text NOT NULL,
	`schema_version` integer NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `views_grid` ON `views` (`grid_id`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner` text NOT NULL,
	`group` text,
	`load_at_startup` integer NOT NULL,
	`layout` text NOT NULL,
	`popped_out` text,
	`is_team_default` integer,
	`panels` text NOT NULL
);
