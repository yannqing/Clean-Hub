CREATE TYPE "public"."backup_job_status" AS ENUM('pending', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."backup_scope" AS ENUM('platform', 'tenant');--> statement-breakpoint
CREATE TYPE "public"."feedback_ticket_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."operation_log_level" AS ENUM('debug', 'info', 'warn', 'error');--> statement-breakpoint
CREATE TYPE "public"."restore_request_status" AS ENUM('pending', 'approved', 'rejected', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."security_event_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."tenant_pilot_status" AS ENUM('pilot', 'live', 'paused');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('active', 'suspended', 'disabled');--> statement-breakpoint
CREATE TABLE "backup_jobs" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26),
	"scope" "backup_scope" DEFAULT 'tenant' NOT NULL,
	"status" "backup_job_status" DEFAULT 'pending' NOT NULL,
	"requested_by" varchar(26),
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"failure_reason" text,
	"result_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_tickets" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26),
	"branch_id" varchar(26),
	"title" varchar(200) NOT NULL,
	"description" text,
	"status" "feedback_ticket_status" DEFAULT 'open' NOT NULL,
	"priority" varchar(32) DEFAULT 'normal' NOT NULL,
	"source" varchar(80),
	"reporter_user_id" varchar(26),
	"assignee_user_id" varchar(26),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operation_logs" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26),
	"branch_id" varchar(26),
	"level" "operation_log_level" DEFAULT 'info' NOT NULL,
	"service" varchar(120) NOT NULL,
	"event_type" varchar(120) NOT NULL,
	"message" text NOT NULL,
	"request_id" varchar(120),
	"actor_user_id" varchar(26),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"setting_key" varchar(40) DEFAULT 'default' NOT NULL,
	"default_language" varchar(16) DEFAULT 'en' NOT NULL,
	"default_currency" varchar(3) DEFAULT 'XOF' NOT NULL,
	"timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"maintenance_mode" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restore_requests" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"backup_job_id" varchar(26),
	"tenant_id" varchar(26),
	"requested_by" varchar(26),
	"reason" text NOT NULL,
	"status" "restore_request_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" varchar(26),
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26),
	"branch_id" varchar(26),
	"actor_user_id" varchar(26),
	"event_type" varchar(120) NOT NULL,
	"severity" "security_event_severity" DEFAULT 'medium' NOT NULL,
	"ip_address" varchar(64),
	"user_agent" text,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_settings" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"setting_key" varchar(40) DEFAULT 'default' NOT NULL,
	"password_min_length" integer DEFAULT 8 NOT NULL,
	"password_requires_number" boolean DEFAULT true NOT NULL,
	"password_requires_symbol" boolean DEFAULT false NOT NULL,
	"login_max_attempts" integer DEFAULT 5 NOT NULL,
	"lockout_minutes" integer DEFAULT 15 NOT NULL,
	"refresh_token_days" integer DEFAULT 30 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_feature_flags" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"laundry_enabled" boolean DEFAULT true NOT NULL,
	"car_wash_enabled" boolean DEFAULT false NOT NULL,
	"retail_products_enabled" boolean DEFAULT false NOT NULL,
	"delivery_enabled" boolean DEFAULT false NOT NULL,
	"notifications_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_settings" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"default_language" varchar(16) DEFAULT 'en' NOT NULL,
	"default_currency" varchar(3) DEFAULT 'XOF' NOT NULL,
	"timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"pilot_status" "tenant_pilot_status" DEFAULT 'pilot' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "status" "tenant_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "country" varchar(80);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "city" varchar(120);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "contact_name" varchar(120);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "contact_phone" varchar(32);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "contact_email" varchar(320);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "backup_jobs" ADD CONSTRAINT "backup_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup_jobs" ADD CONSTRAINT "backup_jobs_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup_jobs" ADD CONSTRAINT "backup_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup_jobs" ADD CONSTRAINT "backup_jobs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup_jobs" ADD CONSTRAINT "backup_jobs_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_tickets" ADD CONSTRAINT "feedback_tickets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_tickets" ADD CONSTRAINT "feedback_tickets_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_tickets" ADD CONSTRAINT "feedback_tickets_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_tickets" ADD CONSTRAINT "feedback_tickets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_tickets" ADD CONSTRAINT "feedback_tickets_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_tickets" ADD CONSTRAINT "feedback_tickets_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation_logs" ADD CONSTRAINT "operation_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation_logs" ADD CONSTRAINT "operation_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restore_requests" ADD CONSTRAINT "restore_requests_backup_job_id_backup_jobs_id_fk" FOREIGN KEY ("backup_job_id") REFERENCES "public"."backup_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restore_requests" ADD CONSTRAINT "restore_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restore_requests" ADD CONSTRAINT "restore_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restore_requests" ADD CONSTRAINT "restore_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restore_requests" ADD CONSTRAINT "restore_requests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restore_requests" ADD CONSTRAINT "restore_requests_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restore_requests" ADD CONSTRAINT "restore_requests_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_settings" ADD CONSTRAINT "security_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_feature_flags" ADD CONSTRAINT "tenant_feature_flags_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_feature_flags" ADD CONSTRAINT "tenant_feature_flags_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "backup_jobs_tenant_id_idx" ON "backup_jobs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "backup_jobs_scope_idx" ON "backup_jobs" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "backup_jobs_status_idx" ON "backup_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "backup_jobs_created_at_idx" ON "backup_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "feedback_tickets_tenant_id_idx" ON "feedback_tickets" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "feedback_tickets_branch_id_idx" ON "feedback_tickets" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "feedback_tickets_status_idx" ON "feedback_tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "feedback_tickets_assignee_user_id_idx" ON "feedback_tickets" USING btree ("assignee_user_id");--> statement-breakpoint
CREATE INDEX "feedback_tickets_created_at_idx" ON "feedback_tickets" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "operation_logs_tenant_id_idx" ON "operation_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "operation_logs_branch_id_idx" ON "operation_logs" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "operation_logs_level_idx" ON "operation_logs" USING btree ("level");--> statement-breakpoint
CREATE INDEX "operation_logs_service_idx" ON "operation_logs" USING btree ("service");--> statement-breakpoint
CREATE INDEX "operation_logs_event_type_idx" ON "operation_logs" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "operation_logs_created_at_idx" ON "operation_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_settings_setting_key_unique" ON "platform_settings" USING btree ("setting_key");--> statement-breakpoint
INSERT INTO "platform_settings" (
	"id",
	"setting_key",
	"default_language",
	"default_currency",
	"timezone",
	"maintenance_mode",
	"metadata"
)
VALUES (
	'01KCH000000000000000000001',
	'default',
	'en',
	'XOF',
	'UTC',
	false,
	NULL
)
ON CONFLICT ("setting_key") DO NOTHING;--> statement-breakpoint
CREATE INDEX "platform_settings_updated_by_idx" ON "platform_settings" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "restore_requests_backup_job_id_idx" ON "restore_requests" USING btree ("backup_job_id");--> statement-breakpoint
CREATE INDEX "restore_requests_tenant_id_idx" ON "restore_requests" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "restore_requests_status_idx" ON "restore_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "restore_requests_created_at_idx" ON "restore_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "security_events_tenant_id_idx" ON "security_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "security_events_branch_id_idx" ON "security_events" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "security_events_actor_user_id_idx" ON "security_events" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "security_events_event_type_idx" ON "security_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "security_events_severity_idx" ON "security_events" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "security_events_created_at_idx" ON "security_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "security_settings_setting_key_unique" ON "security_settings" USING btree ("setting_key");--> statement-breakpoint
CREATE INDEX "security_settings_updated_by_idx" ON "security_settings" USING btree ("updated_by");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_feature_flags_tenant_id_unique" ON "tenant_feature_flags" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_feature_flags_updated_by_idx" ON "tenant_feature_flags" USING btree ("updated_by");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_settings_tenant_id_unique" ON "tenant_settings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_settings_updated_by_idx" ON "tenant_settings" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "tenants_status_idx" ON "tenants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tenants_deleted_at_idx" ON "tenants" USING btree ("deleted_at");
