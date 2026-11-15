DROP INDEX `transactions_trade_date`;--> statement-breakpoint
CREATE INDEX `transactions_trade_date` ON `transactions` (`trade_date`,`id`);