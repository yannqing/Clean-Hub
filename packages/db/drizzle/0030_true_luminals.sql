CREATE TABLE "service_branch_settings" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"service_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"price_override_amount" numeric(12, 2),
	"turnaround_minutes_override" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "service_branch_settings_price_override_check" CHECK ("service_branch_settings"."price_override_amount" is null or "service_branch_settings"."price_override_amount" > 0),
	CONSTRAINT "service_branch_settings_turnaround_override_check" CHECK ("service_branch_settings"."turnaround_minutes_override" is null or ("service_branch_settings"."turnaround_minutes_override" >= 1 and "service_branch_settings"."turnaround_minutes_override" <= 525600))
);
--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "all_branches" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "service_branch_settings" ADD CONSTRAINT "service_branch_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_branch_settings" ADD CONSTRAINT "service_branch_settings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_branch_settings" ADD CONSTRAINT "service_branch_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_branch_settings" ADD CONSTRAINT "service_branch_settings_tenant_service_fk" FOREIGN KEY ("tenant_id","service_id") REFERENCES "public"."services"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_branch_settings" ADD CONSTRAINT "service_branch_settings_tenant_branch_fk" FOREIGN KEY ("tenant_id","branch_id") REFERENCES "public"."branches"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "service_branch_settings_scope_unique" ON "service_branch_settings" USING btree ("tenant_id","service_id","branch_id");--> statement-breakpoint
CREATE INDEX "service_branch_settings_branch_available_idx" ON "service_branch_settings" USING btree ("tenant_id","branch_id","is_available");--> statement-breakpoint
CREATE INDEX "service_branch_settings_service_idx" ON "service_branch_settings" USING btree ("tenant_id","service_id");