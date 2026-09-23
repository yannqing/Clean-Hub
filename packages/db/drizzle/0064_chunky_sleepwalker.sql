CREATE TABLE "tax_rates" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"name" varchar(80) NOT NULL,
	"rate" numeric(7, 4) NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "tax_rates_rate_fraction_check" CHECK ("tax_rates"."rate" >= 0 and "tax_rates"."rate" <= 1)
);
--> statement-breakpoint
CREATE TABLE "platform_tax_templates" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"name" varchar(120) NOT NULL,
	"tax_enabled" boolean DEFAULT true NOT NULL,
	"prices_include_tax" boolean DEFAULT true NOT NULL,
	"rates" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "platform_tax_templates_country_code_check" CHECK ("platform_tax_templates"."country_code" ~ '^[A-Z]{2}$'),
	CONSTRAINT "platform_tax_templates_rates_array_check" CHECK (jsonb_typeof("platform_tax_templates"."rates") = 'array')
);
--> statement-breakpoint
ALTER TABLE "pos_channel_settings" DROP CONSTRAINT "pos_channel_settings_tax_rate_check";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tax_rate_id" varchar(26);--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "tax_rate_id" varchar(26);--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "maintenance_message" text;--> statement-breakpoint
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_tax_templates" ADD CONSTRAINT "platform_tax_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tax_rates_tenant_id_id_unique" ON "tax_rates" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_rates_active_name_unique" ON "tax_rates" USING btree ("tenant_id",lower("name")) WHERE "tax_rates"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "tax_rates_tenant_order_idx" ON "tax_rates" USING btree ("tenant_id","display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_tax_templates_country_unique" ON "platform_tax_templates" USING btree ("country_code");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_tax_rate_fk" FOREIGN KEY ("tenant_id","tax_rate_id") REFERENCES "public"."tax_rates"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_tenant_tax_rate_fk" FOREIGN KEY ("tenant_id","tax_rate_id") REFERENCES "public"."tax_rates"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_channel_settings" ADD CONSTRAINT "pos_channel_settings_tax_rate_check" CHECK ("pos_channel_settings"."default_tax_rate" >= 0 and "pos_channel_settings"."default_tax_rate" <= 1);--> statement-breakpoint

-- Tenant isolation for the new tenant-scoped table, matching every other one.
-- The API refuses to start while any tenant table lacks a forced policy.
ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.tax_rates FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY cleanhub_tenant_isolation
ON public.tax_rates
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
);--> statement-breakpoint

-- Platform tax templates are platform configuration, like platform_settings:
-- only SaaS administration, running with the RLS bypass, reads or writes them.
ALTER TABLE public.platform_tax_templates ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.platform_tax_templates FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY cleanhub_tenant_isolation
ON public.platform_tax_templates
AS PERMISSIVE
FOR ALL
TO PUBLIC
USING (public.cleanhub_rls_bypass_enabled())
WITH CHECK (public.cleanhub_rls_bypass_enabled());--> statement-breakpoint

-- The two markets CleanHub launches in. Both levy 18% VAT (TVA) at the
-- standard rate. Rates are fractions. SaaS administrators can edit these and
-- add other countries from Platform Settings.
INSERT INTO public.platform_tax_templates (id, country_code, name, tax_enabled, prices_include_tax, rates)
VALUES
  (
    '01KSNTX0000000000000000001',
    'SN',
    'Sénégal - TVA',
    true,
    true,
    '[{"name":"TVA 18%","rate":"0.1800","isDefault":true},{"name":"Exonéré","rate":"0.0000","isDefault":false}]'::jsonb
  ),
  (
    '01KC0TX0000000000000000002',
    'CI',
    'Côte d''Ivoire - TVA',
    true,
    true,
    '[{"name":"TVA 18%","rate":"0.1800","isDefault":true},{"name":"TVA réduite 9%","rate":"0.0900","isDefault":false},{"name":"Exonéré","rate":"0.0000","isDefault":false}]'::jsonb
  )
ON CONFLICT (country_code) DO NOTHING;
