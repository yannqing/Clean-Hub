ALTER TABLE "orders" ADD COLUMN "currency" varchar(3) DEFAULT 'XOF' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD COLUMN "currency" varchar(3) DEFAULT 'XOF' NOT NULL;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD COLUMN "currency" varchar(3) DEFAULT 'XOF' NOT NULL;--> statement-breakpoint
ALTER TABLE "service_tickets" ADD COLUMN "currency" varchar(3) DEFAULT 'XOF' NOT NULL;--> statement-breakpoint
UPDATE "orders"
SET "currency" = "branches"."default_currency"
FROM "branches"
WHERE "orders"."branch_id" = "branches"."id";--> statement-breakpoint
UPDATE "payment_transactions"
SET "currency" = "orders"."currency"
FROM "orders"
WHERE "payment_transactions"."order_id" = "orders"."id";--> statement-breakpoint
UPDATE "refund_requests"
SET "currency" = "orders"."currency"
FROM "orders"
WHERE "refund_requests"."order_id" = "orders"."id";--> statement-breakpoint
UPDATE "service_tickets"
SET "currency" = "branches"."default_currency"
FROM "branches"
WHERE "service_tickets"."branch_id" = "branches"."id";
