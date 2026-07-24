import { webAdminApi } from "@/lib/api-client";

import type { ServiceListFilters } from "../types";
import type { ServiceSummary } from "../types";

const SERVICE_DATASET_CHUNK_SIZE = 100;

export async function getServiceListQuery(
  filters: ServiceListFilters = {},
): Promise<ServiceSummary[]> {
  return webAdminApi.tenant.services.list({
    ...filters,
    limit: 100,
    offset: 0,
  });
}

export async function getServiceDatasetQuery(
  signal?: AbortSignal,
): Promise<ServiceSummary[]> {
  const services = new Map<string, ServiceSummary>();
  let offset = 0;

  while (true) {
    const page = await webAdminApi.tenant.services.list(
      {
        limit: SERVICE_DATASET_CHUNK_SIZE,
        offset,
      },
      { signal },
    );

    for (const service of page) {
      services.set(service.id, service);
    }

    offset += page.length;

    if (page.length < SERVICE_DATASET_CHUNK_SIZE) {
      break;
    }
  }

  return [...services.values()];
}
