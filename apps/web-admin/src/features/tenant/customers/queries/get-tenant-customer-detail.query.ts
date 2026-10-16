import type { ApiRequestOptions, TenantCustomerDetail } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

type CustomerDetailRequestOptions = Omit<
  ApiRequestOptions,
  "method" | "body" | "query"
>;

export async function getTenantCustomerDetailQuery(
  customerId: string,
  options: CustomerDetailRequestOptions = {},
): Promise<TenantCustomerDetail> {
  return webAdminApi.tenant.customers.get(customerId, options);
}
