import type { ApiClient, ApiRequestOptions } from "../types";
import type {
  MobileAssignDeliveryTaskRequest,
  MobileCancelDeliveryTaskRequest,
  MobileDeliveryDispatchBoardQuery,
  MobileDeliveryDispatchBoardResponse,
  MobileDeliveryMutationResult,
  MobileDeliveryTaskDetail,
  MobileDeliveryTaskListItem,
  MobileDeliveryTaskListQuery,
  MobileDeliveryListResponse,
  MobileDispatchDeliveryTaskRequest,
  MobileReassignDeliveryTaskRequest,
  MobileSignDeliveryTaskRequest,
  MobileUpdateDeliveryStatusRequest,
  MobileUploadDeliveryProofRequest,
} from "./delivery.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createMobileDeliveryApi(client: ApiClient) {
  return {
    listTasks: (
      query?: MobileDeliveryTaskListQuery,
      options?: RequestOptions,
    ) =>
      client.get<MobileDeliveryListResponse<MobileDeliveryTaskListItem>>(
        "/mobile/delivery/tasks",
        { ...options, query },
      ),
    listTodayTasks: (options?: RequestOptions) =>
      client.get<MobileDeliveryListResponse<MobileDeliveryTaskListItem>>(
        "/mobile/delivery/tasks/today",
        options,
      ),
    createAssignedTask: (
      input: MobileAssignDeliveryTaskRequest,
      options?: RequestOptions,
    ) =>
      client.post<MobileDeliveryTaskDetail>(
        "/mobile/delivery/tasks",
        input,
        options,
      ),
    getTask: (taskId: string, options?: RequestOptions) =>
      client.get<MobileDeliveryTaskDetail>(
        `/mobile/delivery/tasks/${encodeURIComponent(taskId)}`,
        options,
      ),
    getDispatchBoard: (
      query?: MobileDeliveryDispatchBoardQuery,
      options?: RequestOptions,
    ) =>
      client.get<MobileDeliveryDispatchBoardResponse>(
        "/mobile/delivery/dispatch/board",
        { ...options, query },
      ),
    dispatchTask: (
      taskId: string,
      input: MobileDispatchDeliveryTaskRequest,
      options?: RequestOptions,
    ) =>
      client.post<MobileDeliveryMutationResult>(
        `/mobile/delivery/tasks/${encodeURIComponent(taskId)}/dispatch`,
        input,
        options,
      ),
    reassignTask: (
      taskId: string,
      input: MobileReassignDeliveryTaskRequest,
      options?: RequestOptions,
    ) =>
      client.post<MobileDeliveryMutationResult>(
        `/mobile/delivery/tasks/${encodeURIComponent(taskId)}/reassign`,
        input,
        options,
      ),
    cancelTask: (
      taskId: string,
      input: MobileCancelDeliveryTaskRequest,
      options?: RequestOptions,
    ) =>
      client.post<MobileDeliveryMutationResult>(
        `/mobile/delivery/tasks/${encodeURIComponent(taskId)}/cancel`,
        input,
        options,
      ),
    updateStatus: (
      taskId: string,
      input: MobileUpdateDeliveryStatusRequest,
      options?: RequestOptions,
    ) =>
      client.post<MobileDeliveryMutationResult>(
        `/mobile/delivery/tasks/${encodeURIComponent(taskId)}/status`,
        input,
        options,
      ),
    uploadProof: (
      taskId: string,
      input: MobileUploadDeliveryProofRequest,
      options?: RequestOptions,
    ) =>
      client.post<MobileDeliveryMutationResult>(
        `/mobile/delivery/tasks/${encodeURIComponent(taskId)}/proofs`,
        input,
        options,
      ),
    signTask: (
      taskId: string,
      input: MobileSignDeliveryTaskRequest,
      options?: RequestOptions,
    ) =>
      client.post<MobileDeliveryMutationResult>(
        `/mobile/delivery/tasks/${encodeURIComponent(taskId)}/signature`,
        input,
        options,
      ),
  };
}
