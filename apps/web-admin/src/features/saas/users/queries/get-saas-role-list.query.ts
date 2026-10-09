import type { ApiRequestOptions } from "@cleanhub/api-client";

import { apiClient } from "@/lib/api-client";

import type { SaasRoleSummary } from "../types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export async function getSaasRoleListQuery(
  options: RequestOptions = {},
): Promise<SaasRoleSummary[]> {
  return apiClient<SaasRoleSummary[]>("/saas/roles", {
    ...options,
    method: "GET",
  });
}
