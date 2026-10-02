import type { ApiClient } from "../../types";
import type {
  RestoreRequest,
  RestoreRequestListQuery,
  ReviewRestoreRequestInput,
} from "./restore-requests.types";

export function createSaasRestoreRequestsApi(client: ApiClient) {
  return {
    list: (query?: RestoreRequestListQuery) =>
      client.get<RestoreRequest[]>("/saas/restore-requests", { query }),

    approve: (id: string, input?: ReviewRestoreRequestInput) =>
      client.post<RestoreRequest>(`/saas/restore-requests/${id}/approve`, input ?? {}),
    reject: (id: string, input?: ReviewRestoreRequestInput) =>
      client.post<RestoreRequest>(`/saas/restore-requests/${id}/reject`, input ?? {}),
    complete: (id: string, input?: ReviewRestoreRequestInput) =>
      client.post<RestoreRequest>(`/saas/restore-requests/${id}/complete`, input ?? {}),
    cancel: (id: string, input?: ReviewRestoreRequestInput) =>
      client.post<RestoreRequest>(`/saas/restore-requests/${id}/cancel`, input ?? {}),
  };
}
