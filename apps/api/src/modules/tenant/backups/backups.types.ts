export type BackupJobStatus = "pending" | "running" | "succeeded" | "failed";

export type BackupJobListInput = {
  status?: BackupJobStatus;
  limit: number;
  offset: number;
};

export type CreateBackupJobInput = {
  reason?: string;
};

export type BackupJobListItem = {
  id: string;
  tenantId: string;
  scope: "tenant";
  status: BackupJobStatus;
  requestedBy: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RestoreRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "completed"
  | "cancelled";

export type CreateRestoreRequestInput = {
  reason: string;
};

export type RestoreRequestListItem = {
  id: string;
  backupJobId: string | null;
  tenantId: string;
  requestedBy: string | null;
  reason: string;
  status: RestoreRequestStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
};
