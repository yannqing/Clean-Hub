import type { ApiClient, ApiRequestOptions } from "../../types";
import type {
  SecurityEventDetail,
  SecurityEventListItem,
  SecurityEventListQuery,
} from "./security-events.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createSaasSecurityEventsApi(client: ApiClient) {
  return {
    list: (query?: SecurityEventListQuery) =>
      client.get<SecurityEventListItem[]>("/saas/security/events", { query }),
    get: (eventId: string, options: RequestOptions = {}) =>
      client.get<SecurityEventDetail>(
        `/saas/security/events/${encodeURIComponent(eventId)}`,
        options,
      ),
  };
}
