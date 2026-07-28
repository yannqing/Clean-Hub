import type { ApiRequestOptions } from "@cleanhub/api-client";

import { apiClient } from "@/lib/api-client";

import type { SaasUserDetail } from "../types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export async function getSaasUserDetailQuery(
  userId: string,
  options: RequestOptions = {},
): Promise<SaasUserDetail> {
  return apiClient<SaasUserDetail>(
    `/saas/users/${encodeURIComponent(userId)}`,
    {
      ...options,
      method: "GET",
    },
  );
}
