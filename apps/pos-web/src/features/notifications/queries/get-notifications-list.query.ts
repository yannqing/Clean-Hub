import "server-only";

import type { PosNotificationListQuery } from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

import type { PosNotificationListResponse } from "../types";

export async function getNotificationsListQuery(
  query?: PosNotificationListQuery,
): Promise<PosNotificationListResponse> {
  const options = await getPosServerApiRequestOptions();
  return posApi.pos.notifications.list(query, options);
}
