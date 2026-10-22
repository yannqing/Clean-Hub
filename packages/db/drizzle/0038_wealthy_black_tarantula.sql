CREATE TYPE "public"."pos_offline_sale_exception_resolution" AS ENUM('cash_refunded', 'recovered');--> statement-breakpoint
CREATE TYPE "public"."pos_offline_sale_exception_status" AS ENUM('open', 'resolved');--> statement-breakpoint
UPDATE "inventory_reservations"
SET "expires_at" = "created_at" + interval '30 minutes',
    "updated_at" = now()
WHERE "status" = 'active' AND "expires_at" IS NULL;--> statement-breakpoint
CREATE TABLE "pos_offline_sale_exceptions" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"terminal_id" varchar(26) NOT NULL,
	"shift_id" varchar(26) NOT NULL,
	"staff_id" varchar(26) NOT NULL,
	"command_id" varchar(120) NOT NULL,
	"order_id" varchar(26) NOT NULL,
	"operation_type" varchar(24) NOT NULL,
	"expected_total_amount" numeric(12, 2) NOT NULL,
	"tendered_amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"command_payload" jsonb NOT NULL,
	"failure_code" varchar(80),
	"failure_message" text NOT NULL,
	"failure_count" numeric(8, 0) DEFAULT '1' NOT NULL,
	"last_failed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "pos_offline_sale_exception_status" DEFAULT 'open' NOT NULL,
	"resolution" "pos_offline_sale_exception_resolution",
	"resolution_reason" text,
	"resolved_at" timestamp with time zone,
	"resolved_by" varchar(26),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pos_offline_sale_exceptions_operation_check" CHECK ("pos_offline_sale_exceptions"."operation_type" in ('checkout', 'payment')),
	CONSTRAINT "pos_offline_sale_exceptions_amount_check" CHECK ("pos_offline_sale_exceptions"."expected_total_amount" >= 0 and "pos_offline_sale_exceptions"."tendered_amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD COLUMN "tendered_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD COLUMN "change_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD COLUMN "shift_id" varchar(26);--> statement-breakpoint
ALTER TABLE "pos_offline_sale_exceptions" ADD CONSTRAINT "pos_offline_sale_exceptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_offline_sale_exceptions" ADD CONSTRAINT "pos_offline_sale_exceptions_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_offline_sale_exceptions" ADD CONSTRAINT "pos_offline_sale_exceptions_terminal_id_pos_terminal_settings_id_fk" FOREIGN KEY ("terminal_id") REFERENCES "public"."pos_terminal_settings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_offline_sale_exceptions" ADD CONSTRAINT "pos_offline_sale_exceptions_shift_id_pos_staff_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."pos_staff_shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_offline_sale_exceptions" ADD CONSTRAINT "pos_offline_sale_exceptions_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_offline_sale_exceptions" ADD CONSTRAINT "pos_offline_sale_exceptions_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pos_offline_sale_exceptions_tenant_command_unique" ON "pos_offline_sale_exceptions" USING btree ("tenant_id","command_id");--> statement-breakpoint
CREATE INDEX "pos_offline_sale_exceptions_branch_status_idx" ON "pos_offline_sale_exceptions" USING btree ("tenant_id","branch_id","status","created_at");--> statement-breakpoint
CREATE INDEX "pos_offline_sale_exceptions_order_idx" ON "pos_offline_sale_exceptions" USING btree ("tenant_id","order_id");--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_shift_id_pos_staff_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."pos_staff_shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_transactions_shift_id_idx" ON "payment_transactions" USING btree ("shift_id");--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_cash_tender_check" CHECK ((
        "payment_transactions"."tendered_amount" is null
        and "payment_transactions"."change_amount" is null
      ) or (
        "payment_transactions"."payment_method" = 'cash'
        and "payment_transactions"."tendered_amount" >= "payment_transactions"."amount"
        and "payment_transactions"."change_amount" = "payment_transactions"."tendered_amount" - "payment_transactions"."amount"
      ));
