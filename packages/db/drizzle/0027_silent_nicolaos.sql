CREATE TABLE "customer_comment_attachments" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"comment_id" varchar(26) NOT NULL,
	"media_object_id" varchar(26) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_comment_mentions" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"comment_id" varchar(26) NOT NULL,
	"mentioned_user_id" varchar(26) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_comments" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"customer_id" varchar(26) NOT NULL,
	"author_user_id" varchar(26) NOT NULL,
	"body" text NOT NULL,
	"idempotency_key" varchar(120) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "customer_comments_body_length_check" CHECK (char_length(btrim("customer_comments"."body")) between 1 and 2000)
);
--> statement-breakpoint
ALTER TABLE "customer_comment_attachments" ADD CONSTRAINT "customer_comment_attachments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_comment_attachments" ADD CONSTRAINT "customer_comment_attachments_comment_id_customer_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."customer_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_comment_attachments" ADD CONSTRAINT "customer_comment_attachments_media_object_id_media_objects_id_fk" FOREIGN KEY ("media_object_id") REFERENCES "public"."media_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_comment_mentions" ADD CONSTRAINT "customer_comment_mentions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_comment_mentions" ADD CONSTRAINT "customer_comment_mentions_comment_id_customer_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."customer_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_comment_mentions" ADD CONSTRAINT "customer_comment_mentions_mentioned_user_id_users_id_fk" FOREIGN KEY ("mentioned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_comments" ADD CONSTRAINT "customer_comments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_comments" ADD CONSTRAINT "customer_comments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_comments" ADD CONSTRAINT "customer_comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_comments" ADD CONSTRAINT "customer_comments_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_comment_attachments_comment_media_unique" ON "customer_comment_attachments" USING btree ("comment_id","media_object_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_comment_attachments_tenant_media_unique" ON "customer_comment_attachments" USING btree ("tenant_id","media_object_id");--> statement-breakpoint
CREATE INDEX "customer_comment_attachments_comment_id_idx" ON "customer_comment_attachments" USING btree ("comment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_comment_mentions_comment_user_unique" ON "customer_comment_mentions" USING btree ("comment_id","mentioned_user_id");--> statement-breakpoint
CREATE INDEX "customer_comment_mentions_tenant_user_idx" ON "customer_comment_mentions" USING btree ("tenant_id","mentioned_user_id","created_at");--> statement-breakpoint
CREATE INDEX "customer_comment_mentions_comment_id_idx" ON "customer_comment_mentions" USING btree ("comment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_comments_tenant_id_id_unique" ON "customer_comments" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_comments_tenant_customer_idempotency_unique" ON "customer_comments" USING btree ("tenant_id","customer_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "customer_comments_tenant_customer_created_at_idx" ON "customer_comments" USING btree ("tenant_id","customer_id","created_at","id");--> statement-breakpoint
CREATE INDEX "customer_comments_author_user_id_idx" ON "customer_comments" USING btree ("author_user_id");--> statement-breakpoint
CREATE INDEX "customer_comments_deleted_at_idx" ON "customer_comments" USING btree ("deleted_at");