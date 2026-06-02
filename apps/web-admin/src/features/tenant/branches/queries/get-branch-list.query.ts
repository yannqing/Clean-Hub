import { webAdminApi } from "@/lib/api-client";

import type { BranchListFilters, BranchSummary } from "../types";

export const BRANCH_LIST_LIMIT = 100;

export async function getBranchListQuery(
  filters: BranchListFilters = {},
): Promise<BranchSummary[]> {
  return webAdminApi.tenant.branches.list({
    ...filters,
    limit: BRANCH_LIST_LIMIT,
    offset: 0,
  });
}
