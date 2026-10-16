import { getDb, type Database } from "@cleanhub/db";

import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";
import {
  assertTenantContext,
  requireFeatureEnabled,
} from "../../auth/permission.helper.js";
import { writeAuditLog } from "../../audit/audit.helper.js";
import {
  getPosSyncErrorNotificationCopy,
  isPosSyncErrorNotification,
} from "../../notifications/system-notification-copy.js";
import { findTenantDefaultLanguage } from "../settings/settings.repository.js";
import { TenantNotificationError } from "./notifications.errors.js";
import {
  archiveTenantNotificationDeliveryRecord,
  countTenantNotificationInbox,
  findTenantNotificationDeliveryById,
  findTenantNotificationInbox,
  getTenantNotificationOverview as getTenantNotificationOverviewRecord,
  markAllTenantNotificationDeliveriesRead,
  markTenantNotificationDeliveryReadRecord,
} from "./notifications.repository.js";
import type {
  ArchiveTenantNotificationInput,
  MarkAllTenantNotificationsReadInput,
  MarkTenantNotificationReadInput,
  TenantNotificationInboxItem,
  TenantNotificationListQuery,
  TenantNotificationListResponse,
  TenantNotificationOverview,
} from "./notifications.types.js";

function requireTenantId(authContext: AuthContext): string {
  assertTenantContext(authContext);
  return authContext.tenantId!;
}

function localizeSystemNotification(
  item: TenantNotificationInboxItem,
  locale: string,
): TenantNotificationInboxItem {
  if (!isPosSyncErrorNotification(item) || !item.relatedId) {
    return item;
  }

  const copy = getPosSyncErrorNotificationCopy(locale, item.relatedId);

  return {
    ...item,
    title: copy.title,
    content: copy.content,
  };
}

export async function listTenantNotifications(
  input: { authContext: AuthContext; query: TenantNotificationListQuery },
  db: Database = getDb(),
): Promise<TenantNotificationListResponse> {
  const tenantId = requireTenantId(input.authContext);
  await requireFeatureEnabled(input.authContext, "notifications", db);

  const listInput = {
    tenantId,
    userId: input.authContext.userId,
    query: {
      ...input.query,
      limit: input.query.limit ?? 50,
      offset: input.query.offset ?? 0,
    },
  };

  const [data, total, locale] = await Promise.all([
    findTenantNotificationInbox(db, listInput),
    countTenantNotificationInbox(db, listInput),
    findTenantDefaultLanguage(db, tenantId),
  ]);

  return {
    data: data.map((item) => localizeSystemNotification(item, locale)),
    total,
  };
}

export async function getTenantNotificationsOverview(
  authContext: AuthContext,
  db: Database = getDb(),
): Promise<TenantNotificationOverview> {
  const tenantId = requireTenantId(authContext);
  await requireFeatureEnabled(authContext, "notifications", db);

  return getTenantNotificationOverviewRecord(db, {
    tenantId,
    userId: authContext.userId,
  });
}

export async function markTenantNotificationRead(
  input: MarkTenantNotificationReadInput,
  db: Database = getDb(),
): Promise<TenantNotificationInboxItem> {
  const tenantId = requireTenantId(input.authContext);
  await requireFeatureEnabled(input.authContext, "notifications", db);
  const locale = await findTenantDefaultLanguage(db, tenantId);

  const notification = await db.transaction(async (tx) => {
    const before = await loadDeliveryOrThrow(tx, {
      tenantId,
      userId: input.authContext.userId,
      deliveryId: input.deliveryId,
    });

    if (before.readStatus === "archived") {
      throw new TenantNotificationError(
        "NOTIFICATION_ARCHIVED",
        "Archived notifications cannot be marked as read.",
        422,
      );
    }

    if (before.readStatus === "unread") {
      await markTenantNotificationDeliveryReadRecord(tx, {
        tenantId,
        userId: input.authContext.userId,
        deliveryId: input.deliveryId,
        actorUserId: input.authContext.userId,
      });
    }

    const after = await loadDeliveryOrThrow(tx, {
      tenantId,
      userId: input.authContext.userId,
      deliveryId: input.deliveryId,
    });

    if (before.readStatus !== after.readStatus) {
      await writeNotificationAudit(tx, input.authContext, input.requestMeta, {
        eventType: "tenant.notification.read",
        entityId: input.deliveryId,
        before: { readStatus: before.readStatus },
        after: { readStatus: after.readStatus },
      });
    }

    return after;
  });

  return localizeSystemNotification(notification, locale);
}

export async function archiveTenantNotification(
  input: ArchiveTenantNotificationInput,
  db: Database = getDb(),
): Promise<TenantNotificationInboxItem> {
  const tenantId = requireTenantId(input.authContext);
  await requireFeatureEnabled(input.authContext, "notifications", db);
  const locale = await findTenantDefaultLanguage(db, tenantId);

  const notification = await db.transaction(async (tx) => {
    const before = await loadDeliveryOrThrow(tx, {
      tenantId,
      userId: input.authContext.userId,
      deliveryId: input.deliveryId,
    });

    if (before.readStatus !== "archived") {
      await archiveTenantNotificationDeliveryRecord(tx, {
        tenantId,
        userId: input.authContext.userId,
        deliveryId: input.deliveryId,
        actorUserId: input.authContext.userId,
      });
    }

    const after = await loadDeliveryOrThrow(tx, {
      tenantId,
      userId: input.authContext.userId,
      deliveryId: input.deliveryId,
    });

    if (before.readStatus !== after.readStatus) {
      await writeNotificationAudit(tx, input.authContext, input.requestMeta, {
        eventType: "tenant.notification.archived",
        entityId: input.deliveryId,
        before: { readStatus: before.readStatus },
        after: { readStatus: after.readStatus },
      });
    }

    return after;
  });

  return localizeSystemNotification(notification, locale);
}

export async function markAllTenantNotificationsRead(
  input: MarkAllTenantNotificationsReadInput,
  db: Database = getDb(),
): Promise<{ updated: number }> {
  const tenantId = requireTenantId(input.authContext);
  await requireFeatureEnabled(input.authContext, "notifications", db);

  return db.transaction(async (tx) => {
    const updated = await markAllTenantNotificationDeliveriesRead(tx, {
      tenantId,
      userId: input.authContext.userId,
      actorUserId: input.authContext.userId,
    });

    if (updated > 0) {
      await writeNotificationAudit(tx, input.authContext, input.requestMeta, {
        eventType: "tenant.notification.read_all",
        entityId: input.authContext.userId,
        after: { updated },
      });
    }

    return { updated };
  });
}

async function loadDeliveryOrThrow(
  db: Database,
  input: { tenantId: string; userId: string; deliveryId: string },
): Promise<TenantNotificationInboxItem> {
  const delivery = await findTenantNotificationDeliveryById(db, input);
  if (!delivery) {
    throw new TenantNotificationError(
      "NOTIFICATION_NOT_FOUND",
      "Notification delivery was not found.",
      404,
    );
  }
  return delivery;
}

async function writeNotificationAudit(
  db: Database,
  authContext: AuthContext,
  requestMeta: AuthRequestMeta | undefined,
  input: {
    eventType: string;
    entityId: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  },
): Promise<void> {
  await writeAuditLog(db, {
    actorUserId: authContext.userId,
    tenantId: authContext.tenantId,
    branchId: null,
    eventCategory: "tenant_notification",
    eventType: input.eventType,
    entityType: "notification_delivery",
    entityId: input.entityId,
    before: input.before,
    after: input.after,
    ipAddress: requestMeta?.ipAddress,
    userAgent: requestMeta?.userAgent,
  });
}
