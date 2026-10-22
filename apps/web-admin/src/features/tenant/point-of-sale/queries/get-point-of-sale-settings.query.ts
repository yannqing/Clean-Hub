import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";
import type { PointOfSaleSettings } from "../types";

export async function getPointOfSaleSettingsQuery(): Promise<PointOfSaleSettings> {
  return webAdminApi.tenant.posChannel.getSettings(
    await getTenantServerApiRequestOptions(),
  );
}
