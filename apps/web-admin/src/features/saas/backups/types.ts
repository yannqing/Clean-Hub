export type BackupJobScope = "platform" | "tenant";

export type BackupJobStatus = "pending" | "running" | "succeeded" | "failed";

export type RestoreRequestStatus = "pending" | "approved" | "rejected";

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

export type CreateBackupJobInput = {
  scope: BackupJobScope;
  tenantId?: string;
  reason?: string;
};

export type CreateRestoreRequestInput = {
  reason: string;
};

export type BackupJobActionResult =
  | {
      ok: true;
      data: BackupJobListItem;
    }
  | {
      ok: false;
      error: string;
    };

export type RestoreRequest = {
  id: string;
  backupJobId: string;
  tenantId: string | null;
  requestedBy: string | null;
  reason: string;
  status: RestoreRequestStatus;
  createdAt: string;
  updatedAt: string;
};

export type RestoreRequestActionResult =
  | {
      ok: true;
      data: RestoreRequest;
    }
  | {
      ok: false;
      error: string;
    };
