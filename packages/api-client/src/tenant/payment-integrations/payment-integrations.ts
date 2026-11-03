import type { ApiClient, ApiRequestOptions } from "../../types";
import type {
  ConfigureOrangeMoneyPaymentIntegrationRequest,
  ConfigureWavePaymentIntegrationRequest,
  TenantPaymentIntegrationSummary,
  TenantPaymentProvider,
  UpdateTenantPaymentIntegrationRequest,
} from "./payment-integrations.types";

type ApiOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

function integrationPath(provider: TenantPaymentProvider): string {
  return `/tenant/payment-integrations/${encodeURIComponent(provider)}`;
}

export function createTenantPaymentIntegrationsApi(client: ApiClient) {
  return {
    list: (options: ApiOptions = {}) =>
      client.get<TenantPaymentIntegrationSummary[]>(
        "/tenant/payment-integrations",
        options,
      ),
    configureWave: (
      input: ConfigureWavePaymentIntegrationRequest,
      options: ApiOptions = {},
    ) =>
      client.put<TenantPaymentIntegrationSummary>(
        integrationPath("wave"),
        input,
        options,
      ),
    configureOrangeMoney: (
      input: ConfigureOrangeMoneyPaymentIntegrationRequest,
      options: ApiOptions = {},
    ) =>
      client.put<TenantPaymentIntegrationSummary>(
        integrationPath("orange_money"),
        input,
        options,
      ),
    verify: (provider: TenantPaymentProvider, options: ApiOptions = {}) =>
      client.post<TenantPaymentIntegrationSummary>(
        `${integrationPath(provider)}/verify`,
        undefined,
        options,
      ),
    update: (
      provider: TenantPaymentProvider,
      input: UpdateTenantPaymentIntegrationRequest,
      options: ApiOptions = {},
    ) =>
      client.patch<TenantPaymentIntegrationSummary>(
        integrationPath(provider),
        input,
        options,
      ),
    remove: (provider: TenantPaymentProvider, options: ApiOptions = {}) =>
      client.delete<{ deleted: true; provider: TenantPaymentProvider }>(
        integrationPath(provider),
        options,
      ),
  };
}
