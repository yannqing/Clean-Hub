import { webAdminApi } from "@/lib/api-client";

import type { TenantDetail } from "../types";

export async function getTenantDetailQuery(
  tenantId: string,
): Promise<TenantDetail> {
  return webAdminApi.saas.tenants.get(tenantId);
}
