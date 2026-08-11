import type { ApiRequestOptions } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

import type { ServiceSummary } from "../types";

type ServiceDetailRequestOptions = Omit<
  ApiRequestOptions,
  "method" | "body" | "query"
>;

export async function getServiceDetailQuery(
  serviceId: string,
  options: ServiceDetailRequestOptions = {},
): Promise<ServiceSummary> {
  return webAdminApi.tenant.services.getDetail(serviceId, options);
}
