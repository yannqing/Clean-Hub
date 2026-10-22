import type {
  TenantDiscountListQuery,
  TenantDiscountListResponse,
  TenantDiscountSummary,
} from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";

const EXPORT_PAGE_SIZE = 100;

export async function getDiscountListQuery(
  query: TenantDiscountListQuery,
): Promise<TenantDiscountListResponse> {
  return webAdminApi.tenant.discounts.list(
    query,
    await getTenantServerApiRequestOptions(),
  );
}

export async function getDiscountExportDatasetQuery(
  query: Omit<TenantDiscountListQuery, "limit" | "offset">,
  signal?: AbortSignal,
): Promise<TenantDiscountSummary[]> {
  const requestOptions = await getTenantServerApiRequestOptions();
  const data: TenantDiscountSummary[] = [];
  let offset = 0;
  let total = 0;

  do {
    const response = await webAdminApi.tenant.discounts.list(
      {
        ...query,
        limit: EXPORT_PAGE_SIZE,
        offset,
      },
      { ...requestOptions, signal },
    );

    data.push(...response.data);
    total = response.total;
    offset += response.data.length;

    if (response.data.length === 0) break;
  } while (offset < total);

  return data;
}
