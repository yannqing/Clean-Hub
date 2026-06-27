import type { ApiClient, ApiRequestOptions } from "../types";
import type { MobileOwnerTodaySummary } from "./owner.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createMobileOwnerApi(client: ApiClient) {
  return {
    getTodaySummary: (options?: RequestOptions) =>
      client.get<MobileOwnerTodaySummary>(
        "/mobile/owner/summary/today",
        options,
      ),
  };
}
