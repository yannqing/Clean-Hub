import { webAdminApi } from "@/lib/api-client";

import type { SecuritySettings } from "../types";

export async function getSecuritySettingsQuery(): Promise<SecuritySettings> {
  return webAdminApi.http.request<SecuritySettings>(
    "/saas/security/settings",
  );
}
