DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "payment_transactions"
		WHERE "deleted_at" IS NULL
			AND "gateway" IS NOT NULL
			AND "gateway" <> ''
			AND "external_id" IS NOT NULL
			AND "external_id" <> ''
		GROUP BY "tenant_id", "gateway", "external_id"
		HAVING count(*) > 1
	) THEN
		RAISE EXCEPTION 'Cannot add payment gateway reference uniqueness: duplicate active tenant/gateway/external_id values exist.';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM "auth_refresh_tokens"
		WHERE length("device_id") > 128
	) THEN
		RAISE EXCEPTION 'Cannot narrow auth_refresh_tokens.device_id to varchar(128): existing values exceed 128 characters.';
	END IF;
END $$;
--> statement-breakpoint
CREATE TYPE "public"."pos_payment_adjustment_direction" AS ENUM('debit', 'credit');--> statement-breakpoint
CREATE TYPE "public"."pos_payment_adjustment_type" AS ENUM('refund', 'correction');--> statement-breakpoint
CREATE TYPE "public"."pos_shift_status" AS ENUM('open', 'on_break', 'closed');--> statement-breakpoint
CREATE TYPE "public"."pos_z_report_correction_type" AS ENUM('cash_adjustment', 'payment_adjustment', 'note');--> statement-breakpoint
CREATE TABLE "pos_payment_adjustments" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"customer_id" varchar(26) NOT NULL,
	"order_id" varchar(26) NOT NULL,
	"original_payment_id" varchar(26),
	"adjustment_type" "pos_payment_adjustment_type" NOT NULL,
	"direction" "pos_payment_adjustment_direction" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"idempotency_key" varchar(120) NOT NULL,
	"reason" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos_shift_handovers" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"terminal_id" varchar(26) NOT NULL,
	"outgoing_shift_id" varchar(26) NOT NULL,
	"outgoing_staff_id" varchar(26) NOT NULL,
	"incoming_staff_id" varchar(26) NOT NULL,
	"expected_cash" numeric(12, 2) DEFAULT '0' NOT NULL,
	"counted_cash" numeric(12, 2) DEFAULT '0' NOT NULL,
	"variance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"outstanding_orders" integer DEFAULT 0 NOT NULL,
	"outstanding_tickets" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"cutoff_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos_staff_shifts" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"terminal_id" varchar(26) NOT NULL,
	"staff_id" varchar(26) NOT NULL,
	"status" "pos_shift_status" DEFAULT 'open' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"opening_float" numeric(12, 2) DEFAULT '0' NOT NULL,
	"closing_float" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos_z_report_corrections" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"z_report_id" varchar(26) NOT NULL,
	"correction_type" "pos_z_report_correction_type" NOT NULL,
	"amount" numeric(12, 2),
	"reason" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos_z_reports" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"terminal_id" varchar(26) NOT NULL,
	"shift_id" varchar(26) NOT NULL,
	"handover_id" varchar(26) NOT NULL,
	"currency" varchar(3) DEFAULT 'XOF' NOT NULL,
	"cutoff_at" timestamp with time zone NOT NULL,
	"order_count" integer DEFAULT 0 NOT NULL,
	"gross_sales" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"refund_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"correction_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"net_sales" numeric(12, 2) DEFAULT '0' NOT NULL,
	"expected_cash" numeric(12, 2) DEFAULT '0' NOT NULL,
	"counted_cash" numeric(12, 2) DEFAULT '0' NOT NULL,
	"variance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"outstanding_orders" integer DEFAULT 0 NOT NULL,
	"payment_breakdown" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26) NOT NULL
);
--> statement-breakpoint
DROP INDEX "payment_transactions_gateway_external_id_idx";--> statement-breakpoint
ALTER TABLE "auth_refresh_tokens" ALTER COLUMN "device_id" SET DATA TYPE varchar(128);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "service_id" varchar(26);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "pricing_unit" "pricing_unit";--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "standard_unit_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "charged_unit_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "weight" numeric(10, 3);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "bag_count" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "item_color" varchar(40);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "defect_notes" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "special_request" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "item_identifier" varchar(64);--> statement-breakpoint
ALTER TABLE "auth_refresh_tokens" ADD COLUMN "terminal_id" varchar(26);--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" ADD COLUMN "credential_digest" varchar(128);--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" ADD COLUMN "credential_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" ADD COLUMN "credential_issued_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" ADD COLUMN "credential_rotated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" ADD COLUMN "credential_last_used_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ticket_items" ADD COLUMN "pricing_unit" "pricing_unit";--> statement-breakpoint
ALTER TABLE "ticket_items" ADD COLUMN "standard_unit_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "ticket_items" ADD COLUMN "charged_unit_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "ticket_items" ADD COLUMN "weight" numeric(10, 3);--> statement-breakpoint
ALTER TABLE "ticket_items" ADD COLUMN "bag_count" integer;--> statement-breakpoint
ALTER TABLE "pos_payment_adjustments" ADD CONSTRAINT "pos_payment_adjustments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_payment_adjustments" ADD CONSTRAINT "pos_payment_adjustments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_payment_adjustments" ADD CONSTRAINT "pos_payment_adjustments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_payment_adjustments" ADD CONSTRAINT "pos_payment_adjustments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_payment_adjustments" ADD CONSTRAINT "pos_payment_adjustments_original_payment_id_payment_transactions_id_fk" FOREIGN KEY ("original_payment_id") REFERENCES "public"."payment_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_payment_adjustments" ADD CONSTRAINT "pos_payment_adjustments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_shift_handovers" ADD CONSTRAINT "pos_shift_handovers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_shift_handovers" ADD CONSTRAINT "pos_shift_handovers_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_shift_handovers" ADD CONSTRAINT "pos_shift_handovers_terminal_id_pos_terminal_settings_id_fk" FOREIGN KEY ("terminal_id") REFERENCES "public"."pos_terminal_settings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_shift_handovers" ADD CONSTRAINT "pos_shift_handovers_outgoing_shift_id_pos_staff_shifts_id_fk" FOREIGN KEY ("outgoing_shift_id") REFERENCES "public"."pos_staff_shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_shift_handovers" ADD CONSTRAINT "pos_shift_handovers_outgoing_staff_id_users_id_fk" FOREIGN KEY ("outgoing_staff_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_shift_handovers" ADD CONSTRAINT "pos_shift_handovers_incoming_staff_id_users_id_fk" FOREIGN KEY ("incoming_staff_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_shift_handovers" ADD CONSTRAINT "pos_shift_handovers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_staff_shifts" ADD CONSTRAINT "pos_staff_shifts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_staff_shifts" ADD CONSTRAINT "pos_staff_shifts_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_staff_shifts" ADD CONSTRAINT "pos_staff_shifts_terminal_id_pos_terminal_settings_id_fk" FOREIGN KEY ("terminal_id") REFERENCES "public"."pos_terminal_settings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_staff_shifts" ADD CONSTRAINT "pos_staff_shifts_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_staff_shifts" ADD CONSTRAINT "pos_staff_shifts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_staff_shifts" ADD CONSTRAINT "pos_staff_shifts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_z_report_corrections" ADD CONSTRAINT "pos_z_report_corrections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_z_report_corrections" ADD CONSTRAINT "pos_z_report_corrections_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_z_report_corrections" ADD CONSTRAINT "pos_z_report_corrections_z_report_id_pos_z_reports_id_fk" FOREIGN KEY ("z_report_id") REFERENCES "public"."pos_z_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_z_report_corrections" ADD CONSTRAINT "pos_z_report_corrections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_z_reports" ADD CONSTRAINT "pos_z_reports_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_z_reports" ADD CONSTRAINT "pos_z_reports_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_z_reports" ADD CONSTRAINT "pos_z_reports_terminal_id_pos_terminal_settings_id_fk" FOREIGN KEY ("terminal_id") REFERENCES "public"."pos_terminal_settings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_z_reports" ADD CONSTRAINT "pos_z_reports_shift_id_pos_staff_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."pos_staff_shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_z_reports" ADD CONSTRAINT "pos_z_reports_handover_id_pos_shift_handovers_id_fk" FOREIGN KEY ("handover_id") REFERENCES "public"."pos_shift_handovers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_z_reports" ADD CONSTRAINT "pos_z_reports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pos_payment_adjustments_tenant_idempotency_unique" ON "pos_payment_adjustments" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "pos_payment_adjustments_order_occurred_at_idx" ON "pos_payment_adjustments" USING btree ("tenant_id","order_id","occurred_at");--> statement-breakpoint
CREATE INDEX "pos_payment_adjustments_original_payment_idx" ON "pos_payment_adjustments" USING btree ("original_payment_id");--> statement-breakpoint
CREATE INDEX "pos_payment_adjustments_branch_occurred_at_idx" ON "pos_payment_adjustments" USING btree ("tenant_id","branch_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pos_shift_handovers_outgoing_shift_unique" ON "pos_shift_handovers" USING btree ("outgoing_shift_id");--> statement-breakpoint
CREATE INDEX "pos_shift_handovers_branch_created_at_idx" ON "pos_shift_handovers" USING btree ("tenant_id","branch_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pos_staff_shifts_staff_open_unique" ON "pos_staff_shifts" USING btree ("tenant_id","staff_id") WHERE "pos_staff_shifts"."status" <> 'closed';--> statement-breakpoint
CREATE UNIQUE INDEX "pos_staff_shifts_terminal_open_unique" ON "pos_staff_shifts" USING btree ("tenant_id","terminal_id") WHERE "pos_staff_shifts"."status" <> 'closed';--> statement-breakpoint
CREATE INDEX "pos_staff_shifts_branch_started_at_idx" ON "pos_staff_shifts" USING btree ("tenant_id","branch_id","started_at");--> statement-breakpoint
CREATE INDEX "pos_staff_shifts_status_idx" ON "pos_staff_shifts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pos_z_report_corrections_report_created_at_idx" ON "pos_z_report_corrections" USING btree ("z_report_id","created_at");--> statement-breakpoint
CREATE INDEX "pos_z_report_corrections_tenant_branch_idx" ON "pos_z_report_corrections" USING btree ("tenant_id","branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pos_z_reports_shift_unique" ON "pos_z_reports" USING btree ("shift_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pos_z_reports_handover_unique" ON "pos_z_reports" USING btree ("handover_id");--> statement-breakpoint
CREATE INDEX "pos_z_reports_branch_cutoff_idx" ON "pos_z_reports" USING btree ("tenant_id","branch_id","cutoff_at");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_items_service_id_idx" ON "order_items" USING btree ("service_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_transactions_tenant_gateway_external_id_unique" ON "payment_transactions" USING btree ("tenant_id","gateway","external_id") WHERE "payment_transactions"."deleted_at" is null and "payment_transactions"."gateway" is not null and "payment_transactions"."gateway" <> '' and "payment_transactions"."external_id" is not null and "payment_transactions"."external_id" <> '';
