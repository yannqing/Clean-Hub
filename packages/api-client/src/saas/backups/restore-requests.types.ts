export type RestoreRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "completed"
  | "cancelled";

export type RestoreRequestListQuery = {
  status?: RestoreRequestStatus;
  tenantId?: string;
  backupJobId?: string;
  limit?: number;
  offset?: number;
};

export type RestoreRequest = {
  id: string;
  backupJobId: string | null;
  tenantId: string | null;
  requestedBy: string | null;
  reason: string;
  status: RestoreRequestStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Input for the restore-request review endpoints (approve / reject).
 *
 * `reviewNote` is optional on complete/cancel and encouraged (but not required)
 * on approve/reject so the reviewer can record a reason.
 */
export type ReviewRestoreRequestInput = {
  reviewNote?: string;
};
