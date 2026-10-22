CREATE TABLE "order_comment_mentions" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"comment_id" varchar(26) NOT NULL,
	"mentioned_user_id" varchar(26) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_comment_mentions" ADD CONSTRAINT "order_comment_mentions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_comment_mentions" ADD CONSTRAINT "order_comment_mentions_comment_id_order_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."order_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_comment_mentions" ADD CONSTRAINT "order_comment_mentions_mentioned_user_id_users_id_fk" FOREIGN KEY ("mentioned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "order_comment_mentions_comment_user_unique" ON "order_comment_mentions" USING btree ("comment_id","mentioned_user_id");--> statement-breakpoint
CREATE INDEX "order_comment_mentions_tenant_user_idx" ON "order_comment_mentions" USING btree ("tenant_id","mentioned_user_id","created_at");--> statement-breakpoint
CREATE INDEX "order_comment_mentions_comment_id_idx" ON "order_comment_mentions" USING btree ("comment_id");