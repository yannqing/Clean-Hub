export type BackupJobScope = "platform" | "tenant";

export type BackupJobStatus = "pending" | "running" | "succeeded" | "failed";

export type BackupJobListQuery = {
  scope?: BackupJobScope;
  status?: BackupJobStatus;
  tenantId?: string;
  limit?: number;
  offset?: number;
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

export type CreateBackupJobRequest = {
  scope: BackupJobScope;
  tenantId?: string;
  reason?: string;
};

export type CreateRestoreRequestRequest = {
  reason: string;
};
