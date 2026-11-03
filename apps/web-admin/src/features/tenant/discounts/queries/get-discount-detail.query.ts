import type { TenantDiscountDetail } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";

export async function getDiscountDetailQuery(
  discountId: string,
): Promise<TenantDiscountDetail> {
  return webAdminApi.tenant.discounts.get(
    discountId,
    await getTenantServerApiRequestOptions(),
  );
}
