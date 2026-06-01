import { webAdminApi } from "@/lib/api-client";

import type { BranchSummary } from "../types";

export async function getBranchDetailQuery(
  branchId: string,
): Promise<BranchSummary> {
  return webAdminApi.tenant.branches.getDetail(branchId);
}
