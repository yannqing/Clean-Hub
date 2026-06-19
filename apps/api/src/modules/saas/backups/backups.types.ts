export type BackupJobScope = "platform" | "tenant";

export type BackupJobStatus = "pending" | "running" | "succeeded" | "failed";

export type BackupJobListInput = {
  scope?: BackupJobScope;
  status?: BackupJobStatus;
  tenantId?: string;
  limit: number;
  offset: number;
};

export type CreateBackupJobInput = {
  scope: BackupJobScope;
  tenantId?: string;
  reason?: string;
};

export type BackupJobListItem = {
  id: string;
  tenantId: string | null;
  scope: BackupJobScope;
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

export type RestoreRequestListInput = {
  status?: RestoreRequestStatus;
  tenantId?: string;
  backupJobId?: string;
  limit: number;
  offset: number;
};

export type RestoreRequestListItem = {
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
