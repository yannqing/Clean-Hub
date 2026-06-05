import { webAdminApi } from "@/lib/api-client";
import type { BranchSummary } from "../types";

export async function getTenantBranchListQuery(): Promise<BranchSummary[]> {
  return webAdminApi.tenant.branches.list({ limit: 100, offset: 0 });
}
