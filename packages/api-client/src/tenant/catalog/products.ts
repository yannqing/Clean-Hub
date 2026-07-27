import type { ApiClient, ApiRequestOptions, QueryParams } from "../../types";
import type {
  CreateTenantProductRequest,
  CreateTenantProductResponse,
  RequestTenantProductMediaDownloads,
  RequestTenantProductMediaUploadRequest,
  TenantProductCategoryAttributeListResponse,
  TenantProductCategoryListResponse,
  TenantProductDetail,
  TenantProductListQuery,
  TenantProductListResponse,
  TenantProductMediaDownloadListResponse,
  TenantProductMediaUploadTicket,
  TenantProductOverview,
  TenantProductOverviewQuery,
  UpdateTenantProductRequest,
  UpdateTenantProductResponse,
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
    get: (productId: string, options?: RequestOptions) =>
      client.get<TenantProductDetail>(
        `/tenant/products/${encodeURIComponent(productId)}`,
        options,
      ),
    update: (
      productId: string,
      input: UpdateTenantProductRequest,
      options?: RequestOptions,
    ) =>
      client.patch<UpdateTenantProductResponse>(
        `/tenant/products/${encodeURIComponent(productId)}`,
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
    requestMediaDownloads: (
      input: RequestTenantProductMediaDownloads,
      options?: RequestOptions,
    ) =>
      client.post<TenantProductMediaDownloadListResponse>(
        "/tenant/products/media/downloads",
        input,
        options,
      ),
  };
}
