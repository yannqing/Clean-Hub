import { webAdminApi } from "@/lib/api-client";

import type { PlatformSettings, PlatformSettingsFormValues } from "../types";

export async function updatePlatformSettingsAction(
  input: PlatformSettingsFormValues,
): Promise<{ ok: true; data: PlatformSettings } | { ok: false; error: string }> {
  try {
    const data = await webAdminApi.saas.updatePlatformSettings(input);
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update platform settings.",
    };
  }
}
