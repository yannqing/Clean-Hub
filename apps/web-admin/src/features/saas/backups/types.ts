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
  ReviewRestoreRequestInput,
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

/**
 * The review transitions an admin can drive a restore request through.
 *
 * Only transitions valid for the request's current status are surfaced in the
 * UI (see `restore-request-review-actions.tsx`).
 */
export type ReviewAction = "approve" | "reject" | "complete" | "cancel";

/** Result of {@link reviewRestoreRequestAction}. */
export type ReviewRestoreRequestActionResult =
  | {
      ok: true;
      data: RestoreRequest;
    }
  | {
      ok: false;
      error: string;
    };
