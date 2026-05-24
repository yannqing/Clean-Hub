import { webAdminApi } from "@/lib/api-client";

import type { ServiceListFilters } from "../types";
import type { ServiceSummary } from "../types";

export async function getServiceListQuery(
  filters: ServiceListFilters = {},
): Promise<ServiceSummary[]> {
  return webAdminApi.tenant.services.list({
    ...filters,
    limit: 100,
    offset: 0,
  });
}
