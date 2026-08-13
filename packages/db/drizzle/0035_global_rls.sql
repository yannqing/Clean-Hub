ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE public.tenants FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

DROP POLICY IF EXISTS cleanhub_tenant_isolation ON public.tenants;
--> statement-breakpoint

CREATE POLICY cleanhub_tenant_isolation
ON public.tenants
AS PERMISSIVE
FOR ALL
TO PUBLIC
USING (
  public.cleanhub_rls_bypass_enabled()
  OR id::text = public.cleanhub_current_tenant_id()
)
WITH CHECK (
  public.cleanhub_rls_bypass_enabled()
  OR id::text = public.cleanhub_current_tenant_id()
);
--> statement-breakpoint

DO $$
DECLARE
  system_table text;
BEGIN
  FOREACH system_table IN ARRAY ARRAY[
    'auth_login_lockouts',
    'platform_settings'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', system_table);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', system_table);
    EXECUTE format(
      'DROP POLICY IF EXISTS cleanhub_tenant_isolation ON public.%I',
      system_table
    );
    EXECUTE format(
      'CREATE POLICY cleanhub_tenant_isolation ON public.%I AS PERMISSIVE FOR ALL TO PUBLIC USING (public.cleanhub_rls_bypass_enabled()) WITH CHECK (public.cleanhub_rls_bypass_enabled())',
      system_table
    );
  END LOOP;
END
$$;
--> statement-breakpoint

DO $$
DECLARE
  reference_table text;
BEGIN
  FOREACH reference_table IN ARRAY ARRAY[
    'permissions',
    'security_settings'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', reference_table);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', reference_table);
    EXECUTE format(
      'DROP POLICY IF EXISTS cleanhub_tenant_isolation ON public.%I',
      reference_table
    );
    EXECUTE format(
      'CREATE POLICY cleanhub_tenant_isolation ON public.%I AS PERMISSIVE FOR ALL TO PUBLIC USING (public.cleanhub_rls_bypass_enabled()) WITH CHECK (public.cleanhub_rls_bypass_enabled())',
      reference_table
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS cleanhub_tenant_context_read ON public.%I',
      reference_table
    );
    EXECUTE format(
      'CREATE POLICY cleanhub_tenant_context_read ON public.%I AS PERMISSIVE FOR SELECT TO PUBLIC USING (public.cleanhub_rls_bypass_enabled() OR public.cleanhub_current_tenant_id() IS NOT NULL)',
      reference_table
    );
  END LOOP;
END
$$;
