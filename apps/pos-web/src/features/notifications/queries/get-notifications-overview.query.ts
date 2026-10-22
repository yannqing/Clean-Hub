import "server-only";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

import type { PosNotificationOverview } from "../types";

export async function getNotificationsOverviewQuery(): Promise<PosNotificationOverview> {
  const options = await getPosServerApiRequestOptions();
  return posApi.pos.notifications.overview(options);
}
