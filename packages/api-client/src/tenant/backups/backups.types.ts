export type TenantBackupJobStatus = "pending" | "running" | "succeeded" | "failed";

export type TenantBackupJobListQuery = {
  status?: TenantBackupJobStatus;
  limit?: number;
  offset?: number;
};

export type TenantBackupJobListItem = {
  id: string;
  tenantId: string;
  scope: "tenant";
  status: TenantBackupJobStatus;
  requestedBy: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateTenantBackupJobRequest = {
  reason?: string;
};

export type TenantRestoreRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "completed"
  | "cancelled";

export type TenantRestoreRequest = {
  id: string;
  backupJobId: string | null;
  tenantId: string;
  requestedBy: string | null;
  reason: string;
  status: TenantRestoreRequestStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateTenantRestoreRequestRequest = {
  reason: string;
};
