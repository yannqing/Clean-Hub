CREATE TABLE "order_comment_attachments" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"comment_id" varchar(26) NOT NULL,
	"media_object_id" varchar(26) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_comment_attachments" ADD CONSTRAINT "order_comment_attachments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_comment_attachments" ADD CONSTRAINT "order_comment_attachments_comment_id_order_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."order_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_comment_attachments" ADD CONSTRAINT "order_comment_attachments_media_object_id_media_objects_id_fk" FOREIGN KEY ("media_object_id") REFERENCES "public"."media_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "order_comment_attachments_comment_media_unique" ON "order_comment_attachments" USING btree ("comment_id","media_object_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_comment_attachments_tenant_media_unique" ON "order_comment_attachments" USING btree ("tenant_id","media_object_id");--> statement-breakpoint
CREATE INDEX "order_comment_attachments_comment_id_idx" ON "order_comment_attachments" USING btree ("comment_id");