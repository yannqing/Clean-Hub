import type { TenantDiscountOverview } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";

export async function getDiscountOverviewQuery(): Promise<TenantDiscountOverview> {
  return webAdminApi.tenant.discounts.overview(
    await getTenantServerApiRequestOptions(),
  );
}
