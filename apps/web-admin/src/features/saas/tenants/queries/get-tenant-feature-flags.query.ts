import { webAdminApi } from "@/lib/api-client";

export async function getTenantFeatureFlagsQuery(tenantId: string) {
  return webAdminApi.saas.tenants.getFeatureFlags(tenantId);
}
