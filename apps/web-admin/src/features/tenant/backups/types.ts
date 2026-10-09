import type {
  CreateTenantBackupJobRequest,
  CreateTenantRestoreRequestRequest,
  TenantBackupJobListItem,
  TenantBackupJobListQuery,
  TenantBackupJobStatus,
  TenantRestoreRequest,
  TenantRestoreRequestListQuery,
  TenantRestoreRequestListResult,
  TenantRestoreRequestStatus,
} from "@cleanhub/api-client";

export type BackupJobStatus = TenantBackupJobStatus;
export type BackupJobListQuery = TenantBackupJobListQuery;
export type BackupJobListItem = TenantBackupJobListItem;
export type CreateBackupJobInput = CreateTenantBackupJobRequest;
export type RestoreRequest = TenantRestoreRequest;
export type CreateRestoreRequestInput = CreateTenantRestoreRequestRequest;
export type RestoreRequestStatus = TenantRestoreRequestStatus;
export type RestoreRequestListQuery = TenantRestoreRequestListQuery;
export type RestoreRequestListResult = TenantRestoreRequestListResult;

export type BackupJobActionResult =
  | {
      ok: true;
      data: BackupJobListItem;
    }
  | {
      ok: false;
      error: string;
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
