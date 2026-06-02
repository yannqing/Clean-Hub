import { webAdminApi } from "@/lib/api-client";

import type { HardwareConfigSummary } from "../types";

export type HardwareListQuery = {
  branchId?: string;
  deviceType?: string;
  status?: string;
  limit?: number;
  offset?: number;
};

export async function getDeviceListQuery(
  query?: HardwareListQuery,
): Promise<HardwareConfigSummary[]> {
  return webAdminApi.tenant.hardware.listDevices(query);
}
