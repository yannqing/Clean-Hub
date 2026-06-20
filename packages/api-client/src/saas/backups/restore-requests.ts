import type { ApiClient } from "../../types";
import type {
  RestoreRequest,
  RestoreRequestListQuery,
} from "./restore-requests.types";

export function createSaasRestoreRequestsApi(client: ApiClient) {
  return {
    list: (query?: RestoreRequestListQuery) =>
      client.get<RestoreRequest[]>("/saas/restore-requests", { query }),
  };
}
