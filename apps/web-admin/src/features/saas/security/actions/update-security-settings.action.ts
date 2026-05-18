import { webAdminApi } from "@/lib/api-client";

import type {
  SecuritySettings,
  SecuritySettingsActionResult,
  SecuritySettingsFormValues,
} from "../types";
import { validateSecuritySettings } from "../validators";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Failed to update security settings.";
}

export async function updateSecuritySettingsAction(
  input: SecuritySettingsFormValues,
): Promise<SecuritySettingsActionResult> {
  const validation = validateSecuritySettings(input);

  if (!validation.ok) {
    return validation;
  }

  try {
    const settings = await webAdminApi.http.request<SecuritySettings>(
      "/saas/security/settings",
      {
        method: "PATCH",
        body: validation.data,
      },
    );

    return {
      ok: true,
      data: settings,
    };
  } catch (error) {
    return {
      ok: false,
      error: getErrorMessage(error),
    };
  }
}
