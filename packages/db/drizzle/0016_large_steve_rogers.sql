CREATE TYPE "public"."pos_terminal_device_type" AS ENUM('unknown', 'desktop', 'tablet', 'phone', 'browser');--> statement-breakpoint
CREATE TYPE "public"."pos_terminal_sync_status" AS ENUM('never', 'syncing', 'synced', 'error');--> statement-breakpoint
CREATE TABLE "pos_channel_settings" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"cash_tracking_enabled" boolean DEFAULT true NOT NULL,
	"require_opening_float" boolean DEFAULT true NOT NULL,
	"require_closing_count" boolean DEFAULT true NOT NULL,
	"require_return_reason" boolean DEFAULT true NOT NULL,
	"recent_cart_retention_hours" smallint DEFAULT 24 NOT NULL,
	"offline_mode_enabled" boolean DEFAULT true NOT NULL,
	"sync_interval_seconds" integer DEFAULT 60 NOT NULL,
	"device_offline_after_seconds" integer DEFAULT 600 NOT NULL,
	"default_payment_method" "pos_payment_method" DEFAULT 'cash' NOT NULL,
	"default_rounding_rule" "pos_rounding_rule" DEFAULT 'none' NOT NULL,
	"default_auto_print_receipt" boolean DEFAULT true NOT NULL,
	"default_print_copies" smallint DEFAULT 1 NOT NULL,
	"default_lock_timeout_seconds" integer DEFAULT 300 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "pos_channel_settings_cart_retention_check" CHECK ("pos_channel_settings"."recent_cart_retention_hours" between 1 and 720),
	CONSTRAINT "pos_channel_settings_sync_interval_check" CHECK ("pos_channel_settings"."sync_interval_seconds" between 5 and 3600),
	CONSTRAINT "pos_channel_settings_offline_threshold_check" CHECK ("pos_channel_settings"."device_offline_after_seconds" between ("pos_channel_settings"."sync_interval_seconds" * 2) and 86400),
	CONSTRAINT "pos_channel_settings_print_copies_check" CHECK ("pos_channel_settings"."default_print_copies" between 1 and 10),
	CONSTRAINT "pos_channel_settings_lock_timeout_check" CHECK ("pos_channel_settings"."default_lock_timeout_seconds" between 30 and 86400),
	CONSTRAINT "pos_channel_settings_version_check" CHECK ("pos_channel_settings"."version" >= 1)
);
--> statement-breakpoint
INSERT INTO "pos_channel_settings" ("id", "tenant_id")
SELECT
	left("tenant"."id", 10) || upper(substr(md5('pos-channel-settings:' || "tenant"."id"), 1, 16)),
	"tenant"."id"
FROM "tenants" AS "tenant";--> statement-breakpoint
ALTER TABLE "pos_staff_shifts" ADD COLUMN "currency" varchar(3) DEFAULT 'XOF' NOT NULL;--> statement-breakpoint
UPDATE "pos_staff_shifts" AS "shift"
SET "currency" = "branch"."default_currency"
FROM "branches" AS "branch"
WHERE "branch"."id" = "shift"."branch_id"
	AND "branch"."tenant_id" = "shift"."tenant_id";--> statement-breakpoint
UPDATE "pos_staff_shifts" AS "shift"
SET "currency" = "report"."currency"
FROM "pos_z_reports" AS "report"
WHERE "report"."shift_id" = "shift"."id"
	AND "report"."tenant_id" = "shift"."tenant_id"
	AND "report"."branch_id" = "shift"."branch_id";--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" ADD COLUMN "device_type" "pos_terminal_device_type" DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" ADD COLUMN "platform" varchar(64);--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" ADD COLUMN "platform_version" varchar(64);--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" ADD COLUMN "app_version" varchar(64);--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" ADD COLUMN "sync_status" "pos_terminal_sync_status" DEFAULT 'never' NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" ADD COLUMN "last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" ADD COLUMN "last_sync_error" text;--> statement-breakpoint
ALTER TABLE "pos_channel_settings" ADD CONSTRAINT "pos_channel_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_channel_settings" ADD CONSTRAINT "pos_channel_settings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_channel_settings" ADD CONSTRAINT "pos_channel_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pos_channel_settings_tenant_id_unique" ON "pos_channel_settings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "pos_channel_settings_updated_by_idx" ON "pos_channel_settings" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "pos_terminal_settings_last_seen_at_idx" ON "pos_terminal_settings" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "pos_terminal_settings_tenant_last_seen_at_idx" ON "pos_terminal_settings" USING btree ("tenant_id","last_seen_at");--> statement-breakpoint
CREATE INDEX "pos_terminal_settings_tenant_sync_status_idx" ON "pos_terminal_settings" USING btree ("tenant_id","sync_status");
