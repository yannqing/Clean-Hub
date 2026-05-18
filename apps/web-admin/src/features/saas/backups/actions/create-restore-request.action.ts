import { webAdminApi } from "@/lib/api-client";

import type {
  CreateRestoreRequestInput,
  RestoreRequest,
  RestoreRequestActionResult,
} from "../types";
import { validateCreateRestoreRequest } from "../validators";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Failed to submit restore request.";
}

export async function createRestoreRequestAction(
  backupJobId: string,
  input: CreateRestoreRequestInput,
): Promise<RestoreRequestActionResult> {
  const validation = validateCreateRestoreRequest(input);

  if (!validation.ok) {
    return validation;
  }

  try {
    const restoreRequest = await webAdminApi.http.request<RestoreRequest>(
      `/saas/backups/${backupJobId}/restore-requests`,
      {
        method: "POST",
        body: validation.data,
      },
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
