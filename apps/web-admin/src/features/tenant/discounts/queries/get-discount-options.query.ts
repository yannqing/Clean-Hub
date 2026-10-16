import type { TenantDiscountOptions } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";

export async function getDiscountOptionsQuery(): Promise<TenantDiscountOptions> {
  return webAdminApi.tenant.discounts.options(
    await getTenantServerApiRequestOptions(),
  );
}
