CREATE TYPE "public"."pos_payment_method" AS ENUM('cash', 'card', 'app');--> statement-breakpoint
CREATE TYPE "public"."pos_rounding_rule" AS ENUM('none', 'round_yuan', 'round_jiao');--> statement-breakpoint
CREATE TYPE "public"."pos_terminal_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE "pos_terminal_settings" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"device_id" varchar(128) NOT NULL,
	"label" varchar(64),
	"default_payment_method" "pos_payment_method" DEFAULT 'cash' NOT NULL,
	"rounding_rule" "pos_rounding_rule" DEFAULT 'none' NOT NULL,
	"auto_print_receipt" boolean DEFAULT true NOT NULL,
	"print_copies" smallint DEFAULT 1 NOT NULL,
	"lock_timeout_seconds" integer DEFAULT 300 NOT NULL,
	"status" "pos_terminal_status" DEFAULT 'active' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" ADD CONSTRAINT "pos_terminal_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" ADD CONSTRAINT "pos_terminal_settings_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" ADD CONSTRAINT "pos_terminal_settings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" ADD CONSTRAINT "pos_terminal_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pos_terminal_settings_tenant_device_unique" ON "pos_terminal_settings" USING btree ("tenant_id","device_id");--> statement-breakpoint
CREATE INDEX "pos_terminal_settings_tenant_id_idx" ON "pos_terminal_settings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "pos_terminal_settings_branch_id_idx" ON "pos_terminal_settings" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "pos_terminal_settings_status_idx" ON "pos_terminal_settings" USING btree ("status");