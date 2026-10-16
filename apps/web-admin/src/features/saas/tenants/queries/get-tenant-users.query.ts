import { webAdminApi } from "@/lib/api-client";

import type { SaasTenantUserSummary } from "../types";

export async function getTenantUsersQuery(tenantId: string): Promise<SaasTenantUserSummary[]> {
  const result = await webAdminApi.saas.tenants.listUsers(tenantId);
  return result.data;
}
