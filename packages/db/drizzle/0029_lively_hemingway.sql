ALTER TABLE "order_discount_applications" ALTER COLUMN "customer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "customer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "customer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_transactions" ALTER COLUMN "customer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_payment_adjustments" ALTER COLUMN "customer_id" DROP NOT NULL;--> statement-breakpoint
-- Keep legacy retail/delivery tickets readable for audit history while the
-- constraint prevents any new non-service ticket from being written.
ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_service_type_check" CHECK ("service_tickets"."ticket_type"::text in ('laundry', 'car_wash')) NOT VALID;
