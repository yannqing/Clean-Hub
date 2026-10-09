import type { ApiClient, ApiRequestOptions } from "../../types";
import type {
  CreateTenantTaxRateRequest,
  TenantTaxRate,
  TenantTaxRateListQuery,
  UpdateTenantTaxRateRequest,
} from "./tax-rates.types";
import type { PlatformTaxTemplate } from "../../saas/platform-settings";

type TenantTaxRatesRequestOptions = Omit<
  ApiRequestOptions,
  "method" | "body" | "query"
>;

export function createTenantTaxRatesApi(client: ApiClient) {
  return {
    listTemplates: (options: TenantTaxRatesRequestOptions = {}) =>
      client.get<{ data: PlatformTaxTemplate[] }>("/tenant/tax-rates/templates", options),
    applyTemplate: (
      input: { countryCode: string; templateVersion: number; settingsVersion: number },
      options: TenantTaxRatesRequestOptions = {},
    ) =>
      client.post<{ template: PlatformTaxTemplate; settingsVersion: number; defaultTaxRate: string }>(
        "/tenant/tax-rates/templates/apply",
        input,
        options,
      ),
    list: (
      query?: TenantTaxRateListQuery,
      options: TenantTaxRatesRequestOptions = {},
    ) =>
      client.get<TenantTaxRate[]>("/tenant/tax-rates", {
        ...options,
        query:
          query?.includeArchived === undefined
            ? undefined
            : { includeArchived: String(query.includeArchived) },
      }),
    create: (
      input: CreateTenantTaxRateRequest,
      options: TenantTaxRatesRequestOptions = {},
    ) => client.post<TenantTaxRate>("/tenant/tax-rates", input, options),
    update: (
      taxRateId: string,
      input: UpdateTenantTaxRateRequest,
      options: TenantTaxRatesRequestOptions = {},
    ) =>
      client.patch<TenantTaxRate>(
        `/tenant/tax-rates/${encodeURIComponent(taxRateId)}`,
        input,
        options,
      ),
    remove: (taxRateId: string, options: TenantTaxRatesRequestOptions = {}) =>
      client.delete<void>(
        `/tenant/tax-rates/${encodeURIComponent(taxRateId)}`,
        options,
      ),
  };
}
