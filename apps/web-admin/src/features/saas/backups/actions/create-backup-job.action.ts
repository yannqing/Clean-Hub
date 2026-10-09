import { webAdminApi } from "@/lib/api-client";

import type {
  BackupJobActionResult,
  CreateBackupJobInput,
} from "../types";
import { validateCreateBackupJob } from "../validators";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Failed to create backup task.";
}

export async function createBackupJobAction(
  input: CreateBackupJobInput,
): Promise<BackupJobActionResult> {
  const validation = validateCreateBackupJob(input);

  if (!validation.ok) {
    return validation;
  }

  try {
    const backupJob = await webAdminApi.saas.backups.create(validation.data);

    return {
      ok: true,
      data: backupJob,
    };
  } catch (error) {
    return {
      ok: false,
      error: getErrorMessage(error),
    };
  }
}
