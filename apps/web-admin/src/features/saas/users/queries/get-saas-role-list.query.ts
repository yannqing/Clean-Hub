import { webAdminApi } from "@/lib/api-client";

import type { SaasRoleSummary } from "../types";

export async function getSaasRoleListQuery(): Promise<SaasRoleSummary[]> {
  return webAdminApi.saas.roles.list();
}
