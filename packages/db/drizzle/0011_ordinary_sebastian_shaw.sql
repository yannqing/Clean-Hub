ALTER TABLE "product_media" DROP CONSTRAINT "product_media_media_object_id_media_objects_id_fk";
--> statement-breakpoint
CREATE UNIQUE INDEX "media_objects_tenant_id_id_unique" ON "media_objects" USING btree ("tenant_id","id");--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_tenant_media_object_fk" FOREIGN KEY ("tenant_id","media_object_id") REFERENCES "public"."media_objects"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_media_tenant_object_unique" ON "product_media" USING btree ("tenant_id","media_object_id") WHERE "product_media"."deleted_at" is null;--> statement-breakpoint
