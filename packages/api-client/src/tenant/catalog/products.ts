import type { ApiClient, ApiRequestOptions, QueryParams } from "../../types";
import type {
  CreateTenantProductRequest,
  CreateTenantProductResponse,
  RequestTenantProductMediaUploadRequest,
  TenantProductCategoryAttributeListResponse,
  TenantProductCategoryListResponse,
  TenantProductListQuery,
  TenantProductListResponse,
  TenantProductMediaUploadTicket,
  TenantProductOverview,
  TenantProductOverviewQuery,
} from "./products.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createTenantProductsApi(client: ApiClient) {
  return {
    list: (
      query?: TenantProductListQuery | QueryParams,
      options?: RequestOptions,
    ) =>
      client.get<TenantProductListResponse>("/tenant/products", {
        query,
        ...options,
      }),
    overview: (
      query?: TenantProductOverviewQuery | QueryParams,
      options?: RequestOptions,
    ) =>
      client.get<TenantProductOverview>("/tenant/products/overview", {
        query,
        ...options,
      }),
    create: (input: CreateTenantProductRequest, options?: RequestOptions) =>
      client.post<CreateTenantProductResponse>(
        "/tenant/products",
        input,
        options,
      ),
    categories: (options?: RequestOptions) =>
      client.get<TenantProductCategoryListResponse>(
        "/tenant/products/categories",
        options,
      ),
    categoryAttributes: (categoryId: string, options?: RequestOptions) =>
      client.get<TenantProductCategoryAttributeListResponse>(
        `/tenant/products/categories/${encodeURIComponent(categoryId)}/attributes`,
        options,
      ),
    requestMediaUpload: (
      input: RequestTenantProductMediaUploadRequest,
      options?: RequestOptions,
    ) =>
      client.post<TenantProductMediaUploadTicket>(
        "/tenant/products/media/uploads",
        input,
        options,
      ),
  };
}
