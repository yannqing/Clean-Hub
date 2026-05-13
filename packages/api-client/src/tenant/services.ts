import type { ApiClient, QueryParams } from "../types";
import type { ServiceSummary } from "./services.types";

export function createTenantServicesApi(client: ApiClient) {
  return {
    list: (query?: QueryParams) =>
      client.get<ServiceSummary[]>("/tenant/services", { query }),
  };
}
