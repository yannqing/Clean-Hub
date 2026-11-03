import { webAdminApi } from "@/lib/api-client";

export async function getTenantSettingsQuery(tenantId: string) {
  return webAdminApi.saas.tenants.getSettings(tenantId);
}
