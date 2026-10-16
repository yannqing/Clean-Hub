"use server";

import { webAdminApi } from "@/lib/api-client";

import type {
  BackupJobActionResult,
  CreateBackupJobInput,
} from "../types";
import { validateCreateBackupJob } from "../validators";
import { getTenantServerApiRequestOptions } from "../../server/api-request-options";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Failed to create backup task.";
}

export async function createTenantBackupJobAction(
  input: CreateBackupJobInput,
): Promise<BackupJobActionResult> {
  const validation = validateCreateBackupJob(input);

  if (!validation.ok) {
    return validation;
  }

  try {
    const backupJob = await webAdminApi.tenant.backups.create(
      validation.data,
      await getTenantServerApiRequestOptions(),
    );

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
