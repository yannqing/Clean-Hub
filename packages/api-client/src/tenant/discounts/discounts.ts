import type { ApiClient, ApiRequestOptions, QueryParams } from "../../types";
import type {
  CreateTenantDiscountRequest,
  DeleteTenantDiscountRequest,
  TenantDiscountDetail,
  TenantDiscountListOptions,
  TenantDiscountListQuery,
  TenantDiscountListResponse,
  TenantDiscountOptions,
  TenantDiscountOverview,
  UpdateTenantDiscountRequest,
  UpdateTenantDiscountStatusRequest,
} from "./discounts.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

const DISCOUNTS_PATH = "/tenant/discounts";

function discountPath(discountId: string): string {
  return `${DISCOUNTS_PATH}/${encodeURIComponent(discountId)}`;
}

export function createTenantDiscountsApi(client: ApiClient) {
  return {
    list: (
      query?: TenantDiscountListQuery | QueryParams,
      options?: RequestOptions,
    ) =>
      client.get<TenantDiscountListResponse>(DISCOUNTS_PATH, {
        query,
        ...options,
      }),
    overview: (options?: RequestOptions) =>
      client.get<TenantDiscountOverview>(`${DISCOUNTS_PATH}/overview`, options),
    listOptions: (options?: RequestOptions) =>
      client.get<TenantDiscountListOptions>(
        `${DISCOUNTS_PATH}/list-options`,
        options,
      ),
    options: (options?: RequestOptions) =>
      client.get<TenantDiscountOptions>(`${DISCOUNTS_PATH}/options`, options),
    get: (discountId: string, options?: RequestOptions) =>
      client.get<TenantDiscountDetail>(discountPath(discountId), options),
    create: (input: CreateTenantDiscountRequest, options?: RequestOptions) =>
      client.post<TenantDiscountDetail>(DISCOUNTS_PATH, input, options),
    update: (
      discountId: string,
      input: UpdateTenantDiscountRequest,
      options?: RequestOptions,
    ) =>
      client.patch<TenantDiscountDetail>(
        discountPath(discountId),
        input,
        options,
      ),
    updateStatus: (
      discountId: string,
      input: UpdateTenantDiscountStatusRequest,
      options?: RequestOptions,
    ) =>
      client.patch<TenantDiscountDetail>(
        `${discountPath(discountId)}/status`,
        input,
        options,
      ),
    delete: (
      discountId: string,
      input: DeleteTenantDiscountRequest,
      options?: RequestOptions,
    ) =>
      client.delete<void>(discountPath(discountId), {
        ...options,
        body: input,
        parseAs: "void",
      }),
  };
}
