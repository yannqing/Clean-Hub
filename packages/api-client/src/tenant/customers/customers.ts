import type { ApiClient, ApiRequestOptions } from "../../types";
import type {
  CreateTenantCustomerCommentRequest,
  DeleteTenantCustomerCommentRequest,
  TenantCustomerAccountCustomersQuery,
  TenantCustomerAccountCustomersResponse,
  TenantCustomerAccountDetail,
  TenantCustomerAccountListQuery,
  TenantCustomerAccountListResponse,
  TenantCustomerAccountOverview,
  TenantCustomerAttachmentUploadRequest,
  TenantCustomerAttachmentUploadTicket,
  TenantCustomerDetail,
  TenantCustomerListQuery,
  TenantCustomerListResponse,
  TenantCustomerOverview,
  TenantCustomerOverviewQuery,
  TenantCustomerTimelineItem,
  TenantCustomerTimelineQuery,
  TenantCustomerTimelineResponse,
  UpdateTenantCustomerCommentRequest,
  UpdateTenantCustomerAccountRequest,
} from "./customers.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createTenantCustomersApi(client: ApiClient) {
  return {
    list: (query?: TenantCustomerListQuery, options?: RequestOptions) =>
      client.get<TenantCustomerListResponse>("/tenant/customers", {
        query,
        ...options,
      }),
    overview: (query?: TenantCustomerOverviewQuery, options?: RequestOptions) =>
      client.get<TenantCustomerOverview>("/tenant/customers/overview", {
        query,
        ...options,
      }),
    get: (customerId: string, options?: RequestOptions) =>
      client.get<TenantCustomerDetail>(
        `/tenant/customers/${encodeURIComponent(customerId)}`,
        options,
      ),
    listAccounts: (
      query?: TenantCustomerAccountListQuery,
      options?: RequestOptions,
    ) =>
      client.get<TenantCustomerAccountListResponse>(
        "/tenant/customers/accounts",
        { query, ...options },
      ),
    accountsOverview: (options?: RequestOptions) =>
      client.get<TenantCustomerAccountOverview>(
        "/tenant/customers/accounts/overview",
        options,
      ),
    getAccount: (accountId: string, options?: RequestOptions) =>
      client.get<TenantCustomerAccountDetail>(
        `/tenant/customers/accounts/${encodeURIComponent(accountId)}`,
        options,
      ),
    listAccountCustomers: (
      accountId: string,
      query?: TenantCustomerAccountCustomersQuery,
      options?: RequestOptions,
    ) =>
      client.get<TenantCustomerAccountCustomersResponse>(
        `/tenant/customers/accounts/${encodeURIComponent(accountId)}/customers`,
        { query, ...options },
      ),
    updateAccount: (
      accountId: string,
      input: UpdateTenantCustomerAccountRequest,
      options?: RequestOptions,
    ) =>
      client.patch<TenantCustomerAccountDetail>(
        `/tenant/customers/accounts/${encodeURIComponent(accountId)}`,
        input,
        options,
      ),
    timeline: (
      customerId: string,
      query?: TenantCustomerTimelineQuery,
      options?: RequestOptions,
    ) =>
      client.get<TenantCustomerTimelineResponse>(
        `/tenant/customers/${encodeURIComponent(customerId)}/timeline`,
        { query, ...options },
      ),
    createComment: (
      customerId: string,
      input: CreateTenantCustomerCommentRequest,
      options?: RequestOptions,
    ) =>
      client.post<TenantCustomerTimelineItem>(
        `/tenant/customers/${encodeURIComponent(customerId)}/comments`,
        input,
        options,
      ),
    requestAttachmentUpload: (
      customerId: string,
      input: TenantCustomerAttachmentUploadRequest,
      options?: RequestOptions,
    ) =>
      client.post<TenantCustomerAttachmentUploadTicket>(
        `/tenant/customers/${encodeURIComponent(customerId)}/media/uploads`,
        input,
        options,
      ),
    updateComment: (
      customerId: string,
      commentId: string,
      input: UpdateTenantCustomerCommentRequest,
      options?: RequestOptions,
    ) =>
      client.patch<TenantCustomerTimelineItem>(
        `/tenant/customers/${encodeURIComponent(customerId)}/comments/${encodeURIComponent(commentId)}`,
        input,
        options,
      ),
    deleteComment: (
      customerId: string,
      commentId: string,
      input: DeleteTenantCustomerCommentRequest,
      options?: RequestOptions,
    ) =>
      client.delete<void>(
        `/tenant/customers/${encodeURIComponent(customerId)}/comments/${encodeURIComponent(commentId)}`,
        { ...options, body: input, parseAs: "void" },
      ),
  };
}
