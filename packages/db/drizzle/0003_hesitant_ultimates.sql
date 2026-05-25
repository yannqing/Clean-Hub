CREATE TYPE "public"."branch_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."business_line" AS ENUM('laundry', 'car_wash', 'retail', 'delivery');--> statement-breakpoint
CREATE TYPE "public"."catalog_item_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."hardware_connection_type" AS ENUM('usb', 'bluetooth', 'network', 'other');--> statement-breakpoint
CREATE TYPE "public"."hardware_device_type" AS ENUM('printer', 'scanner', 'cash_drawer');--> statement-breakpoint
CREATE TYPE "public"."pricing_unit" AS ENUM('per_item', 'per_kg');--> statement-breakpoint
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
CREATE TABLE "notification_settings" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "user_branches" (
	"user_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_branches_pk" PRIMARY KEY("user_id","branch_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pin_hash" text;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_configs" ADD CONSTRAINT "hardware_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_configs" ADD CONSTRAINT "hardware_configs_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_configs" ADD CONSTRAINT "hardware_configs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_configs" ADD CONSTRAINT "hardware_configs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_configs" ADD CONSTRAINT "hardware_configs_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_branches" ADD CONSTRAINT "user_branches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_branches" ADD CONSTRAINT "user_branches_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_branches" ADD CONSTRAINT "user_branches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "branches_tenant_id_idx" ON "branches" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "branches_status_idx" ON "branches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "branches_deleted_at_idx" ON "branches" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "hardware_configs_tenant_id_idx" ON "hardware_configs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "hardware_configs_branch_id_idx" ON "hardware_configs" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "hardware_configs_status_idx" ON "hardware_configs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "hardware_configs_deleted_at_idx" ON "hardware_configs" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_settings_tenant_id_unique" ON "notification_settings" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prices_service_id_unique" ON "prices" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "prices_tenant_id_idx" ON "prices" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "prices_status_idx" ON "prices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "prices_deleted_at_idx" ON "prices" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "services_tenant_id_idx" ON "services" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "services_business_line_idx" ON "services" USING btree ("business_line");--> statement-breakpoint
CREATE INDEX "services_status_idx" ON "services" USING btree ("status");--> statement-breakpoint
CREATE INDEX "services_deleted_at_idx" ON "services" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "user_branches_tenant_id_idx" ON "user_branches" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "user_branches_branch_id_idx" ON "user_branches" USING btree ("branch_id");