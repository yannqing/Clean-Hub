"use server";

import { webAdminApi } from "@/lib/api-client";

import type {
  CreateRestoreRequestInput,
  RestoreRequestActionResult,
} from "../types";
import { validateCreateRestoreRequest } from "../validators";
import { getTenantServerApiRequestOptions } from "../../server/api-request-options";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Failed to submit restore request.";
}

export async function createTenantRestoreRequestAction(
  backupJobId: string,
  input: CreateRestoreRequestInput,
): Promise<RestoreRequestActionResult> {
  const validation = validateCreateRestoreRequest(input);

  if (!validation.ok) {
    return validation;
  }

  try {
    const restoreRequest = await webAdminApi.tenant.backups.createRestoreRequest(
      backupJobId,
      validation.data,
      await getTenantServerApiRequestOptions(),
    );

    return {
      ok: true,
      data: restoreRequest,
    };
  } catch (error) {
    return {
      ok: false,
      error: getErrorMessage(error),
    };
  }
}
