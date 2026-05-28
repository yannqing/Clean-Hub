import { webAdminApi } from "@/lib/api-client";

import type { TenantOverview } from "../types";

export async function getTenantOverviewQuery(): Promise<TenantOverview> {
  return webAdminApi.http.request<TenantOverview>("/tenant/overview");
}
