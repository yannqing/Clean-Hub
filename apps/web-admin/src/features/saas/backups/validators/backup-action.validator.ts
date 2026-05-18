import type {
  BackupJobScope,
  CreateBackupJobInput,
  CreateRestoreRequestInput,
} from "../types";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const backupJobScopes = new Set<BackupJobScope>(["platform", "tenant"]);

type ValidationResult<TData> =
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
): ValidationResult<CreateBackupJobInput> {
  if (!backupJobScopes.has(input.scope)) {
    return {
      ok: false,
      error: "Select a valid backup scope.",
    };
  }

  const tenantId = input.tenantId?.trim().toUpperCase();
  const reason = input.reason?.trim();

  if (input.scope === "tenant" && !tenantId) {
    return {
      ok: false,
      error: "Tenant backups require a tenant ID.",
    };
  }

  if (tenantId && !ULID_PATTERN.test(tenantId)) {
    return {
      ok: false,
      error: "Tenant ID must be a valid ULID.",
    };
  }

  if (reason && reason.length > 500) {
    return {
      ok: false,
      error: "Backup reason must be 500 characters or fewer.",
    };
  }

  return {
    ok: true,
    data: {
      scope: input.scope,
      tenantId: tenantId || undefined,
      reason: reason || undefined,
    },
  };
}

export function validateCreateRestoreRequest(
  input: CreateRestoreRequestInput,
): ValidationResult<CreateRestoreRequestInput> {
  const reason = input.reason.trim();

  if (!reason) {
    return {
      ok: false,
      error: "Restore request reason is required.",
    };
  }

  if (reason.length > 500) {
    return {
      ok: false,
      error: "Restore request reason must be 500 characters or fewer.",
    };
  }

  return {
    ok: true,
    data: {
      reason,
    },
  };
}
