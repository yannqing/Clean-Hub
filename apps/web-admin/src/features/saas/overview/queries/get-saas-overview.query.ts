import { webAdminApi } from "@/lib/api-client";

import type { SaasOverview } from "../types";

export async function getSaasOverviewQuery(): Promise<SaasOverview> {
  return webAdminApi.saas.getOverview();
}
