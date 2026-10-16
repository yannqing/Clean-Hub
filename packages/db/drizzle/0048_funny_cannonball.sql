CREATE TYPE "public"."pos_cash_drawer_session_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."pos_register_session_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."pos_cash_handling_mode" AS ENUM('none', 'untracked', 'shared_drawer', 'assigned_drawer', 'cash_in_hand');--> statement-breakpoint
CREATE TABLE "pos_cash_drawer_sessions" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"terminal_id" varchar(26) NOT NULL,
	"register_session_id" varchar(26) NOT NULL,
	"handling_mode" "pos_cash_handling_mode" NOT NULL,
	"assigned_staff_id" varchar(26),
	"currency" varchar(3) DEFAULT 'XOF' NOT NULL,
	"status" "pos_cash_drawer_session_status" DEFAULT 'open' NOT NULL,
	"opening_float" numeric(12, 2) DEFAULT '0' NOT NULL,
	"expected_cash" numeric(12, 2),
	"counted_cash" numeric(12, 2),
	"variance" numeric(12, 2),
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"opened_by" varchar(26) NOT NULL,
	"closed_by" varchar(26),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "pos_cash_drawer_sessions_mode_check" CHECK ("pos_cash_drawer_sessions"."handling_mode" not in ('none', 'untracked')),
	CONSTRAINT "pos_cash_drawer_sessions_assignment_check" CHECK (("pos_cash_drawer_sessions"."handling_mode" in ('assigned_drawer', 'cash_in_hand') and "pos_cash_drawer_sessions"."assigned_staff_id" is not null)
        or ("pos_cash_drawer_sessions"."handling_mode" = 'shared_drawer' and "pos_cash_drawer_sessions"."assigned_staff_id" is null))
);
--> statement-breakpoint
CREATE TABLE "pos_register_sessions" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"terminal_id" varchar(26) NOT NULL,
	"currency" varchar(3) DEFAULT 'XOF' NOT NULL,
	"status" "pos_register_session_status" DEFAULT 'open' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"opened_by" varchar(26) NOT NULL,
	"closed_by" varchar(26),
	"close_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
DROP INDEX "pos_staff_shifts_terminal_open_unique";--> statement-breakpoint
ALTER TABLE "pos_shift_cash_movements" ALTER COLUMN "shift_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_staff_shifts" ALTER COLUMN "terminal_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_z_reports" ALTER COLUMN "shift_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_z_reports" ALTER COLUMN "handover_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD COLUMN "register_session_id" varchar(26);--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD COLUMN "cash_drawer_session_id" varchar(26);--> statement-breakpoint
ALTER TABLE "pos_shift_cash_movements" ADD COLUMN "register_session_id" varchar(26);--> statement-breakpoint
ALTER TABLE "pos_shift_cash_movements" ADD COLUMN "cash_drawer_session_id" varchar(26);--> statement-breakpoint
ALTER TABLE "pos_z_reports" ADD COLUMN "register_session_id" varchar(26);--> statement-breakpoint
ALTER TABLE "pos_channel_settings" ADD COLUMN "default_cash_handling_mode" "pos_cash_handling_mode" DEFAULT 'shared_drawer' NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" ADD COLUMN "cash_handling_mode" "pos_cash_handling_mode" DEFAULT 'shared_drawer' NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_cash_drawer_sessions" ADD CONSTRAINT "pos_cash_drawer_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_cash_drawer_sessions" ADD CONSTRAINT "pos_cash_drawer_sessions_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_cash_drawer_sessions" ADD CONSTRAINT "pos_cash_drawer_sessions_terminal_id_pos_terminal_settings_id_fk" FOREIGN KEY ("terminal_id") REFERENCES "public"."pos_terminal_settings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_cash_drawer_sessions" ADD CONSTRAINT "pos_cash_drawer_sessions_register_session_id_pos_register_sessions_id_fk" FOREIGN KEY ("register_session_id") REFERENCES "public"."pos_register_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_cash_drawer_sessions" ADD CONSTRAINT "pos_cash_drawer_sessions_assigned_staff_id_users_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_cash_drawer_sessions" ADD CONSTRAINT "pos_cash_drawer_sessions_opened_by_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_cash_drawer_sessions" ADD CONSTRAINT "pos_cash_drawer_sessions_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_register_sessions" ADD CONSTRAINT "pos_register_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_register_sessions" ADD CONSTRAINT "pos_register_sessions_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_register_sessions" ADD CONSTRAINT "pos_register_sessions_terminal_id_pos_terminal_settings_id_fk" FOREIGN KEY ("terminal_id") REFERENCES "public"."pos_terminal_settings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_register_sessions" ADD CONSTRAINT "pos_register_sessions_opened_by_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_register_sessions" ADD CONSTRAINT "pos_register_sessions_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pos_cash_drawer_sessions_shared_register_open_unique" ON "pos_cash_drawer_sessions" USING btree ("tenant_id","register_session_id") WHERE "pos_cash_drawer_sessions"."status" = 'open' and "pos_cash_drawer_sessions"."handling_mode" in ('shared_drawer', 'assigned_drawer');--> statement-breakpoint
CREATE UNIQUE INDEX "pos_cash_drawer_sessions_staff_register_open_unique" ON "pos_cash_drawer_sessions" USING btree ("tenant_id","register_session_id","assigned_staff_id") WHERE "pos_cash_drawer_sessions"."status" = 'open' and "pos_cash_drawer_sessions"."handling_mode" = 'cash_in_hand';--> statement-breakpoint
CREATE INDEX "pos_cash_drawer_sessions_branch_opened_at_idx" ON "pos_cash_drawer_sessions" USING btree ("tenant_id","branch_id","opened_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pos_register_sessions_terminal_open_unique" ON "pos_register_sessions" USING btree ("tenant_id","terminal_id") WHERE "pos_register_sessions"."status" = 'open';--> statement-breakpoint
CREATE INDEX "pos_register_sessions_branch_opened_at_idx" ON "pos_register_sessions" USING btree ("tenant_id","branch_id","opened_at");--> statement-breakpoint
CREATE INDEX "pos_register_sessions_status_idx" ON "pos_register_sessions" USING btree ("status");--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_register_session_id_pos_register_sessions_id_fk" FOREIGN KEY ("register_session_id") REFERENCES "public"."pos_register_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_cash_drawer_session_id_pos_cash_drawer_sessions_id_fk" FOREIGN KEY ("cash_drawer_session_id") REFERENCES "public"."pos_cash_drawer_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_shift_cash_movements" ADD CONSTRAINT "pos_shift_cash_movements_register_session_id_pos_register_sessions_id_fk" FOREIGN KEY ("register_session_id") REFERENCES "public"."pos_register_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_shift_cash_movements" ADD CONSTRAINT "pos_shift_cash_movements_cash_drawer_session_id_pos_cash_drawer_sessions_id_fk" FOREIGN KEY ("cash_drawer_session_id") REFERENCES "public"."pos_cash_drawer_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_z_reports" ADD CONSTRAINT "pos_z_reports_register_session_id_pos_register_sessions_id_fk" FOREIGN KEY ("register_session_id") REFERENCES "public"."pos_register_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_transactions_register_session_id_idx" ON "payment_transactions" USING btree ("register_session_id");--> statement-breakpoint
CREATE INDEX "payment_transactions_cash_drawer_session_id_idx" ON "payment_transactions" USING btree ("cash_drawer_session_id");--> statement-breakpoint
CREATE INDEX "pos_shift_cash_movements_register_created_at_idx" ON "pos_shift_cash_movements" USING btree ("tenant_id","register_session_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pos_z_reports_register_session_unique" ON "pos_z_reports" USING btree ("register_session_id");--> statement-breakpoint
ALTER TABLE public.pos_register_sessions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.pos_register_sessions FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY cleanhub_tenant_isolation
ON public.pos_register_sessions
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
);--> statement-breakpoint
ALTER TABLE public.pos_cash_drawer_sessions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.pos_cash_drawer_sessions FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY cleanhub_tenant_isolation
ON public.pos_cash_drawer_sessions
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
