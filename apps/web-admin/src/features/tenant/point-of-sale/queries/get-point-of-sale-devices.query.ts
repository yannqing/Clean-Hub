import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";
import type { PointOfSaleDeviceList, PointOfSaleDeviceQuery } from "../types";

export async function getPointOfSaleDevicesQuery(
  query?: PointOfSaleDeviceQuery,
): Promise<PointOfSaleDeviceList> {
  return webAdminApi.tenant.posChannel.listDevices(
    query,
    await getTenantServerApiRequestOptions(),
  );
}
