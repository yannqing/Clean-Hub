import type { ApiClient, ApiRequestOptions } from "../types";
import type {
  PosPendingTasksResponse,
  PosRecentActivitiesResponse,
  PosWorkspaceOverview,
} from "./workspace.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

const BASE = "/pos/workspace";

export function createPosWorkspaceApi(client: ApiClient) {
  return {
    getOverview: (query?: { branchId?: string }, options?: RequestOptions) =>
      client.get<PosWorkspaceOverview>(`${BASE}/overview`, {
        query,
        ...options,
      }),

    getRecentActivities: (
      query?: { branchId?: string; limit?: number },
      options?: RequestOptions,
    ) =>
      client.get<PosRecentActivitiesResponse>(`${BASE}/recent-activities`, {
        query,
        ...options,
      }),

    getPendingTasks: (
      query?: { branchId?: string },
      options?: RequestOptions,
    ) =>
      client.get<PosPendingTasksResponse>(`${BASE}/pending-tasks`, {
        query,
        ...options,
      }),
  };
}
