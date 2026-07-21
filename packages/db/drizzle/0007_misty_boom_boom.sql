CREATE TYPE "public"."mobile_push_platform" AS ENUM('android', 'ios', 'web');--> statement-breakpoint
CREATE TYPE "public"."mobile_push_subject_type" AS ENUM('customer', 'staff');--> statement-breakpoint
ALTER TYPE "public"."notice_channel" ADD VALUE 'push';--> statement-breakpoint
CREATE TABLE "mobile_push_tokens" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"subject_type" "mobile_push_subject_type" NOT NULL,
	"subject_id" varchar(26) NOT NULL,
	"platform" "mobile_push_platform" NOT NULL,
	"token" text NOT NULL,
	"device_id" varchar(120),
	"locale" varchar(16),
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mobile_push_tokens" ADD CONSTRAINT "mobile_push_tokens_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mobile_push_tokens_token_unique" ON "mobile_push_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "mobile_push_tokens_subject_idx" ON "mobile_push_tokens" USING btree ("tenant_id","subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "mobile_push_tokens_device_id_idx" ON "mobile_push_tokens" USING btree ("device_id");