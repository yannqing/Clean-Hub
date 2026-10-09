import type {
  ApiRequestOptions,
  TenantCustomerAccountCustomersQuery,
  TenantCustomerAccountCustomersResponse,
  TenantCustomerAccountDetail,
  TenantCustomerAccountListQuery,
  TenantCustomerAccountListResponse,
  TenantCustomerAccountOverview,
} from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

type RequestOptions = Pick<ApiRequestOptions, "headers" | "signal">;

export function getTenantCustomerAccountListQuery(
  query: TenantCustomerAccountListQuery,
  options?: RequestOptions,
): Promise<TenantCustomerAccountListResponse> {
  return webAdminApi.tenant.customers.listAccounts(query, options);
}

export function getTenantCustomerAccountOverviewQuery(
  options?: RequestOptions,
): Promise<TenantCustomerAccountOverview> {
  return webAdminApi.tenant.customers.accountsOverview(options);
}

export function getTenantCustomerAccountDetailQuery(
  accountId: string,
  options?: RequestOptions,
): Promise<TenantCustomerAccountDetail> {
  return webAdminApi.tenant.customers.getAccount(accountId, options);
}

export function getTenantCustomerAccountCustomersQuery(
  accountId: string,
  query: TenantCustomerAccountCustomersQuery,
  options?: RequestOptions,
): Promise<TenantCustomerAccountCustomersResponse> {
  return webAdminApi.tenant.customers.listAccountCustomers(
    accountId,
    query,
    options,
  );
}
