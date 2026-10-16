CREATE TABLE "order_comments" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"order_id" varchar(26) NOT NULL,
	"author_user_id" varchar(26) NOT NULL,
	"body" text NOT NULL,
	"idempotency_key" varchar(120) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "order_comments_body_length_check" CHECK (char_length(btrim("order_comments"."body")) between 1 and 2000)
);
--> statement-breakpoint
ALTER TABLE "order_comments" ADD CONSTRAINT "order_comments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_comments" ADD CONSTRAINT "order_comments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_comments" ADD CONSTRAINT "order_comments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_comments" ADD CONSTRAINT "order_comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_comments" ADD CONSTRAINT "order_comments_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "order_comments_tenant_id_id_unique" ON "order_comments" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_comments_tenant_order_idempotency_unique" ON "order_comments" USING btree ("tenant_id","order_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "order_comments_tenant_order_created_at_idx" ON "order_comments" USING btree ("tenant_id","order_id","created_at","id");--> statement-breakpoint
CREATE INDEX "order_comments_author_user_id_idx" ON "order_comments" USING btree ("author_user_id");--> statement-breakpoint
CREATE INDEX "order_comments_deleted_at_idx" ON "order_comments" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "audit_logs_tenant_entity_created_at_idx" ON "audit_logs" USING btree ("tenant_id","entity_type","entity_id","created_at","id");