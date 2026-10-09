import type { Context } from "hono";

import { getRequestMeta } from "../../../http/request-meta.js";
import type { AppBindings } from "../../../http/types.js";
import { TenantNotificationError } from "./notifications.errors.js";
import {
  archiveTenantNotification,
  getTenantNotificationsOverview,
  listTenantNotifications,
  markAllTenantNotificationsRead,
  markTenantNotificationRead,
} from "./notifications.service.js";
import {
  tenantNotificationDeliveryParamsSchema,
  tenantNotificationListQuerySchema,
} from "./notifications.validation.js";

function createErrorResponse(
  c: Context<AppBindings>,
  error: TenantNotificationError,
) {
  return c.json(
    {
      message: error.message,
      code: error.code,
      requestId: c.get("requestId"),
    },
    error.status,
  );
}

export async function listTenantNotificationsController(
  c: Context<AppBindings>,
) {
  const query = tenantNotificationListQuerySchema.parse(c.req.query());
  const result = await listTenantNotifications({
    authContext: c.get("authContext"),
    query,
  });
  return c.json(result);
}

export async function getTenantNotificationsOverviewController(
  c: Context<AppBindings>,
) {
  const overview = await getTenantNotificationsOverview(c.get("authContext"));
  return c.json(overview);
}

export async function markTenantNotificationReadController(
  c: Context<AppBindings>,
) {
  const params = tenantNotificationDeliveryParamsSchema.parse(c.req.param());

  try {
    const notification = await markTenantNotificationRead({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      deliveryId: params.deliveryId,
    });
    return c.json(notification);
  } catch (error) {
    if (error instanceof TenantNotificationError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}

export async function markAllTenantNotificationsReadController(
  c: Context<AppBindings>,
) {
  try {
    const result = await markAllTenantNotificationsRead({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
    });
    return c.json(result);
  } catch (error) {
    if (error instanceof TenantNotificationError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}

export async function archiveTenantNotificationController(
  c: Context<AppBindings>,
) {
  const params = tenantNotificationDeliveryParamsSchema.parse(c.req.param());

  try {
    const notification = await archiveTenantNotification({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      deliveryId: params.deliveryId,
    });
    return c.json(notification);
  } catch (error) {
    if (error instanceof TenantNotificationError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}
