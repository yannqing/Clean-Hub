CREATE TYPE "public"."appointment_status" AS ENUM('pending', 'accepted', 'cancelled', 'done');--> statement-breakpoint
CREATE TYPE "public"."appointment_type" AS ENUM('pickup', 'dropoff');--> statement-breakpoint
CREATE TYPE "public"."customer_auth_otp_purpose" AS ENUM('login', 'password_reset');--> statement-breakpoint
CREATE TYPE "public"."delivery_task_status" AS ENUM('pending_dispatch', 'en_route', 'arrived', 'picked_up', 'delivering', 'signed', 'exception', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."delivery_task_type" AS ENUM('pickup', 'dropoff');--> statement-breakpoint
CREATE TYPE "public"."delivery_proof_type" AS ENUM('pickup', 'dropoff', 'signature');--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"customer_id" varchar(26) NOT NULL,
	"type" "appointment_type" NOT NULL,
	"status" "appointment_status" DEFAULT 'pending' NOT NULL,
	"expected_at" timestamp with time zone NOT NULL,
	"address" text NOT NULL,
	"notes" text,
	"accepted_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_auth_otps" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"customer_account_id" varchar(26) NOT NULL,
	"phone" varchar(32) NOT NULL,
	"code" varchar(16) NOT NULL,
	"purpose" "customer_auth_otp_purpose" DEFAULT 'login' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_auth_refresh_tokens" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"customer_account_id" varchar(26) NOT NULL,
	"token_hash" text NOT NULL,
	"family_id" varchar(26) NOT NULL,
	"device_id" varchar(120),
	"user_agent" text,
	"ip_address" varchar(64),
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"replaced_by_token_id" varchar(26),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_credentials" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"customer_account_id" varchar(26) NOT NULL,
	"password_hash" text NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_tasks" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"assignee_user_id" varchar(26),
	"customer_id" varchar(26) NOT NULL,
	"order_id" varchar(26),
	"ticket_id" varchar(26),
	"type" "delivery_task_type" NOT NULL,
	"status" "delivery_task_status" DEFAULT 'pending_dispatch' NOT NULL,
	"expected_at" timestamp with time zone,
	"customer_name" varchar(200) NOT NULL,
	"customer_phone" varchar(32),
	"address" text NOT NULL,
	"notes" text,
	"exception_reason" text,
	"started_at" timestamp with time zone,
	"arrived_at" timestamp with time zone,
	"picked_up_at" timestamp with time zone,
	"signed_at" timestamp with time zone,
	"exception_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_task_events" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"task_id" varchar(26) NOT NULL,
	"from_status" "delivery_task_status",
	"to_status" "delivery_task_status" NOT NULL,
	"lat" numeric(10, 7),
	"lng" numeric(10, 7),
	"device_id" varchar(120),
	"idempotency_key" varchar(120) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26)
);
--> statement-breakpoint
CREATE TABLE "delivery_proofs" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"task_id" varchar(26) NOT NULL,
	"type" "delivery_proof_type" NOT NULL,
	"media_ref" text NOT NULL,
	"device_id" varchar(120),
	"idempotency_key" varchar(120) NOT NULL,
	"captured_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26)
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_auth_otps" ADD CONSTRAINT "customer_auth_otps_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_auth_otps" ADD CONSTRAINT "customer_auth_otps_customer_account_id_customer_accounts_id_fk" FOREIGN KEY ("customer_account_id") REFERENCES "public"."customer_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_auth_refresh_tokens" ADD CONSTRAINT "customer_auth_refresh_tokens_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_auth_refresh_tokens" ADD CONSTRAINT "customer_auth_refresh_tokens_customer_account_id_customer_accounts_id_fk" FOREIGN KEY ("customer_account_id") REFERENCES "public"."customer_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_credentials" ADD CONSTRAINT "customer_credentials_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_credentials" ADD CONSTRAINT "customer_credentials_customer_account_id_customer_accounts_id_fk" FOREIGN KEY ("customer_account_id") REFERENCES "public"."customer_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_credentials" ADD CONSTRAINT "customer_credentials_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_credentials" ADD CONSTRAINT "customer_credentials_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_credentials" ADD CONSTRAINT "customer_credentials_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_ticket_id_service_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."service_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_task_events" ADD CONSTRAINT "delivery_task_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_task_events" ADD CONSTRAINT "delivery_task_events_task_id_delivery_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."delivery_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_task_events" ADD CONSTRAINT "delivery_task_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_proofs" ADD CONSTRAINT "delivery_proofs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_proofs" ADD CONSTRAINT "delivery_proofs_task_id_delivery_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."delivery_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_proofs" ADD CONSTRAINT "delivery_proofs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_tenant_branch_status_idx" ON "appointments" USING btree ("tenant_id","branch_id","status");--> statement-breakpoint
CREATE INDEX "appointments_tenant_customer_idx" ON "appointments" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "appointments_expected_at_idx" ON "appointments" USING btree ("expected_at");--> statement-breakpoint
CREATE INDEX "appointments_deleted_at_idx" ON "appointments" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "customer_auth_otps_tenant_phone_purpose_idx" ON "customer_auth_otps" USING btree ("tenant_id","phone","purpose");--> statement-breakpoint
CREATE INDEX "customer_auth_otps_customer_account_id_idx" ON "customer_auth_otps" USING btree ("customer_account_id");--> statement-breakpoint
CREATE INDEX "customer_auth_otps_expires_at_idx" ON "customer_auth_otps" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "customer_auth_otps_consumed_at_idx" ON "customer_auth_otps" USING btree ("consumed_at");--> statement-breakpoint
CREATE INDEX "customer_auth_otps_deleted_at_idx" ON "customer_auth_otps" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_auth_refresh_tokens_token_hash_unique" ON "customer_auth_refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "customer_auth_refresh_tokens_customer_account_id_idx" ON "customer_auth_refresh_tokens" USING btree ("customer_account_id");--> statement-breakpoint
CREATE INDEX "customer_auth_refresh_tokens_tenant_id_idx" ON "customer_auth_refresh_tokens" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "customer_auth_refresh_tokens_family_id_idx" ON "customer_auth_refresh_tokens" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "customer_auth_refresh_tokens_expires_at_idx" ON "customer_auth_refresh_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "customer_auth_refresh_tokens_revoked_at_idx" ON "customer_auth_refresh_tokens" USING btree ("revoked_at");--> statement-breakpoint
CREATE INDEX "customer_auth_refresh_tokens_deleted_at_idx" ON "customer_auth_refresh_tokens" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_credentials_account_unique" ON "customer_credentials" USING btree ("customer_account_id");--> statement-breakpoint
CREATE INDEX "customer_credentials_tenant_id_idx" ON "customer_credentials" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "customer_credentials_deleted_at_idx" ON "customer_credentials" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "delivery_tasks_tenant_branch_status_idx" ON "delivery_tasks" USING btree ("tenant_id","branch_id","status");--> statement-breakpoint
CREATE INDEX "delivery_tasks_assignee_status_idx" ON "delivery_tasks" USING btree ("assignee_user_id","status");--> statement-breakpoint
CREATE INDEX "delivery_tasks_tenant_assignee_expected_idx" ON "delivery_tasks" USING btree ("tenant_id","assignee_user_id","expected_at");--> statement-breakpoint
CREATE INDEX "delivery_tasks_customer_id_idx" ON "delivery_tasks" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "delivery_tasks_order_id_idx" ON "delivery_tasks" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "delivery_tasks_ticket_id_idx" ON "delivery_tasks" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "delivery_tasks_deleted_at_idx" ON "delivery_tasks" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_task_events_task_id_idempotency_key_unique" ON "delivery_task_events" USING btree ("task_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "delivery_task_events_tenant_id_idx" ON "delivery_task_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "delivery_task_events_task_id_created_at_idx" ON "delivery_task_events" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "delivery_task_events_to_status_idx" ON "delivery_task_events" USING btree ("to_status");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_proofs_task_id_idempotency_key_unique" ON "delivery_proofs" USING btree ("task_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "delivery_proofs_tenant_id_idx" ON "delivery_proofs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "delivery_proofs_task_id_type_idx" ON "delivery_proofs" USING btree ("task_id","type");--> statement-breakpoint
CREATE INDEX "delivery_proofs_created_at_idx" ON "delivery_proofs" USING btree ("created_at");