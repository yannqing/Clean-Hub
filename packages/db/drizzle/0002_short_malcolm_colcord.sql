CREATE TYPE "public"."media_object_status" AS ENUM('pending', 'committed');--> statement-breakpoint
CREATE TABLE "media_objects" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"object_key" text NOT NULL,
	"content_type" varchar(120) NOT NULL,
	"size_bytes" integer NOT NULL,
	"status" "media_object_status" DEFAULT 'pending' NOT NULL,
	"purpose" varchar(80) NOT NULL,
	"created_by" varchar(26),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"committed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26)
);
--> statement-breakpoint
ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_objects_object_key_unique" ON "media_objects" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "media_objects_tenant_id_idx" ON "media_objects" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "media_objects_tenant_object_key_idx" ON "media_objects" USING btree ("tenant_id","object_key");--> statement-breakpoint
CREATE INDEX "media_objects_status_expires_at_idx" ON "media_objects" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "media_objects_deleted_at_idx" ON "media_objects" USING btree ("deleted_at");