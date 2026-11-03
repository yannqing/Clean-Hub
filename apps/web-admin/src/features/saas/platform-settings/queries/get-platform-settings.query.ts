import { webAdminApi } from "@/lib/api-client";

import type { PlatformSettings } from "../types";

export async function getPlatformSettingsQuery(): Promise<PlatformSettings> {
  return webAdminApi.saas.platformSettings.get();
}
