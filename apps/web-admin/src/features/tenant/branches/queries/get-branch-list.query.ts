import { webAdminApi } from "@/lib/api-client";

import type { ApiRequestOptions } from "@cleanhub/api-client";
import type { BranchListFilters, BranchSummary } from "../types";

type BranchListRequestOptions = Omit<
  ApiRequestOptions,
  "method" | "body" | "query"
>;

export const BRANCH_LIST_LIMIT = 100;

export async function getBranchListQuery(
  filters: BranchListFilters = {},
  options: BranchListRequestOptions = {},
): Promise<BranchSummary[]> {
  return webAdminApi.tenant.branches.list(
    {
      ...filters,
      limit: BRANCH_LIST_LIMIT,
      offset: 0,
    },
    options,
  );
}
