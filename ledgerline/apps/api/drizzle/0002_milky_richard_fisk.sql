CREATE TABLE `job_outputs` (
	`job_id` text NOT NULL,
	`idx` integer NOT NULL,
	`name` text NOT NULL,
	`content_type` text NOT NULL,
	`content` text NOT NULL,
	PRIMARY KEY(`job_id`, `idx`)
);
