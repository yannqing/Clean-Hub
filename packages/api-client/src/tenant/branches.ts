import type { ApiClient, QueryParams } from "../types";
import type {
  BranchListQuery,
  BranchSummary,
  CreateBranchRequest,
  UpdateBranchRequest,
  UpdateBranchStatusRequest,
} from "./branches.types";

export function createTenantBranchesApi(client: ApiClient) {
  return {
    list: (query?: BranchListQuery | QueryParams) =>
      client.get<BranchSummary[]>("/tenant/branches", { query }),
    getDetail: (branchId: string) =>
      client.get<BranchSummary>(`/tenant/branches/${branchId}`),
    create: (data: CreateBranchRequest) =>
      client.post<BranchSummary>("/tenant/branches", data),
    update: (branchId: string, data: UpdateBranchRequest) =>
      client.patch<BranchSummary>(`/tenant/branches/${branchId}`, data),
    updateStatus: (branchId: string, data: UpdateBranchStatusRequest) =>
      client.patch<BranchSummary>(`/tenant/branches/${branchId}/status`, data),
  };
}
