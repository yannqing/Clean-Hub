"use server";

import { revalidatePath } from "next/cache";
import { ApiHttpError } from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

import type {
  NotificationActionResult,
  PosNotificationErrorCode,
  PosNotificationInboxItem,
} from "./types";

const NOTIFICATIONS_LIST_PATH = "/notifications";

const NOTIFICATION_ERROR_MESSAGES: Record<PosNotificationErrorCode, string> = {
  NOTIFICATION_NOT_FOUND: "通知不存在或无权访问。",
  NOTIFICATION_ARCHIVED: "已归档通知不能再次标记为已读。",
  VALIDATION_ERROR: "提交内容校验未通过，请检查后重试。",
};

function revalidateNotifications(): void {
  revalidatePath(NOTIFICATIONS_LIST_PATH);
}

async function runNotificationAction<TPayload>(
  task: () => Promise<TPayload>,
): Promise<NotificationActionResult<TPayload>> {
  try {
    const data = await task();
    return { ok: true, message: "操作成功。", data };
  } catch (error) {
    if (error instanceof ApiHttpError) {
      const code = error.code as PosNotificationErrorCode | undefined;
      return {
        ok: false,
        message:
          (code && NOTIFICATION_ERROR_MESSAGES[code]) ||
          error.message ||
          "操作失败，请稍后重试。",
        code,
        status: error.status,
      };
    }

    const message =
      error instanceof Error ? error.message : "操作失败，请稍后重试。";
    return { ok: false, message };
  }
}

export async function markNotificationReadAction(
  deliveryId: string,
): Promise<NotificationActionResult<PosNotificationInboxItem>> {
  const result = await runNotificationAction(async () => {
    const options = await getPosServerApiRequestOptions();
    return posApi.pos.notifications.markRead(deliveryId, options);
  });

  if (result.ok) {
    revalidateNotifications();
  }

  return result;
}

export async function markAllNotificationsReadAction(): Promise<
  NotificationActionResult<{ updated: number }>
> {
  const result = await runNotificationAction(async () => {
    const options = await getPosServerApiRequestOptions();
    return posApi.pos.notifications.markAllRead(options);
  });

  if (result.ok) {
    revalidateNotifications();
  }

  return result;
}

export async function archiveNotificationAction(
  deliveryId: string,
): Promise<NotificationActionResult<PosNotificationInboxItem>> {
  const result = await runNotificationAction(async () => {
    const options = await getPosServerApiRequestOptions();
    return posApi.pos.notifications.archive(deliveryId, options);
  });

  if (result.ok) {
    revalidateNotifications();
  }

  return result;
}
