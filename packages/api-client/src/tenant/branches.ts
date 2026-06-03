import type { ApiClient, ApiRequestOptions, QueryParams } from "../types";
import type {
  BranchDetail,
  BranchListQuery,
  BranchSummary,
  CreateBranchRequest,
  UpdateBranchRequest,
  UpdateBranchStatusRequest,
} from "./branches.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createTenantBranchesApi(client: ApiClient) {
  return {
    list: (query?: BranchListQuery | QueryParams, options?: RequestOptions) =>
      client.get<BranchSummary[]>("/tenant/branches", { ...options, query }),
    get: (branchId: string, options?: RequestOptions) =>
      client.get<BranchDetail>(
        `/tenant/branches/${encodeURIComponent(branchId)}`,
        options,
      ),
    getDetail: (branchId: string, options?: RequestOptions) =>
      client.get<BranchDetail>(
        `/tenant/branches/${encodeURIComponent(branchId)}`,
        options,
      ),
    create: (input: CreateBranchRequest, options?: RequestOptions) =>
      client.post<BranchDetail>("/tenant/branches", input, options),
    update: (
      branchId: string,
      input: UpdateBranchRequest,
      options?: RequestOptions,
    ) =>
      client.patch<BranchDetail>(
        `/tenant/branches/${encodeURIComponent(branchId)}`,
        input,
        options,
      ),
    updateStatus: (
      branchId: string,
      input: UpdateBranchStatusRequest,
      options?: RequestOptions,
    ) =>
      client.patch<BranchDetail>(
        `/tenant/branches/${encodeURIComponent(branchId)}/status`,
        input,
        options,
      ),
  };
}
