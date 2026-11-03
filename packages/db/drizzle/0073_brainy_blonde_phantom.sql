DROP INDEX "refund_requests_active_order_unique";--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "ticket_id" varchar(26);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "app_archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pos_payment_adjustments" ADD COLUMN "customer_refund_request_id" varchar(26);--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "mobile_minimum_version" varchar(32) DEFAULT '0.0.0' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "mobile_update_url" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_ticket_id_service_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."service_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_payment_adjustments" ADD CONSTRAINT "pos_payment_adjustments_customer_refund_request_id_refund_requests_id_fk" FOREIGN KEY ("customer_refund_request_id") REFERENCES "public"."refund_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_active_dropoff_ticket_unique" ON "appointments" USING btree ("tenant_id","ticket_id") WHERE "appointments"."ticket_id" is not null and "appointments"."type" = 'dropoff' and "appointments"."status" in ('pending', 'accepted') and "appointments"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "refund_requests_active_order_unique" ON "refund_requests" USING btree ("tenant_id","order_id") WHERE "refund_requests"."deleted_at" is null and "refund_requests"."status" in ('pending', 'approved', 'processing');