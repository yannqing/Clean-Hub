import { webAdminApi } from "@/lib/api-client";

import type { SecuritySettings } from "../types";

export async function getSecuritySettingsQuery(): Promise<SecuritySettings> {
  return webAdminApi.saas.securitySettings.get();
}
