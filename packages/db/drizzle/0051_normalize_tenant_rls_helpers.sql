DROP POLICY IF EXISTS cleanhub_tenant_isolation ON public.pos_offline_sale_exceptions;--> statement-breakpoint
CREATE POLICY cleanhub_tenant_isolation
ON public.pos_offline_sale_exceptions
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

DROP POLICY IF EXISTS cleanhub_tenant_isolation ON public.receipt_deliveries;--> statement-breakpoint
CREATE POLICY cleanhub_tenant_isolation
ON public.receipt_deliveries
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
