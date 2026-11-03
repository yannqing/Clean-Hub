import { webAdminApi } from "@/lib/api-client";

import type { ApiRequestOptions } from "@cleanhub/api-client";
import type { BranchSummary } from "../types";

type BranchDetailRequestOptions = Omit<ApiRequestOptions, "method" | "body">;

export async function getBranchDetailQuery(
  branchId: string,
  options: BranchDetailRequestOptions = {},
): Promise<BranchSummary> {
  return webAdminApi.tenant.branches.get(branchId, options);
}
