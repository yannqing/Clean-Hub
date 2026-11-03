import { apiClient } from "@/lib/api-client";
import { ApiNetworkError, ApiTimeoutError, isApiHttpError } from "@cleanhub/api-client";

function mayUseCache(error: unknown) {
  return error instanceof ApiNetworkError || error instanceof ApiTimeoutError ||
    (isApiHttpError(error) && error.status >= 500);
}

import {
  getDeliveryStorageScope,
  getCachedDeliveryTaskDetail,
  getCachedDeliveryTasks,
  saveCachedDeliveryTaskDetail,
  saveCachedDeliveryTasks,
} from "../lib/offline-store";

export async function getDeliveryTasks() {
  const scope = await getDeliveryStorageScope();
  try {
    const response = await apiClient.mobile.delivery.listTasks();
    await saveCachedDeliveryTasks(response.data, scope);

    return {
      tasks: response.data,
      source: "network" as const,
    };
  } catch (error) {
    if (!mayUseCache(error)) throw error;
    const cachedTasks = await getCachedDeliveryTasks(scope);

    if (cachedTasks.length > 0) {
      return {
        tasks: cachedTasks,
        source: "cache" as const,
      };
    }

    throw error;
  }
}

export async function getDeliveryTaskDetail(taskId: string) {
  const scope = await getDeliveryStorageScope();
  try {
    const task = await apiClient.mobile.delivery.getTask(taskId);
    await saveCachedDeliveryTaskDetail(task, scope);

    return {
      task,
      source: "network" as const,
    };
  } catch (error) {
    if (!mayUseCache(error)) throw error;
    const cachedTask = await getCachedDeliveryTaskDetail(taskId, scope);

    if (cachedTask) {
      return {
        task: cachedTask,
        source: "cache" as const,
      };
    }

    throw error;
  }
}
