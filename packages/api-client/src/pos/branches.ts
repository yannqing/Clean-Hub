import type { ApiClient, ApiRequestOptions } from "../types";
import type { PosBranchSummary } from "./branches.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createPosBranchesApi(client: ApiClient) {
  return {
    /**
     * The active branch for the signed-in POS user.
     * GET /pos/branches/me — returns the branch or null when unassigned.
     */
    getMine: (options?: RequestOptions) =>
      client.get<PosBranchSummary | null>("/pos/branches/me", options),
  };
}
