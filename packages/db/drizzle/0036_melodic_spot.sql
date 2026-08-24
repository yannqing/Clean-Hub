CREATE TYPE "public"."pos_cart_status" AS ENUM('active', 'converted', 'abandoned');--> statement-breakpoint
CREATE TABLE "pos_carts" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"terminal_id" varchar(26) NOT NULL,
	"user_id" varchar(26) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"payload" jsonb NOT NULL,
	"client_updated_at" timestamp with time zone NOT NULL,
	"status" "pos_cart_status" DEFAULT 'active' NOT NULL,
	"converted_order_id" varchar(26),
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(26) NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "pos_carts_version_check" CHECK ("pos_carts"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "pos_carts" ADD CONSTRAINT "pos_carts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_carts" ADD CONSTRAINT "pos_carts_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_carts" ADD CONSTRAINT "pos_carts_terminal_id_pos_terminal_settings_id_fk" FOREIGN KEY ("terminal_id") REFERENCES "public"."pos_terminal_settings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_carts" ADD CONSTRAINT "pos_carts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_carts" ADD CONSTRAINT "pos_carts_converted_order_id_orders_id_fk" FOREIGN KEY ("converted_order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_carts" ADD CONSTRAINT "pos_carts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_carts" ADD CONSTRAINT "pos_carts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pos_carts_active_user_branch_unique" ON "pos_carts" USING btree ("tenant_id","branch_id","user_id") WHERE "pos_carts"."status" = 'active' and "pos_carts"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "pos_carts_tenant_terminal_idx" ON "pos_carts" USING btree ("tenant_id","terminal_id");--> statement-breakpoint
CREATE INDEX "pos_carts_expiry_idx" ON "pos_carts" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "pos_carts_converted_order_idx" ON "pos_carts" USING btree ("converted_order_id");--> statement-breakpoint

ALTER TABLE public.pos_carts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE public.pos_carts FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

DROP POLICY IF EXISTS cleanhub_tenant_isolation ON public.pos_carts;
--> statement-breakpoint

CREATE POLICY cleanhub_tenant_isolation
ON public.pos_carts
AS PERMISSIVE
FOR ALL
TO PUBLIC
USING (
  public.cleanhub_rls_bypass_enabled()
  OR tenant_id::text = public.cleanhub_current_tenant_id()
)
WITH CHECK (
  public.cleanhub_rls_bypass_enabled()
  OR tenant_id::text = public.cleanhub_current_tenant_id()
);
