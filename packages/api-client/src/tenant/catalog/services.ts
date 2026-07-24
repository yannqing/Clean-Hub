import type { ApiClient, ApiRequestOptions, QueryParams } from "../../types";
import type {
  CreateServiceRequest,
  ServiceListQuery,
  ServiceSummary,
  UpdateServiceStatusRequest,
  UpdateServiceRequest,
} from "./services.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createTenantServicesApi(client: ApiClient) {
  return {
    list: (query?: ServiceListQuery | QueryParams, options?: RequestOptions) =>
      client.get<ServiceSummary[]>("/tenant/services", {
        query,
        ...options,
      }),
    getDetail: (serviceId: string) =>
      client.get<ServiceSummary>(`/tenant/services/${serviceId}`),
    create: (data: CreateServiceRequest) =>
      client.post<ServiceSummary>("/tenant/services", data),
    update: (serviceId: string, data: UpdateServiceRequest) =>
      client.patch<ServiceSummary>(`/tenant/services/${serviceId}`, data),
    updateStatus: (serviceId: string, data: UpdateServiceStatusRequest) =>
      client.patch<ServiceSummary>(
        `/tenant/services/${serviceId}/status`,
        data,
      ),
    remove: (serviceId: string) =>
      client.delete<void>(`/tenant/services/${serviceId}`),
  };
}
