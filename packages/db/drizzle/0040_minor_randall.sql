CREATE TYPE "public"."order_settlement_intent" AS ENUM('pay_now', 'partial', 'pay_later');--> statement-breakpoint
CREATE TYPE "public"."pos_payment_adjustment_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."pos_shift_cash_movement_type" AS ENUM('pay_in', 'pay_out');--> statement-breakpoint
CREATE TABLE "pos_shift_cash_movements" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"terminal_id" varchar(26) NOT NULL,
	"shift_id" varchar(26) NOT NULL,
	"movement_type" "pos_shift_cash_movement_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"reason" text NOT NULL,
	"idempotency_key" varchar(120) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26) NOT NULL,
	CONSTRAINT "pos_shift_cash_movements_amount_positive_check" CHECK ("pos_shift_cash_movements"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "settlement_intent" "order_settlement_intent" DEFAULT 'pay_now' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "balance_due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "unpaid_reason" text;--> statement-breakpoint
ALTER TABLE "sales_returns" ADD COLUMN "return_value_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_returns" ADD COLUMN "exchange_credit_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_returns" ADD COLUMN "additional_due_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "receipt_deliveries" ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "receipt_deliveries" ADD COLUMN "last_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pos_payment_adjustments" ADD COLUMN "status" "pos_payment_adjustment_status" DEFAULT 'succeeded' NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_payment_adjustments" ADD COLUMN "sales_return_id" varchar(26);--> statement-breakpoint
ALTER TABLE "pos_payment_adjustments" ADD COLUMN "settlement_reference" varchar(160);--> statement-breakpoint
ALTER TABLE "pos_payment_adjustments" ADD COLUMN "failure_reason" text;--> statement-breakpoint
ALTER TABLE "pos_payment_adjustments" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pos_payment_adjustments" ADD COLUMN "resolved_by" varchar(26);--> statement-breakpoint
ALTER TABLE "pos_shift_cash_movements" ADD CONSTRAINT "pos_shift_cash_movements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_shift_cash_movements" ADD CONSTRAINT "pos_shift_cash_movements_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_shift_cash_movements" ADD CONSTRAINT "pos_shift_cash_movements_terminal_id_pos_terminal_settings_id_fk" FOREIGN KEY ("terminal_id") REFERENCES "public"."pos_terminal_settings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_shift_cash_movements" ADD CONSTRAINT "pos_shift_cash_movements_shift_id_pos_staff_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."pos_staff_shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_shift_cash_movements" ADD CONSTRAINT "pos_shift_cash_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pos_shift_cash_movements_tenant_idempotency_unique" ON "pos_shift_cash_movements" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "pos_shift_cash_movements_shift_created_at_idx" ON "pos_shift_cash_movements" USING btree ("tenant_id","shift_id","created_at");--> statement-breakpoint
ALTER TABLE "pos_payment_adjustments" ADD CONSTRAINT "pos_payment_adjustments_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pos_payment_adjustments_return_status_idx" ON "pos_payment_adjustments" USING btree ("sales_return_id","status");--> statement-breakpoint
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_return_value_amount_nonnegative_check" CHECK ("sales_returns"."return_value_amount" >= 0);--> statement-breakpoint
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_exchange_credit_amount_nonnegative_check" CHECK ("sales_returns"."exchange_credit_amount" >= 0);--> statement-breakpoint
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_additional_due_amount_nonnegative_check" CHECK ("sales_returns"."additional_due_amount" >= 0);
--> statement-breakpoint
ALTER TABLE public.pos_shift_cash_movements ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.pos_shift_cash_movements FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY cleanhub_tenant_isolation
ON public.pos_shift_cash_movements
AS PERMISSIVE
FOR ALL
TO PUBLIC
USING (
  public.cleanhub_rls_bypass_enabled()
  OR tenant_id::text = public.cleanhub_current_tenant_id()
)
WITH CHECK (
  public.cleanhub_rls_bypass_enabled()
  OR tenant_id::text = public.cleanhub_current_tenant_id()
);
