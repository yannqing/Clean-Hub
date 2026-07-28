import type { ApiRequestOptions } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

import type { HardwareConfigSummary } from "../types";

const DEVICE_DETAIL_PAGE_SIZE = 100;

/**
 * Hardware currently exposes a tenant-scoped list endpoint rather than a
 * dedicated detail endpoint. Keep the page-level lookup in the query layer
 * so the edit route can still load data with the server request cookies.
 */
export async function getDeviceDetailQuery(
  hardwareId: string,
  options: Omit<ApiRequestOptions, "method" | "body" | "query"> = {},
): Promise<HardwareConfigSummary | null> {
  let offset = 0;

  while (true) {
    const devices = await webAdminApi.tenant.hardware.listDevices(
      { limit: DEVICE_DETAIL_PAGE_SIZE, offset },
      options,
    );
    const device = devices.find((item) => item.id === hardwareId);

    if (device) {
      return device;
    }

    if (devices.length < DEVICE_DETAIL_PAGE_SIZE) {
      return null;
    }

    offset += devices.length;
  }
}
