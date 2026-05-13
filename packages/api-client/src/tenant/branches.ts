import type { ApiClient, QueryParams } from "../types";
import type { BranchSummary } from "./branches.types";

export function createTenantBranchesApi(client: ApiClient) {
  return {
    list: (query?: QueryParams) =>
      client.get<BranchSummary[]>("/tenant/branches", { query }),
  };
}
