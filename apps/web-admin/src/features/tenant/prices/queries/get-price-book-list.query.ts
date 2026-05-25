import { webAdminApi } from "@/lib/api-client";

import type { PriceBookListFilters } from "../types";
import type { PriceBookSummary } from "../types";

export async function getPriceBookListQuery(
  filters: PriceBookListFilters = {},
): Promise<PriceBookSummary[]> {
  return webAdminApi.tenant.prices.list({
    ...filters,
    limit: 100,
    offset: 0,
  });
}
