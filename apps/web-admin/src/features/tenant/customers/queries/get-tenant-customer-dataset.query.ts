import type { TenantCustomerSummary } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

const TENANT_CUSTOMER_DATASET_CHUNK_SIZE = 100;

export async function getTenantCustomerDatasetQuery(
  signal?: AbortSignal,
): Promise<TenantCustomerSummary[]> {
  const customers = new Map<string, TenantCustomerSummary>();
  let offset = 0;
  let total: number | null = null;

  do {
    const result = await webAdminApi.tenant.customers.list(
      {
        limit: TENANT_CUSTOMER_DATASET_CHUNK_SIZE,
        offset,
      },
      { signal },
    );

    for (const customer of result.data) {
      customers.set(customer.id, customer);
    }

    total ??= result.total;
    offset += result.data.length;

    if (result.data.length === 0) {
      break;
    }
  } while (total !== null && offset < total);

  return [...customers.values()];
}
