import type {
  BackupJobListItem,
  RestoreRequest,
} from "@cleanhub/api-client";

export type {
  BackupJobListItem,
  BackupJobListQuery,
  BackupJobScope,
  BackupJobStatus,
  CreateBackupJobRequest as CreateBackupJobInput,
  CreateRestoreRequestRequest as CreateRestoreRequestInput,
  RestoreRequest,
  RestoreRequestListQuery,
  RestoreRequestStatus,
} from "@cleanhub/api-client";

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
