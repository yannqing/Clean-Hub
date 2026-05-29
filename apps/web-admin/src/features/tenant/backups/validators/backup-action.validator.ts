import type {
  CreateBackupJobInput,
  CreateRestoreRequestInput,
} from "../types";

export type BackupActionValidationResult<TData> =
  | {
      ok: true;
      data: TData;
    }
  | {
      ok: false;
      error: string;
    };

export function validateCreateBackupJob(
  input: CreateBackupJobInput,
): BackupActionValidationResult<CreateBackupJobInput> {
  const reason = input.reason?.trim();

  if (reason && reason.length > 500) {
    return {
      ok: false,
      error: "Reason must be 500 characters or fewer.",
    };
  }

  return {
    ok: true,
    data: reason ? { reason } : {},
  };
}

export function validateCreateRestoreRequest(
  input: CreateRestoreRequestInput,
): BackupActionValidationResult<CreateRestoreRequestInput> {
  const reason = input.reason.trim();

  if (!reason) {
    return {
      ok: false,
      error: "Restore reason is required.",
    };
  }

  if (reason.length > 500) {
    return {
      ok: false,
      error: "Restore reason must be 500 characters or fewer.",
    };
  }

  return {
    ok: true,
    data: { reason },
  };
}
