CREATE TYPE "public"."payment_callback_processing_status" AS ENUM('received', 'processed', 'rejected', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_initiator_type" AS ENUM('staff', 'customer');--> statement-breakpoint
CREATE TYPE "public"."refund_request_status" AS ENUM('pending', 'approved', 'processing', 'rejected', 'refunded', 'failed');--> statement-breakpoint
CREATE TABLE "payment_callbacks" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26),
	"gateway" varchar(80) NOT NULL,
	"external_id" varchar(120) NOT NULL,
	"event" varchar(120) NOT NULL,
	"signature_verified" boolean DEFAULT false NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"processing_status" "payment_callback_processing_status" DEFAULT 'received' NOT NULL,
	"failure_reason" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refund_requests" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"customer_account_id" varchar(26) NOT NULL,
	"customer_id" varchar(26) NOT NULL,
	"order_id" varchar(26) NOT NULL,
	"payment_transaction_id" varchar(26),
	"amount" numeric(12, 2) NOT NULL,
	"reason" text NOT NULL,
	"status" "refund_request_status" DEFAULT 'pending' NOT NULL,
	"gateway" varchar(80),
	"external_id" varchar(120),
	"approved_at" timestamp with time zone,
	"approved_by" varchar(26),
	"rejected_at" timestamp with time zone,
	"rejected_by" varchar(26),
	"rejection_reason" text,
	"refunded_at" timestamp with time zone,
	"failed_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_transactions" ALTER COLUMN "created_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD COLUMN "idempotency_key" varchar(120);--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD COLUMN "initiator_type" "payment_initiator_type" DEFAULT 'staff' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD COLUMN "gateway" varchar(80);--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD COLUMN "external_id" varchar(120);--> statement-breakpoint
ALTER TABLE "payment_callbacks" ADD CONSTRAINT "payment_callbacks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_customer_account_id_customer_accounts_id_fk" FOREIGN KEY ("customer_account_id") REFERENCES "public"."customer_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_payment_transaction_id_payment_transactions_id_fk" FOREIGN KEY ("payment_transaction_id") REFERENCES "public"."payment_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_callbacks_gateway_external_event_unique" ON "payment_callbacks" USING btree ("gateway","external_id","event") WHERE "signature_verified" = true;--> statement-breakpoint
CREATE INDEX "payment_callbacks_tenant_id_idx" ON "payment_callbacks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "payment_callbacks_status_created_at_idx" ON "payment_callbacks" USING btree ("processing_status","created_at");--> statement-breakpoint
CREATE INDEX "refund_requests_tenant_status_idx" ON "refund_requests" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "refund_requests_order_id_idx" ON "refund_requests" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "refund_requests_payment_transaction_id_idx" ON "refund_requests" USING btree ("payment_transaction_id");--> statement-breakpoint
CREATE INDEX "refund_requests_gateway_external_id_idx" ON "refund_requests" USING btree ("gateway","external_id");--> statement-breakpoint
CREATE INDEX "refund_requests_deleted_at_idx" ON "refund_requests" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_transactions_tenant_idempotency_key_unique" ON "payment_transactions" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "payment_transactions_gateway_external_id_idx" ON "payment_transactions" USING btree ("gateway","external_id");
