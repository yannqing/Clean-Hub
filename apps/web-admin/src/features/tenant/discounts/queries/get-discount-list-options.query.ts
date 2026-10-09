import type { TenantDiscountListOptions } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";

export async function getDiscountListOptionsQuery(): Promise<TenantDiscountListOptions> {
  return webAdminApi.tenant.discounts.listOptions(
    await getTenantServerApiRequestOptions(),
  );
}
