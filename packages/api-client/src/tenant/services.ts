import type { ApiClient, QueryParams } from "../types";
import type {
  CreateServiceRequest,
  ServiceListQuery,
  ServiceSummary,
  UpdateServiceRequest,
} from "./services.types";

export function createTenantServicesApi(client: ApiClient) {
  return {
    list: (query?: ServiceListQuery | QueryParams) =>
      client.get<ServiceSummary[]>("/tenant/services", { query }),
    create: (data: CreateServiceRequest) =>
      client.post<ServiceSummary>("/tenant/services", data),
    update: (serviceId: string, data: UpdateServiceRequest) =>
      client.patch<ServiceSummary>(`/tenant/services/${serviceId}`, data),
    remove: (serviceId: string) =>
      client.delete<void>(`/tenant/services/${serviceId}`),
  };
}
