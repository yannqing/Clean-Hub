import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { getRequestMeta } from "../request-meta.helper.js";
import { PosNotificationError } from "./notifications.errors.js";
import {
  archivePosNotification,
  getPosNotificationsOverview,
  listPosNotifications,
  markAllPosNotificationsRead,
  markPosNotificationRead,
} from "./notifications.service.js";
import {
  posNotificationDeliveryParamsSchema,
  posNotificationListQuerySchema,
} from "./notifications.validation.js";
import { localizeErrorMessage } from "../../../http/error-messages.js";

function createErrorResponse(
  c: Context<AppBindings>,
  error: PosNotificationError,
) {
  return c.json(
    {
      message: localizeErrorMessage(error.message, c.get("locale")),
      code: error.code,
      requestId: c.get("requestId"),
    },
    error.status,
  );
}

export async function listPosNotificationsController(c: Context<AppBindings>) {
  const query = posNotificationListQuerySchema.parse(c.req.query());
  const result = await listPosNotifications({
    authContext: c.get("authContext"),
    query,
  });
  return c.json(result);
}

export async function getPosNotificationsOverviewController(
  c: Context<AppBindings>,
) {
  const overview = await getPosNotificationsOverview(c.get("authContext"));
  return c.json(overview);
}

export async function markPosNotificationReadController(c: Context<AppBindings>) {
  const params = posNotificationDeliveryParamsSchema.parse(c.req.param());

  try {
    const notification = await markPosNotificationRead({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      deliveryId: params.deliveryId,
    });
    return c.json(notification);
  } catch (error) {
    if (error instanceof PosNotificationError) {
      return createErrorResponse(c, error);
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
    if (error instanceof PosNotificationError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}

export async function archivePosNotificationController(c: Context<AppBindings>) {
  const params = posNotificationDeliveryParamsSchema.parse(c.req.param());

  try {
    const notification = await archivePosNotification({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      deliveryId: params.deliveryId,
    });
    return c.json(notification);
  } catch (error) {
    if (error instanceof PosNotificationError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}
