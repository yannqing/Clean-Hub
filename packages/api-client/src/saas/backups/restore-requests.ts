import type { ApiClient } from "../../types";
import type {
  RestoreRequest,
  RestoreRequestListQuery,
  ReviewRestoreRequestInput,
} from "./restore-requests.types";

/* -------------------------------------------------------------------------- */
/* Mock helpers — remove once the backend review endpoints land.              */
/* -------------------------------------------------------------------------- */

/**
 * Build the post-review shape of a restore request. The real backend will set
 * `reviewedBy` from the auth context and `reviewedAt` to now; the mock fakes
 * both so the UI round-trips without a server round-trip.
 */
function applyReviewStatus(
  request: RestoreRequest,
  status: RestoreRequestStatus,
  input?: ReviewRestoreRequestInput,
): RestoreRequest {
  const now = new Date().toISOString();
  return {
    ...request,
    status,
    reviewedAt: now,
    reviewedBy: request.reviewedBy ?? "mock-reviewer",
    reviewNote: input?.reviewNote?.trim() ? input.reviewNote.trim() : null,
    updatedAt: now,
  };
}

type RestoreRequestStatus = RestoreRequest["status"];

export function createSaasRestoreRequestsApi(client: ApiClient) {
  return {
    list: (query?: RestoreRequestListQuery) =>
      client.get<RestoreRequest[]>("/saas/restore-requests", { query }),

    /**
     * Approve a restore request for execution.
     *
     * Target endpoint: `POST /saas/restore-requests/:id/approve`
     *
     * MOCK: returns the request with `status: "approved"`. Wire to the real
     * endpoint once the backend review workflow is implemented.
     */
    async approve(
      id: string,
      input?: ReviewRestoreRequestInput,
    ): Promise<RestoreRequest> {
      // MOCK — wire to backend later:
      //   client.post<RestoreRequest>(`/saas/restore-requests/${id}/approve`, input ?? {})
      void client;
      return applyReviewStatus(mockPendingRequest(id), "approved", input);
    },

    /**
     * Reject a restore request.
     *
     * Target endpoint: `POST /saas/restore-requests/:id/reject`
     *
     * MOCK: returns the request with `status: "rejected"`.
     */
    async reject(
      id: string,
      input?: ReviewRestoreRequestInput,
    ): Promise<RestoreRequest> {
      // MOCK — wire to backend later:
      //   client.post<RestoreRequest>(`/saas/restore-requests/${id}/reject`, input ?? {})
      void client;
      return applyReviewStatus(mockPendingRequest(id), "rejected", input);
    },

    /**
     * Mark an approved restore request as completed.
     *
     * Target endpoint: `POST /saas/restore-requests/:id/complete`
     *
     * MOCK: returns the request with `status: "completed"`.
     */
    async complete(id: string): Promise<RestoreRequest> {
      // MOCK — wire to backend later:
      //   client.post<RestoreRequest>(`/saas/restore-requests/${id}/complete`, {})
      void client;
      return applyReviewStatus(mockPendingRequest(id), "completed");
    },

    /**
     * Cancel a restore request.
     *
     * Target endpoint: `POST /saas/restore-requests/:id/cancel`
     *
     * MOCK: returns the request with `status: "cancelled"`.
     */
    async cancel(id: string): Promise<RestoreRequest> {
      // MOCK — wire to backend later:
      //   client.post<RestoreRequest>(`/saas/restore-requests/${id}/cancel`, {})
      void client;
      return applyReviewStatus(mockPendingRequest(id), "cancelled");
    },
  };
}

/**
 * Synthesize a minimal pending restore request for the mock review endpoints.
 *
 * The real endpoints will return the actual stored row; the mock only needs to
 * satisfy the `RestoreRequest` shape so the UI can render the post-review state.
 * The id is preserved so the parent list can reconcile the updated row.
 */
function mockPendingRequest(id: string): RestoreRequest {
  const now = new Date().toISOString();
  return {
    id,
    backupJobId: null,
    tenantId: null,
    requestedBy: null,
    reason: "",
    status: "pending",
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
    createdAt: now,
    updatedAt: now,
  };
}
