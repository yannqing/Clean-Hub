CREATE TYPE "public"."payment_provider_status" AS ENUM('not_applicable', 'initiated', 'pending', 'succeeded', 'failed', 'cancelled', 'timed_out');--> statement-breakpoint
CREATE TYPE "public"."receipt_delivery_channel" AS ENUM('print', 'email', 'sms', 'none');--> statement-breakpoint
CREATE TYPE "public"."receipt_delivery_status" AS ENUM('pending', 'sent', 'failed', 'skipped');--> statement-breakpoint
ALTER TYPE "public"."pos_cart_status" ADD VALUE 'parked' BEFORE 'converted';--> statement-breakpoint
CREATE TABLE "receipt_deliveries" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"order_id" varchar(26) NOT NULL,
	"channel" "receipt_delivery_channel" NOT NULL,
	"destination" varchar(320),
	"status" "receipt_delivery_status" DEFAULT 'pending' NOT NULL,
	"idempotency_key" varchar(120) NOT NULL,
	"receipt_title" varchar(200) NOT NULL,
	"receipt_content" text NOT NULL,
	"provider" varchar(80),
	"external_id" varchar(160),
	"provider_payload" jsonb,
	"failure_reason" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_amounts_check";--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "taxable_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "tax_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "tax_rate_snapshot" numeric(7, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "tax_exemption_reason" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "taxable_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tax_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tax_rate_snapshot" numeric(7, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "prices_include_tax" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tax_exemption_reason" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tax_registration_number_snapshot" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "rounding_adjustment_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD COLUMN "provider_status" "payment_provider_status" DEFAULT 'not_applicable' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD COLUMN "authorization_code" varchar(120);--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD COLUMN "failure_code" varchar(80);--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD COLUMN "failure_reason" text;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD COLUMN "provider_payload" jsonb;--> statement-breakpoint
ALTER TABLE "pos_carts" ADD COLUMN "name" varchar(120);--> statement-breakpoint
ALTER TABLE "pos_carts" ADD COLUMN "parked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pos_carts" ADD COLUMN "parked_by" varchar(26);--> statement-breakpoint
ALTER TABLE "pos_carts" ADD COLUMN "claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pos_carts" ADD COLUMN "claimed_by" varchar(26);--> statement-breakpoint
ALTER TABLE "pos_carts" ADD COLUMN "handoff_note" text;--> statement-breakpoint
ALTER TABLE "sales_returns" ADD COLUMN "exchange_order_id" varchar(26);--> statement-breakpoint
ALTER TABLE "sales_returns" ADD COLUMN "idempotency_key" varchar(120);--> statement-breakpoint
UPDATE "sales_returns" SET "idempotency_key" = 'legacy:' || "id" WHERE "idempotency_key" IS NULL;--> statement-breakpoint
ALTER TABLE "sales_returns" ALTER COLUMN "idempotency_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_channel_settings" ADD COLUMN "default_payment_methods_enabled" "pos_payment_method"[] DEFAULT ARRAY['cash', 'app']::pos_payment_method[] NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_channel_settings" ADD COLUMN "tax_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_channel_settings" ADD COLUMN "default_tax_rate" numeric(7, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_channel_settings" ADD COLUMN "prices_include_tax" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_channel_settings" ADD COLUMN "tax_registration_number" text;--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" ADD COLUMN "payment_methods_enabled" "pos_payment_method"[] DEFAULT ARRAY['cash', 'app']::pos_payment_method[] NOT NULL;--> statement-breakpoint
ALTER TABLE "receipt_deliveries" ADD CONSTRAINT "receipt_deliveries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_deliveries" ADD CONSTRAINT "receipt_deliveries_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_deliveries" ADD CONSTRAINT "receipt_deliveries_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_deliveries" ADD CONSTRAINT "receipt_deliveries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "receipt_deliveries_tenant_idempotency_unique" ON "receipt_deliveries" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "receipt_deliveries_order_idx" ON "receipt_deliveries" USING btree ("tenant_id","order_id");--> statement-breakpoint
CREATE INDEX "receipt_deliveries_pending_idx" ON "receipt_deliveries" USING btree ("status","created_at") WHERE "receipt_deliveries"."status" = 'pending';--> statement-breakpoint
ALTER TABLE "pos_carts" ADD CONSTRAINT "pos_carts_parked_by_users_id_fk" FOREIGN KEY ("parked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_carts" ADD CONSTRAINT "pos_carts_claimed_by_users_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_exchange_order_id_orders_id_fk" FOREIGN KEY ("exchange_order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pos_carts_branch_parked_idx" ON "pos_carts" USING btree ("tenant_id","branch_id","status","parked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_returns_tenant_idempotency_unique" ON "sales_returns" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "sales_returns_exchange_order_id_idx" ON "sales_returns" USING btree ("exchange_order_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_amounts_check" CHECK ("orders"."subtotal_amount" >= 0
        and "orders"."discount_amount" >= 0
        and "orders"."discount_amount" <= "orders"."subtotal_amount"
        and "orders"."taxable_amount" >= 0
        and "orders"."tax_amount" >= 0
        and "orders"."tax_rate_snapshot" >= 0
        and "orders"."tax_rate_snapshot" <= 100
        and "orders"."total_amount" = "orders"."subtotal_amount" - "orders"."discount_amount"
          + case when "orders"."prices_include_tax" then 0 else "orders"."tax_amount" end
          + "orders"."rounding_adjustment_amount"
        and "orders"."total_amount" >= 0);--> statement-breakpoint
ALTER TABLE "pos_channel_settings" ADD CONSTRAINT "pos_channel_settings_payment_methods_nonempty_check" CHECK (cardinality("pos_channel_settings"."default_payment_methods_enabled") > 0);--> statement-breakpoint
ALTER TABLE "pos_channel_settings" ADD CONSTRAINT "pos_channel_settings_tax_rate_check" CHECK ("pos_channel_settings"."default_tax_rate" >= 0 and "pos_channel_settings"."default_tax_rate" <= 100);--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" ADD CONSTRAINT "pos_terminal_settings_payment_methods_nonempty_check" CHECK (cardinality("pos_terminal_settings"."payment_methods_enabled") > 0);
