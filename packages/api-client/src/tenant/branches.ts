import type { ApiClient, ApiRequestOptions, QueryParams } from "../types";
import type {
  BranchListQuery,
  BranchSummary,
  CreateBranchRequest,
  UpdateBranchRequest,
  UpdateBranchStatusRequest,
} from "./branches.types";

type ApiOptionsWithoutBody = Omit<ApiRequestOptions, "method" | "body">;

export function createTenantBranchesApi(client: ApiClient) {
  return {
    list: (
      query?: BranchListQuery | QueryParams,
      options: ApiOptionsWithoutBody = {},
    ) => client.get<BranchSummary[]>("/tenant/branches", { ...options, query }),
    get: (branchId: string, options: ApiOptionsWithoutBody = {}) =>
      client.get<BranchSummary>(`/tenant/branches/${branchId}`, options),
    create: (
      data: CreateBranchRequest,
      options: ApiOptionsWithoutBody = {},
    ) => client.post<BranchSummary>("/tenant/branches", data, options),
    update: (
      branchId: string,
      data: UpdateBranchRequest,
      options: ApiOptionsWithoutBody = {},
    ) =>
      client.patch<BranchSummary>(
        `/tenant/branches/${branchId}`,
        data,
        options,
      ),
    updateStatus: (
      branchId: string,
      data: UpdateBranchStatusRequest,
      options: ApiOptionsWithoutBody = {},
    ) =>
      client.patch<BranchSummary>(
        `/tenant/branches/${branchId}/status`,
        data,
        options,
      ),
    getDetail: (branchId: string, options: ApiOptionsWithoutBody = {}) =>
      client.get<BranchSummary>(`/tenant/branches/${branchId}`, options),
  };
}
