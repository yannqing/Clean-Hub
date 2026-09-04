import type {
  ApiRequestOptions,
  TenantPaymentIntegrationSummary,
} from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

type QueryOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export async function getTenantPaymentIntegrationsQuery(
  options: QueryOptions = {},
): Promise<TenantPaymentIntegrationSummary[]> {
  return webAdminApi.tenant.paymentIntegrations.list(options);
}
