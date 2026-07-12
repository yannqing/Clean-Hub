import { apiClient } from "@/lib/api-client";

import {
  getCachedDeliveryTaskDetail,
  getCachedDeliveryTasks,
  saveCachedDeliveryTaskDetail,
  saveCachedDeliveryTasks,
} from "../lib/offline-store";

export async function getDeliveryTasks() {
  try {
    const response = await apiClient.mobile.delivery.listTasks();
    await saveCachedDeliveryTasks(response.data);

    return {
      tasks: response.data,
      source: "network" as const,
    };
  } catch (error) {
    const cachedTasks = await getCachedDeliveryTasks();

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
  try {
    const task = await apiClient.mobile.delivery.getTask(taskId);
    await saveCachedDeliveryTaskDetail(task);

    return {
      task,
      source: "network" as const,
    };
  } catch (error) {
    const cachedTask = await getCachedDeliveryTaskDetail(taskId);

    if (cachedTask) {
      return {
        task: cachedTask,
        source: "cache" as const,
      };
    }

    throw error;
  }
}
