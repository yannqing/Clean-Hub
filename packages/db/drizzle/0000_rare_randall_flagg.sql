CREATE TYPE "public"."business_line" AS ENUM('laundry', 'car_wash', 'retail', 'delivery');--> statement-breakpoint
CREATE TYPE "public"."catalog_item_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."pricing_unit" AS ENUM('per_item', 'per_kg');--> statement-breakpoint
CREATE TYPE "public"."customer_account_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."customer_profile_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."order_item_source_type" AS ENUM('ticket_item', 'subscription', 'delivery_fee', 'product');--> statement-breakpoint
CREATE TYPE "public"."order_payment_status" AS ENUM('unpaid', 'paid', 'partial', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('draft', 'received', 'paid', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."order_type" AS ENUM('ticket', 'manual');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'card', 'app');--> statement-breakpoint
CREATE TYPE "public"."payment_transaction_status" AS ENUM('pending', 'paid', 'refunded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."permission_scope" AS ENUM('saas', 'tenant', 'pos', 'system');--> statement-breakpoint
CREATE TYPE "public"."role_scope" AS ENUM('saas', 'tenant', 'pos');--> statement-breakpoint
CREATE TYPE "public"."role_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('invited', 'active', 'disabled', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."user_type" AS ENUM('saas', 'tenant');--> statement-breakpoint
CREATE TYPE "public"."backup_job_status" AS ENUM('pending', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."backup_scope" AS ENUM('platform', 'tenant');--> statement-breakpoint
CREATE TYPE "public"."restore_request_status" AS ENUM('pending', 'approved', 'rejected', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."hardware_connection_type" AS ENUM('usb', 'bluetooth', 'network', 'other');--> statement-breakpoint
CREATE TYPE "public"."hardware_device_type" AS ENUM('printer', 'scanner', 'cash_drawer');--> statement-breakpoint
CREATE TYPE "public"."operation_log_level" AS ENUM('debug', 'info', 'warn', 'error');--> statement-breakpoint
CREATE TYPE "public"."notice_channel" AS ENUM('pos', 'app', 'sms', 'whatsapp', 'email');--> statement-breakpoint
CREATE TYPE "public"."notice_delivery_status" AS ENUM('pending', 'sent', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."notice_priority" AS ENUM('low', 'normal', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."notice_read_status" AS ENUM('unread', 'read', 'archived');--> statement-breakpoint
CREATE TYPE "public"."notice_recipient_type" AS ENUM('role', 'user', 'customer', 'branch_all', 'tenant_all');--> statement-breakpoint
CREATE TYPE "public"."notice_scope" AS ENUM('pos', 'saas', 'tenant', 'mobile', 'desktop');--> statement-breakpoint
CREATE TYPE "public"."notice_sender_type" AS ENUM('system', 'user', 'customer', 'scheduler');--> statement-breakpoint
CREATE TYPE "public"."notice_trigger_type" AS ENUM('event', 'schedule');--> statement-breakpoint
CREATE TYPE "public"."notice_type" AS ENUM('system', 'business');--> statement-breakpoint
CREATE TYPE "public"."security_event_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."feedback_ticket_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."branch_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."tenant_pilot_status" AS ENUM('pilot', 'live', 'paused');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('active', 'suspended', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."ticket_item_status" AS ENUM('washing', 'done', 'ready_to_pick');--> statement-breakpoint
CREATE TYPE "public"."ticket_item_type" AS ENUM('cloth', 'car', 'shoe', 'carpet');--> statement-breakpoint
CREATE TYPE "public"."ticket_priority" AS ENUM('normal', 'urgent', 'critical');--> statement-breakpoint
CREATE TYPE "public"."ticket_source_channel" AS ENUM('pos', 'app', 'phone', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('draft', 'pending', 'in_progress', 'ready_to_pick', 'picked_up', 'cancelled', 'exception');--> statement-breakpoint
CREATE TABLE "prices" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"service_id" varchar(26) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'XOF' NOT NULL,
	"status" "catalog_item_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"category_id" varchar(26),
	"name" varchar(200) NOT NULL,
	"business_line" "business_line" NOT NULL,
	"pricing_unit" "pricing_unit" DEFAULT 'per_item' NOT NULL,
	"status" "catalog_item_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_accounts" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"account_name" varchar(200) NOT NULL,
	"phone" varchar(32),
	"email" varchar(320),
	"status" "customer_account_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"customer_account_id" varchar(26) NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"user_id" varchar(26),
	"full_name" varchar(200) NOT NULL,
	"phone" varchar(32),
	"email" varchar(320),
	"relationship" varchar(80),
	"address" text,
	"notes" text,
	"status" "customer_profile_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"order_id" varchar(26) NOT NULL,
	"ticket_id" varchar(26),
	"tenant_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"customer_id" varchar(26) NOT NULL,
	"source_type" "order_item_source_type" NOT NULL,
	"source_id" varchar(26) NOT NULL,
	"item_name" varchar(200) NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"unit_amount" numeric(12, 2) NOT NULL,
	"line_amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"customer_id" varchar(26) NOT NULL,
	"order_type" "order_type" DEFAULT 'ticket' NOT NULL,
	"status" "order_status" DEFAULT 'draft' NOT NULL,
	"total_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"payment_status" "order_payment_status" DEFAULT 'unpaid' NOT NULL,
	"paid_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"paid_at" timestamp with time zone,
	"expire_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"customer_id" varchar(26) NOT NULL,
	"order_id" varchar(26) NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_status" "payment_transaction_status" DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_login_lockouts" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"lock_key" varchar(320) NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_refresh_tokens" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"user_id" varchar(26) NOT NULL,
	"tenant_id" varchar(26),
	"token_hash" text NOT NULL,
	"family_id" varchar(26) NOT NULL,
	"device_id" varchar(120),
	"user_agent" text,
	"ip_address" varchar(64),
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"replaced_by_token_id" varchar(26),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"scope" "permission_scope" NOT NULL,
	"code" varchar(120) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" varchar(26) NOT NULL,
	"permission_id" varchar(26) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26),
	"scope" "role_scope" NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"status" "role_status" DEFAULT 'active' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"user_id" varchar(26) NOT NULL,
	"role_id" varchar(26) NOT NULL,
	"tenant_id" varchar(26),
	"branch_id" varchar(26),
	"assigned_by" varchar(26),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" varchar(26) PRIMARY KEY NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"first_name" varchar(80),
	"last_name" varchar(80),
	"avatar_url" text,
	"language" varchar(16) DEFAULT 'en' NOT NULL,
	"timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26),
	"user_type" "user_type" NOT NULL,
	"email" varchar(320),
	"normalized_email" varchar(320),
	"phone" varchar(32),
	"password_hash" text NOT NULL,
	"pin_hash" text NOT NULL,
	"status" "user_status" DEFAULT 'invited' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "hardware_configs" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"device_type" "hardware_device_type" NOT NULL,
	"name" varchar(200) NOT NULL,
	"connection_type" "hardware_connection_type" NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "catalog_item_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26),
	"branch_id" varchar(26),
	"actor_user_id" varchar(26),
	"event_category" varchar(80) NOT NULL,
	"event_type" varchar(120) NOT NULL,
	"entity_type" varchar(80),
	"entity_id" varchar(26),
	"success" boolean DEFAULT true NOT NULL,
	"reason" text,
	"ip_address" varchar(64),
	"user_agent" text,
	"before" jsonb,
	"after" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "notification_configs" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26),
	"template_id" varchar(26) NOT NULL,
	"config_name" varchar(120) NOT NULL,
	"notice_type" "notice_type" NOT NULL,
	"trigger_type" "notice_trigger_type" NOT NULL,
	"trigger_event" varchar(120),
	"trigger_cron" varchar(120),
	"channel" "notice_channel" NOT NULL,
	"recipient_type" "notice_recipient_type" NOT NULL,
	"recipient_role" varchar(80),
	"recipient_user_id" varchar(26),
	"frequency_limit" integer,
	"frequency_window_minutes" integer,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26),
	"notification_id" varchar(26) NOT NULL,
	"channel" "notice_channel" NOT NULL,
	"recipient_type" "notice_recipient_type" NOT NULL,
	"recipient_id" varchar(26),
	"sender_type" "notice_sender_type" DEFAULT 'system' NOT NULL,
	"sender_id" varchar(26),
	"status" "notice_delivery_status" DEFAULT 'pending' NOT NULL,
	"read_status" "notice_read_status" DEFAULT 'unread' NOT NULL,
	"priority" "notice_priority" DEFAULT 'normal' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"next_retry_at" timestamp with time zone,
	"external_id" varchar(120),
	"failed_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"user_id" varchar(26) NOT NULL,
	"notice_type" "notice_type" NOT NULL,
	"channel" "notice_channel" NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_settings" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26),
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26),
	"template_code" varchar(80) NOT NULL,
	"template_name" varchar(120) NOT NULL,
	"notice_type" "notice_type" NOT NULL,
	"locale" varchar(16) NOT NULL,
	"title_template" text NOT NULL,
	"content_template" text NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26),
	"scope" "notice_scope" NOT NULL,
	"notice_type" "notice_type" NOT NULL,
	"config_id" varchar(26),
	"template_id" varchar(26),
	"related_type" varchar(80),
	"related_id" varchar(26),
	"title" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"locale" varchar(16) NOT NULL,
	"payload" jsonb,
	"priority" "notice_priority" DEFAULT 'normal' NOT NULL,
	"idempotency_key" varchar(120),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
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
CREATE TABLE "branches" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"name" varchar(200) NOT NULL,
	"address" text,
	"phone" varchar(32),
	"business_hours" jsonb,
	"default_language" varchar(16) DEFAULT 'en' NOT NULL,
	"default_currency" varchar(3) DEFAULT 'XOF' NOT NULL,
	"receipt_name" varchar(200),
	"receipt_phone" varchar(32),
	"receipt_address" text,
	"logo_url" text,
	"status" "branch_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_branches" (
	"user_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_branches_pk" PRIMARY KEY("user_id","branch_id")
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
CREATE TABLE "tenants" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"pressing_code" text NOT NULL,
	"status" "tenant_status" DEFAULT 'active' NOT NULL,
	"country" varchar(80),
	"city" varchar(120),
	"contact_name" varchar(120),
	"contact_phone" varchar(32),
	"contact_email" varchar(320),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "tenants_pressing_code_unique" UNIQUE("pressing_code")
);
--> statement-breakpoint
CREATE TABLE "service_tickets" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"customer_id" varchar(26) NOT NULL,
	"assistant_id" varchar(26),
	"ticket_no" varchar(32),
	"ticket_type" "business_line" NOT NULL,
	"ticket_status" "ticket_status" DEFAULT 'draft' NOT NULL,
	"expected_pickup_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"priority" "ticket_priority" DEFAULT 'normal' NOT NULL,
	"remark" text,
	"source_channel" "ticket_source_channel" DEFAULT 'pos' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_items" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"ticket_id" varchar(26) NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"service_id" varchar(26),
	"item_type" "ticket_item_type",
	"item_name" varchar(200) NOT NULL,
	"item_category" varchar(80),
	"item_status" "ticket_item_status" DEFAULT 'washing' NOT NULL,
	"item_color" varchar(40),
	"item_brand" varchar(80),
	"item_material" varchar(80),
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_amount" numeric(12, 2) NOT NULL,
	"line_amount" numeric(12, 2) NOT NULL,
	"remark" text,
	"defect_notes" text,
	"special_request" text,
	"label_code" varchar(64),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_accounts" ADD CONSTRAINT "customer_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_accounts" ADD CONSTRAINT "customer_accounts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_accounts" ADD CONSTRAINT "customer_accounts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_accounts" ADD CONSTRAINT "customer_accounts_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_customer_account_id_customer_accounts_id_fk" FOREIGN KEY ("customer_account_id") REFERENCES "public"."customer_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_refresh_tokens" ADD CONSTRAINT "auth_refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_refresh_tokens" ADD CONSTRAINT "auth_refresh_tokens_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup_jobs" ADD CONSTRAINT "backup_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup_jobs" ADD CONSTRAINT "backup_jobs_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup_jobs" ADD CONSTRAINT "backup_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup_jobs" ADD CONSTRAINT "backup_jobs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup_jobs" ADD CONSTRAINT "backup_jobs_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restore_requests" ADD CONSTRAINT "restore_requests_backup_job_id_backup_jobs_id_fk" FOREIGN KEY ("backup_job_id") REFERENCES "public"."backup_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restore_requests" ADD CONSTRAINT "restore_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restore_requests" ADD CONSTRAINT "restore_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restore_requests" ADD CONSTRAINT "restore_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restore_requests" ADD CONSTRAINT "restore_requests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restore_requests" ADD CONSTRAINT "restore_requests_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restore_requests" ADD CONSTRAINT "restore_requests_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_configs" ADD CONSTRAINT "hardware_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_configs" ADD CONSTRAINT "hardware_configs_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_configs" ADD CONSTRAINT "hardware_configs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_configs" ADD CONSTRAINT "hardware_configs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_configs" ADD CONSTRAINT "hardware_configs_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation_logs" ADD CONSTRAINT "operation_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation_logs" ADD CONSTRAINT "operation_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_configs" ADD CONSTRAINT "notification_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_configs" ADD CONSTRAINT "notification_configs_template_id_notification_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."notification_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_configs" ADD CONSTRAINT "notification_configs_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_configs" ADD CONSTRAINT "notification_configs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_configs" ADD CONSTRAINT "notification_configs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_configs" ADD CONSTRAINT "notification_configs_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_config_id_notification_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."notification_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_template_id_notification_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."notification_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_settings" ADD CONSTRAINT "security_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_tickets" ADD CONSTRAINT "feedback_tickets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_tickets" ADD CONSTRAINT "feedback_tickets_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_tickets" ADD CONSTRAINT "feedback_tickets_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_tickets" ADD CONSTRAINT "feedback_tickets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_tickets" ADD CONSTRAINT "feedback_tickets_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_tickets" ADD CONSTRAINT "feedback_tickets_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_branches" ADD CONSTRAINT "user_branches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_branches" ADD CONSTRAINT "user_branches_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_branches" ADD CONSTRAINT "user_branches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_feature_flags" ADD CONSTRAINT "tenant_feature_flags_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_feature_flags" ADD CONSTRAINT "tenant_feature_flags_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_assistant_id_users_id_fk" FOREIGN KEY ("assistant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_items" ADD CONSTRAINT "ticket_items_ticket_id_service_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."service_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_items" ADD CONSTRAINT "ticket_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_items" ADD CONSTRAINT "ticket_items_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_items" ADD CONSTRAINT "ticket_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_items" ADD CONSTRAINT "ticket_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_items" ADD CONSTRAINT "ticket_items_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_items" ADD CONSTRAINT "ticket_items_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "prices_service_id_unique" ON "prices" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "prices_tenant_id_idx" ON "prices" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "prices_status_idx" ON "prices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "prices_deleted_at_idx" ON "prices" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "services_tenant_id_idx" ON "services" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "services_business_line_idx" ON "services" USING btree ("business_line");--> statement-breakpoint
CREATE INDEX "services_status_idx" ON "services" USING btree ("status");--> statement-breakpoint
CREATE INDEX "services_deleted_at_idx" ON "services" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_accounts_tenant_phone_unique" ON "customer_accounts" USING btree ("tenant_id","phone");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_accounts_tenant_email_unique" ON "customer_accounts" USING btree ("tenant_id","email");--> statement-breakpoint
CREATE INDEX "customer_accounts_tenant_id_idx" ON "customer_accounts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "customer_accounts_tenant_status_idx" ON "customer_accounts" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "customer_accounts_deleted_at_idx" ON "customer_accounts" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "customers_tenant_account_idx" ON "customers" USING btree ("tenant_id","customer_account_id");--> statement-breakpoint
CREATE INDEX "customers_tenant_phone_idx" ON "customers" USING btree ("tenant_id","phone");--> statement-breakpoint
CREATE INDEX "customers_tenant_status_idx" ON "customers" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "customers_tenant_id_deleted_at_idx" ON "customers" USING btree ("tenant_id","deleted_at");--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_tenant_id_idx" ON "order_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "order_items_ticket_id_idx" ON "order_items" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "order_items_source_idx" ON "order_items" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "orders_tenant_id_branch_id_idx" ON "orders" USING btree ("tenant_id","branch_id");--> statement-breakpoint
CREATE INDEX "orders_tenant_id_status_idx" ON "orders" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "orders_customer_id_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "orders_deleted_at_idx" ON "orders" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "payment_transactions_order_id_idx" ON "payment_transactions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payment_transactions_tenant_branch_paid_at_idx" ON "payment_transactions" USING btree ("tenant_id","branch_id","paid_at");--> statement-breakpoint
CREATE INDEX "payment_transactions_deleted_at_idx" ON "payment_transactions" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_login_lockouts_lock_key_unique" ON "auth_login_lockouts" USING btree ("lock_key");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_refresh_tokens_token_hash_unique" ON "auth_refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "auth_refresh_tokens_user_id_idx" ON "auth_refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_refresh_tokens_family_id_idx" ON "auth_refresh_tokens" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "auth_refresh_tokens_expires_at_idx" ON "auth_refresh_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "auth_refresh_tokens_revoked_at_idx" ON "auth_refresh_tokens" USING btree ("revoked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_code_unique" ON "permissions" USING btree ("code");--> statement-breakpoint
CREATE INDEX "permissions_scope_idx" ON "permissions" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions" USING btree ("permission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_tenant_scope_code_unique" ON "roles" USING btree ("tenant_id","scope","code");--> statement-breakpoint
CREATE INDEX "roles_tenant_id_idx" ON "roles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "roles_scope_idx" ON "roles" USING btree ("scope");--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_user_role_tenant_branch_unique" ON "user_roles" USING btree ("user_id","role_id","tenant_id","branch_id");--> statement-breakpoint
CREATE INDEX "user_roles_user_id_idx" ON "user_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_roles_role_id_idx" ON "user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "user_roles_tenant_id_idx" ON "user_roles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "user_roles_branch_id_idx" ON "user_roles" USING btree ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_tenant_normalized_email_unique" ON "users" USING btree ("tenant_id","normalized_email");--> statement-breakpoint
CREATE INDEX "users_tenant_id_idx" ON "users" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "backup_jobs_tenant_id_idx" ON "backup_jobs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "backup_jobs_scope_idx" ON "backup_jobs" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "backup_jobs_status_idx" ON "backup_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "backup_jobs_created_at_idx" ON "backup_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "restore_requests_backup_job_id_idx" ON "restore_requests" USING btree ("backup_job_id");--> statement-breakpoint
CREATE INDEX "restore_requests_tenant_id_idx" ON "restore_requests" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "restore_requests_status_idx" ON "restore_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "restore_requests_created_at_idx" ON "restore_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "hardware_configs_tenant_id_idx" ON "hardware_configs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "hardware_configs_branch_id_idx" ON "hardware_configs" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "hardware_configs_status_idx" ON "hardware_configs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "hardware_configs_deleted_at_idx" ON "hardware_configs" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "audit_logs_tenant_id_idx" ON "audit_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_logs_branch_id_idx" ON "audit_logs" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_event_category_idx" ON "audit_logs" USING btree ("event_category");--> statement-breakpoint
CREATE INDEX "audit_logs_event_type_idx" ON "audit_logs" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "operation_logs_tenant_id_idx" ON "operation_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "operation_logs_branch_id_idx" ON "operation_logs" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "operation_logs_level_idx" ON "operation_logs" USING btree ("level");--> statement-breakpoint
CREATE INDEX "operation_logs_service_idx" ON "operation_logs" USING btree ("service");--> statement-breakpoint
CREATE INDEX "operation_logs_event_type_idx" ON "operation_logs" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "operation_logs_created_at_idx" ON "operation_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notification_configs_tenant_trigger_event_idx" ON "notification_configs" USING btree ("tenant_id","trigger_event");--> statement-breakpoint
CREATE INDEX "notification_configs_tenant_trigger_type_idx" ON "notification_configs" USING btree ("tenant_id","trigger_type");--> statement-breakpoint
CREATE INDEX "notification_configs_template_id_idx" ON "notification_configs" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "notification_deliveries_notification_id_idx" ON "notification_deliveries" USING btree ("notification_id");--> statement-breakpoint
CREATE INDEX "notification_deliveries_recipient_idx" ON "notification_deliveries" USING btree ("tenant_id","recipient_type","recipient_id","read_status");--> statement-breakpoint
CREATE INDEX "notification_deliveries_channel_status_idx" ON "notification_deliveries" USING btree ("tenant_id","channel","status");--> statement-breakpoint
CREATE INDEX "notification_deliveries_retry_idx" ON "notification_deliveries" USING btree ("status","next_retry_at");--> statement-breakpoint
CREATE INDEX "notification_deliveries_external_id_idx" ON "notification_deliveries" USING btree ("external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_user_type_channel_unique" ON "notification_preferences" USING btree ("tenant_id","user_id","notice_type","channel");--> statement-breakpoint
CREATE INDEX "notification_preferences_user_id_idx" ON "notification_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_settings_tenant_id_unique" ON "notification_settings" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_templates_tenant_code_locale_unique" ON "notification_templates" USING btree ("tenant_id","template_code","locale");--> statement-breakpoint
CREATE INDEX "notification_templates_tenant_id_idx" ON "notification_templates" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "notification_templates_template_code_idx" ON "notification_templates" USING btree ("template_code");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_tenant_idempotency_key_unique" ON "notifications" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "notifications_tenant_scope_type_idx" ON "notifications" USING btree ("tenant_id","scope","notice_type");--> statement-breakpoint
CREATE INDEX "notifications_related_idx" ON "notifications" USING btree ("related_type","related_id");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "security_events_tenant_id_idx" ON "security_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "security_events_branch_id_idx" ON "security_events" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "security_events_actor_user_id_idx" ON "security_events" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "security_events_event_type_idx" ON "security_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "security_events_severity_idx" ON "security_events" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "security_events_created_at_idx" ON "security_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "security_settings_setting_key_unique" ON "security_settings" USING btree ("setting_key");--> statement-breakpoint
CREATE INDEX "security_settings_updated_by_idx" ON "security_settings" USING btree ("updated_by");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_settings_setting_key_unique" ON "platform_settings" USING btree ("setting_key");--> statement-breakpoint
CREATE INDEX "platform_settings_updated_by_idx" ON "platform_settings" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "feedback_tickets_tenant_id_idx" ON "feedback_tickets" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "feedback_tickets_branch_id_idx" ON "feedback_tickets" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "feedback_tickets_status_idx" ON "feedback_tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "feedback_tickets_assignee_user_id_idx" ON "feedback_tickets" USING btree ("assignee_user_id");--> statement-breakpoint
CREATE INDEX "feedback_tickets_created_at_idx" ON "feedback_tickets" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "branches_tenant_id_idx" ON "branches" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "branches_status_idx" ON "branches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "branches_deleted_at_idx" ON "branches" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "user_branches_tenant_id_idx" ON "user_branches" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "user_branches_branch_id_idx" ON "user_branches" USING btree ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_feature_flags_tenant_id_unique" ON "tenant_feature_flags" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_feature_flags_updated_by_idx" ON "tenant_feature_flags" USING btree ("updated_by");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_settings_tenant_id_unique" ON "tenant_settings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_settings_updated_by_idx" ON "tenant_settings" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "tenants_status_idx" ON "tenants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tenants_deleted_at_idx" ON "tenants" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "service_tickets_tenant_ticket_no_unique" ON "service_tickets" USING btree ("tenant_id","ticket_no");--> statement-breakpoint
CREATE INDEX "service_tickets_tenant_branch_status_idx" ON "service_tickets" USING btree ("tenant_id","branch_id","ticket_status");--> statement-breakpoint
CREATE INDEX "service_tickets_tenant_customer_idx" ON "service_tickets" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "service_tickets_status_expected_pickup_idx" ON "service_tickets" USING btree ("tenant_id","ticket_status","expected_pickup_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_items_tenant_label_code_unique" ON "ticket_items" USING btree ("tenant_id","label_code");--> statement-breakpoint
CREATE INDEX "ticket_items_ticket_id_idx" ON "ticket_items" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_items_tenant_id_idx" ON "ticket_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "ticket_items_service_id_idx" ON "ticket_items" USING btree ("service_id");