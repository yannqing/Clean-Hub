CREATE TYPE "public"."pos_terminal_operational_status" AS ENUM('unknown', 'connecting', 'online', 'degraded', 'synchronizing', 'offline_pending', 'offline', 'sync_error', 'disabled', 'never_seen');--> statement-breakpoint
CREATE TYPE "public"."pos_terminal_status_event_type" AS ENUM('connected', 'disconnected', 'sync_started', 'sync_completed', 'sync_error', 'sync_recovered');--> statement-breakpoint
CREATE TABLE "pos_terminal_status_events" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"terminal_id" varchar(26) NOT NULL,
	"event_type" "pos_terminal_status_event_type" NOT NULL,
	"from_status" "pos_terminal_operational_status",
	"to_status" "pos_terminal_operational_status" NOT NULL,
	"connection_id" varchar(26),
	"pending_sales_count" integer,
	"pending_operations_count" integer,
	"error_code" varchar(128),
	"error_message" text,
	"reason" varchar(64),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pos_terminal_status_events_pending_sales_check" CHECK ("pos_terminal_status_events"."pending_sales_count" is null or "pos_terminal_status_events"."pending_sales_count" >= 0),
	CONSTRAINT "pos_terminal_status_events_pending_operations_check" CHECK ("pos_terminal_status_events"."pending_operations_count" is null or "pos_terminal_status_events"."pending_operations_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" ADD COLUMN "last_realtime_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" ADD COLUMN "connection_lease_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" ADD COLUMN "last_disconnected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" ADD COLUMN "last_disconnect_reason" varchar(64);--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" ADD COLUMN "pending_sales_count" integer;--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" ADD COLUMN "pending_operations_count" integer;--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" ADD COLUMN "oldest_pending_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" ADD COLUMN "status_revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" ADD COLUMN "realtime_protocol_version" smallint;--> statement-breakpoint
ALTER TABLE "pos_terminal_status_events" ADD CONSTRAINT "pos_terminal_status_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_terminal_status_events" ADD CONSTRAINT "pos_terminal_status_events_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_terminal_status_events" ADD CONSTRAINT "pos_terminal_status_events_terminal_id_pos_terminal_settings_id_fk" FOREIGN KEY ("terminal_id") REFERENCES "public"."pos_terminal_settings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pos_terminal_status_events_tenant_occurred_idx" ON "pos_terminal_status_events" USING btree ("tenant_id","occurred_at");--> statement-breakpoint
CREATE INDEX "pos_terminal_status_events_terminal_occurred_idx" ON "pos_terminal_status_events" USING btree ("terminal_id","occurred_at");--> statement-breakpoint
CREATE INDEX "pos_terminal_status_events_branch_occurred_idx" ON "pos_terminal_status_events" USING btree ("branch_id","occurred_at");--> statement-breakpoint
CREATE INDEX "pos_terminal_settings_tenant_connection_lease_idx" ON "pos_terminal_settings" USING btree ("tenant_id","connection_lease_until");--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" ADD CONSTRAINT "pos_terminal_settings_pending_sales_check" CHECK ("pos_terminal_settings"."pending_sales_count" is null or "pos_terminal_settings"."pending_sales_count" >= 0);--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" ADD CONSTRAINT "pos_terminal_settings_pending_operations_check" CHECK ("pos_terminal_settings"."pending_operations_count" is null or "pos_terminal_settings"."pending_operations_count" >= 0);--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" ADD CONSTRAINT "pos_terminal_settings_status_revision_check" CHECK ("pos_terminal_settings"."status_revision" >= 0);--> statement-breakpoint

ALTER TABLE public.pos_terminal_status_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE public.pos_terminal_status_events FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

DROP POLICY IF EXISTS cleanhub_tenant_isolation ON public.pos_terminal_status_events;
--> statement-breakpoint

CREATE POLICY cleanhub_tenant_isolation
ON public.pos_terminal_status_events
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
