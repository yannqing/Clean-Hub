ALTER TABLE "role_permissions" ADD COLUMN "tenant_id" varchar(26);--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "role_permissions_tenant_id_idx" ON "role_permissions" USING btree ("tenant_id");
--> statement-breakpoint

UPDATE "role_permissions" AS role_permission
SET "tenant_id" = role."tenant_id"
FROM "roles" AS role
WHERE role."id" = role_permission."role_id"
  AND role_permission."tenant_id" IS DISTINCT FROM role."tenant_id";
--> statement-breakpoint

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE public.role_permissions FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

DROP POLICY IF EXISTS cleanhub_tenant_isolation
ON public.role_permissions;
--> statement-breakpoint

CREATE POLICY cleanhub_tenant_isolation
ON public.role_permissions
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
