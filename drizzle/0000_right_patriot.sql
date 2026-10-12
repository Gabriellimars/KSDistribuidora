CREATE TABLE `delivery_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`status` text NOT NULL,
	`customer_name` text NOT NULL,
	`phone` text NOT NULL,
	`items_json` text NOT NULL,
	`extras_json` text NOT NULL,
	`address_json` text NOT NULL,
	`notes` text NOT NULL,
	`subtotal_cents` integer,
	`delivery_fee_cents` integer,
	`total_cents` integer
);
