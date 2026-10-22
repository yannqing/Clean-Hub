ALTER TABLE public.pos_offline_sale_exceptions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.pos_offline_sale_exceptions FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY cleanhub_tenant_isolation
ON public.pos_offline_sale_exceptions
AS PERMISSIVE
FOR ALL
TO public
USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR tenant_id = nullif(current_setting('app.current_tenant_id', true), '')
)
WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR tenant_id = nullif(current_setting('app.current_tenant_id', true), '')
);--> statement-breakpoint

ALTER TABLE public.receipt_deliveries ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.receipt_deliveries FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY cleanhub_tenant_isolation
ON public.receipt_deliveries
AS PERMISSIVE
FOR ALL
TO public
USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR tenant_id = nullif(current_setting('app.current_tenant_id', true), '')
)
WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR tenant_id = nullif(current_setting('app.current_tenant_id', true), '')
);
