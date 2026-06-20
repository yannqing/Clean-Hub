import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { PosNotImplementedError } from "../not-implemented.errors.js";
import { getRequestMeta } from "../request-meta.helper.js";
import { requirePathParam } from "../require-path-param.helper.js";
import {
  listPosNotifications,
  markAllPosNotificationsRead,
  markPosNotificationRead,
} from "./notifications.service.js";
import type {
  MarkPosNotificationReadRequest,
  PosNotificationListQuery,
} from "./notifications.types.js";

function notImplementedResponse(c: Context<AppBindings>, error: PosNotImplementedError) {
  return c.json(
    {
      message: error.message,
      code: error.code,
      requestId: c.get("requestId"),
    },
    error.status,
  );
}

export async function listPosNotificationsController(c: Context<AppBindings>) {
  const query = c.req.query() as PosNotificationListQuery;
  const result = await listPosNotifications({
    authContext: c.get("authContext"),
    query,
  });
  return c.json({ data: result });
}

export async function markPosNotificationReadController(c: Context<AppBindings>) {
  const notificationId = requirePathParam(c, "notificationId");
  if (notificationId instanceof Response) {
    return notificationId;
  }
  const rawBody = await c.req.json().catch(() => ({}));
  const data = rawBody as MarkPosNotificationReadRequest;

  try {
    const notification = await markPosNotificationRead({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      notificationId,
      data,
    });
    return c.json(notification);
  } catch (error) {
    if (error instanceof PosNotImplementedError) {
      return notImplementedResponse(c, error);
    }
    throw error;
  }
}

export async function markAllPosNotificationsReadController(
  c: Context<AppBindings>,
) {
  try {
    const result = await markAllPosNotificationsRead({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
    });
    return c.json(result);
  } catch (error) {
    if (error instanceof PosNotImplementedError) {
      return notImplementedResponse(c, error);
    }
    throw error;
  }
}
