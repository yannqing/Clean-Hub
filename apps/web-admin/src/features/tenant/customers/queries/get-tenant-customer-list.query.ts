import type {
  ApiRequestOptions,
  TenantCustomerListQuery,
  TenantCustomerListResponse,
  TenantCustomerOverview,
  TenantCustomerOverviewQuery,
} from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

type RequestOptions = Pick<ApiRequestOptions, "signal">;

export async function getTenantCustomerListQuery(
  query: TenantCustomerListQuery,
  options?: RequestOptions,
): Promise<TenantCustomerListResponse> {
  return webAdminApi.tenant.customers.list(query, options);
}

export async function getTenantCustomerOverviewQuery(
  query: TenantCustomerOverviewQuery,
  options?: RequestOptions,
): Promise<TenantCustomerOverview> {
  return webAdminApi.tenant.customers.overview(query, options);
}
