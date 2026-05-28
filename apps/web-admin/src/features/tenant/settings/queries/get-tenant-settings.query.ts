import { webAdminApi } from "@/lib/api-client";

import type { TenantSettings } from "../types";

export async function getTenantSettingsQuery(): Promise<TenantSettings> {
  return webAdminApi.http.request<TenantSettings>("/tenant/settings");
}

