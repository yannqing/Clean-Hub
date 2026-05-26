import { webAdminApi } from "@/lib/api-client";

import type { ServiceSummary } from "../types";

export async function getServiceDetailQuery(
  serviceId: string,
): Promise<ServiceSummary> {
  return webAdminApi.tenant.services.getDetail(serviceId);
}
