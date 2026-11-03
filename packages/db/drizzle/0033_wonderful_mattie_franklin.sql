ALTER TABLE "user_profiles" ADD COLUMN "tenant_id" varchar(26);--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_profiles_tenant_id_idx" ON "user_profiles" USING btree ("tenant_id");--> statement-breakpoint

UPDATE "user_profiles" AS profile
SET "tenant_id" = app_user."tenant_id"
FROM "users" AS app_user
WHERE app_user."id" = profile."user_id"
  AND profile."tenant_id" IS DISTINCT FROM app_user."tenant_id";--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.cleanhub_current_tenant_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.cleanhub_rls_bypass_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('app.rls_bypass', true), ''), 'off') = 'on'
$$;--> statement-breakpoint

DO $$
DECLARE
  tenant_table record;
BEGIN
  FOR tenant_table IN
    SELECT DISTINCT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'tenant_id'
    ORDER BY table_name
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
      tenant_table.table_name
    );
    EXECUTE format(
      'ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',
      tenant_table.table_name
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS cleanhub_tenant_isolation ON public.%I',
      tenant_table.table_name
    );
    EXECUTE format(
      'CREATE POLICY cleanhub_tenant_isolation ON public.%I AS PERMISSIVE FOR ALL TO PUBLIC USING (public.cleanhub_rls_bypass_enabled() OR tenant_id::text = public.cleanhub_current_tenant_id()) WITH CHECK (public.cleanhub_rls_bypass_enabled() OR tenant_id::text = public.cleanhub_current_tenant_id())',
      tenant_table.table_name
    );
  END LOOP;
END
$$;--> statement-breakpoint

DROP POLICY IF EXISTS cleanhub_global_notification_template_read
ON public.notification_templates;--> statement-breakpoint

CREATE POLICY cleanhub_global_notification_template_read
ON public.notification_templates
AS PERMISSIVE
FOR SELECT
TO PUBLIC
USING (
  tenant_id IS NULL
  AND public.cleanhub_current_tenant_id() IS NOT NULL
);--> statement-breakpoint

COMMENT ON FUNCTION public.cleanhub_current_tenant_id IS
  'Returns the trusted request tenant set by the CleanHub API database context.';--> statement-breakpoint

COMMENT ON FUNCTION public.cleanhub_rls_bypass_enabled IS
  'Returns true only for explicitly scoped CleanHub system/SaaS database work.';
