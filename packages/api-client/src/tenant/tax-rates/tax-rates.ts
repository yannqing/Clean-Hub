import type { ApiClient, ApiRequestOptions } from "../../types";
import type {
  CreateTenantTaxRateRequest,
  TenantTaxRate,
  TenantTaxRateListQuery,
  UpdateTenantTaxRateRequest,
} from "./tax-rates.types";

type TenantTaxRatesRequestOptions = Omit<
  ApiRequestOptions,
  "method" | "body" | "query"
>;

export function createTenantTaxRatesApi(client: ApiClient) {
  return {
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
