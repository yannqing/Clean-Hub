import type { ApiRequestOptions } from "@cleanhub/api-client";

import { apiClient } from "../../../lib/api-client";

type OwnerTodaySummaryQueryOptions = Pick<ApiRequestOptions, "signal" | "timeoutMs">;

export async function getOwnerTodaySummary(options?: OwnerTodaySummaryQueryOptions) {
  return apiClient.mobile.owner.getTodaySummary(options);
}
