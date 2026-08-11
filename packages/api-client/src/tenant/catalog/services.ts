import type { ApiClient, ApiRequestOptions, QueryParams } from "../../types";
import type {
  CreateServiceRequest,
  ServiceCategoryListQuery,
  ServiceCategorySummary,
  ServiceDetail,
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
    listCategories: (
      query?: ServiceCategoryListQuery | QueryParams,
      options?: RequestOptions,
    ) =>
      client.get<ServiceCategorySummary[]>("/tenant/service-categories", {
        query,
        ...options,
      }),
    getDetail: (serviceId: string, options?: RequestOptions) =>
      client.get<ServiceDetail>(
        `/tenant/services/${encodeURIComponent(serviceId)}`,
        options,
      ),
    create: (data: CreateServiceRequest, options?: RequestOptions) =>
      client.post<ServiceDetail>("/tenant/services", data, options),
    update: (
      serviceId: string,
      data: UpdateServiceRequest,
      options?: RequestOptions,
    ) =>
      client.patch<ServiceDetail>(
        `/tenant/services/${encodeURIComponent(serviceId)}`,
        data,
        options,
      ),
    updateStatus: (
      serviceId: string,
      data: UpdateServiceStatusRequest,
      options?: RequestOptions,
    ) =>
      client.patch<ServiceSummary>(
        `/tenant/services/${encodeURIComponent(serviceId)}/status`,
        data,
        options,
      ),
    remove: (serviceId: string, options?: RequestOptions) =>
      client.delete<void>(`/tenant/services/${encodeURIComponent(serviceId)}`, {
        ...options,
        parseAs: "void",
      }),
  };
}
