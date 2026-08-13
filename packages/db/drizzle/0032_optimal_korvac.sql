CREATE TABLE "service_media" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"service_id" varchar(26) NOT NULL,
	"media_object_id" varchar(26) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26)
);
--> statement-breakpoint
ALTER TABLE "service_media" ADD CONSTRAINT "service_media_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_media" ADD CONSTRAINT "service_media_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_media" ADD CONSTRAINT "service_media_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_media" ADD CONSTRAINT "service_media_tenant_service_fk" FOREIGN KEY ("tenant_id","service_id") REFERENCES "public"."services"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_media" ADD CONSTRAINT "service_media_tenant_media_object_fk" FOREIGN KEY ("tenant_id","media_object_id") REFERENCES "public"."media_objects"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "service_media_service_object_unique" ON "service_media" USING btree ("tenant_id","service_id","media_object_id") WHERE "service_media"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "service_media_tenant_object_unique" ON "service_media" USING btree ("tenant_id","media_object_id") WHERE "service_media"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "service_media_service_primary_unique" ON "service_media" USING btree ("tenant_id","service_id") WHERE "service_media"."deleted_at" is null and "service_media"."is_primary" = true;--> statement-breakpoint
CREATE INDEX "service_media_media_object_id_idx" ON "service_media" USING btree ("media_object_id");--> statement-breakpoint
CREATE INDEX "service_media_service_sort_idx" ON "service_media" USING btree ("tenant_id","service_id","sort_order");--> statement-breakpoint
CREATE INDEX "service_media_deleted_at_idx" ON "service_media" USING btree ("deleted_at");