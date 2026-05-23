import type { ApiClient } from "../types";
import type {
  SecurityEventListItem,
  SecurityEventListQuery,
} from "./security-events.types";

export function createSaasSecurityEventsApi(client: ApiClient) {
  return {
    list: (query?: SecurityEventListQuery) =>
      client.get<SecurityEventListItem[]>("/saas/security/events", { query }),
  };
}
