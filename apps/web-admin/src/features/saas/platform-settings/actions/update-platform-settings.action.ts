import { webAdminApi } from "@/lib/api-client";

import type {
  PlatformSettingsActionResult,
  PlatformSettingsFormValues,
} from "../types";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Failed to update platform settings.";
}

export async function updatePlatformSettingsAction(
  input: PlatformSettingsFormValues,
): Promise<PlatformSettingsActionResult> {
  try {
    const settings = await webAdminApi.saas.platformSettings.update(input);
    return { ok: true, data: settings };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
