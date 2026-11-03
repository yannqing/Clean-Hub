import type { ApiRequestOptions } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

import type { PointOfSaleDevice, PointOfSaleDeviceList } from "../types";

const PAGE_SIZE = 100;

export type PointOfSaleDeviceDetail = {
  device: PointOfSaleDevice;
  availableBranches: PointOfSaleDeviceList["availableBranches"];
};

export async function getPointOfSaleDeviceQuery(
  terminalId: string,
  options: Omit<ApiRequestOptions, "method" | "body" | "query"> = {},
): Promise<PointOfSaleDeviceDetail | null> {
  let offset = 0;

  while (true) {
    const result = await webAdminApi.tenant.posChannel.listDevices(
      { limit: PAGE_SIZE, offset },
      options,
    );
    const device = result.data.find((item) => item.id === terminalId);

    if (device) {
      return { device, availableBranches: result.availableBranches };
    }
    if (result.data.length < PAGE_SIZE) return null;
    offset += result.data.length;
  }
}
