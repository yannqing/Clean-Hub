import type { ApiClient, ApiRequestOptions } from "../types";
import type {
  MobileAssignDeliveryTaskRequest,
  MobileDeliveryMutationResult,
  MobileDeliveryTaskDetail,
  MobileDeliveryTaskListItem,
  MobileDeliveryListResponse,
  MobileSignDeliveryTaskRequest,
  MobileUpdateDeliveryStatusRequest,
  MobileUploadDeliveryProofRequest,
} from "./delivery.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createMobileDeliveryApi(client: ApiClient) {
  return {
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
      input: MobileUploadDeliveryProofRequest | FormData,
      options?: RequestOptions,
    ) =>
      client.post<MobileDeliveryMutationResult>(
        `/mobile/delivery/tasks/${encodeURIComponent(taskId)}/proofs`,
        input,
        options,
      ),
    signTask: (
      taskId: string,
      input: MobileSignDeliveryTaskRequest | FormData,
      options?: RequestOptions,
    ) =>
      client.post<MobileDeliveryMutationResult>(
        `/mobile/delivery/tasks/${encodeURIComponent(taskId)}/signature`,
        input,
        options,
      ),
  };
}
