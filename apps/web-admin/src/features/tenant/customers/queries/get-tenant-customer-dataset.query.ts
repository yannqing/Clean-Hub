import type { PosCustomerProfileWithAccount } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

const TENANT_CUSTOMER_DATASET_CHUNK_SIZE = 100;

export async function getTenantCustomerDatasetQuery(
  signal?: AbortSignal,
): Promise<PosCustomerProfileWithAccount[]> {
  const customers = new Map<string, PosCustomerProfileWithAccount>();
  let offset = 0;
  let total: number | null = null;

  do {
    const result = await webAdminApi.pos.customers.list(
      {
        limit: TENANT_CUSTOMER_DATASET_CHUNK_SIZE,
        offset,
        resultType: "profile",
      },
      { signal },
    );

    for (const entry of result.data) {
      if (entry.kind === "profile") {
        customers.set(entry.profile.id, entry.profile);
      }
    }

    total ??= result.total;
    offset += result.data.length;

    if (result.data.length === 0) {
      break;
    }
  } while (total !== null && offset < total);

  return [...customers.values()];
}
