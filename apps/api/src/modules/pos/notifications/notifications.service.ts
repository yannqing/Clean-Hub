import { getDb, type Database } from "@cleanhub/db";

import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";
import {
  assertPosContext,
  requireFeatureEnabled,
} from "../../auth/permission.helper.js";
import { writeAuditLog } from "../../audit/audit.helper.js";
import { PosNotificationError } from "./notifications.errors.js";
import {
  archivePosNotificationDeliveryRecord,
  countPosNotificationInbox,
  createPosNotificationDeliveryRecord,
  findPosNotificationDeliveryById,
  findPosNotificationInbox,
  getPosNotificationOverview as getPosNotificationOverviewRecord,
  markAllPosNotificationDeliveriesRead,
  markPosNotificationDeliveryReadRecord,
} from "./notifications.repository.js";
import type {
  ArchivePosNotificationInput,
  MarkAllPosNotificationsReadInput,
  MarkPosNotificationReadInput,
  PosNotificationDeliveryInput,
  PosNotificationInboxItem,
  PosNotificationListQuery,
  PosNotificationListResponse,
  PosNotificationOverview,
} from "./notifications.types.js";

function requirePosTenantId(authContext: AuthContext): string {
  assertPosContext(authContext);
  return authContext.tenantId!;
}

export async function listPosNotifications(
  input: { authContext: AuthContext; query: PosNotificationListQuery },
  db: Database = getDb(),
): Promise<PosNotificationListResponse> {
  const tenantId = requirePosTenantId(input.authContext);
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

  const [data, total] = await Promise.all([
    findPosNotificationInbox(db, listInput),
    countPosNotificationInbox(db, listInput),
  ]);

  return { data, total };
}

export async function getPosNotificationsOverview(
  authContext: AuthContext,
  db: Database = getDb(),
): Promise<PosNotificationOverview> {
  const tenantId = requirePosTenantId(authContext);
  await requireFeatureEnabled(authContext, "notifications", db);

  return getPosNotificationOverviewRecord(db, {
    tenantId,
    userId: authContext.userId,
  });
}

export async function markPosNotificationRead(
  input: MarkPosNotificationReadInput,
  db: Database = getDb(),
): Promise<PosNotificationInboxItem> {
  const tenantId = requirePosTenantId(input.authContext);
  await requireFeatureEnabled(input.authContext, "notifications", db);

  return db.transaction(async (tx) => {
    const before = await loadDeliveryOrThrow(tx, {
      tenantId,
      userId: input.authContext.userId,
      deliveryId: input.deliveryId,
    });

    if (before.readStatus === "archived") {
      throw new PosNotificationError(
        "NOTIFICATION_ARCHIVED",
        "Archived notifications cannot be marked as read.",
        422,
      );
    }

    if (before.readStatus === "unread") {
      await markPosNotificationDeliveryReadRecord(tx, {
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
        eventType: "pos.notification.read",
        entityId: input.deliveryId,
        before: { readStatus: before.readStatus },
        after: { readStatus: after.readStatus },
      });
    }

    return after;
  });
}

export async function archivePosNotification(
  input: ArchivePosNotificationInput,
  db: Database = getDb(),
): Promise<PosNotificationInboxItem> {
  const tenantId = requirePosTenantId(input.authContext);
  await requireFeatureEnabled(input.authContext, "notifications", db);

  return db.transaction(async (tx) => {
    const before = await loadDeliveryOrThrow(tx, {
      tenantId,
      userId: input.authContext.userId,
      deliveryId: input.deliveryId,
    });

    if (before.readStatus !== "archived") {
      await archivePosNotificationDeliveryRecord(tx, {
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
        eventType: "pos.notification.archived",
        entityId: input.deliveryId,
        before: { readStatus: before.readStatus },
        after: { readStatus: after.readStatus },
      });
    }

    return after;
  });
}

export async function markAllPosNotificationsRead(
  input: MarkAllPosNotificationsReadInput,
  db: Database = getDb(),
): Promise<{ updated: number }> {
  const tenantId = requirePosTenantId(input.authContext);
  await requireFeatureEnabled(input.authContext, "notifications", db);

  return db.transaction(async (tx) => {
    const updated = await markAllPosNotificationDeliveriesRead(tx, {
      tenantId,
      userId: input.authContext.userId,
      actorUserId: input.authContext.userId,
    });

    if (updated > 0) {
      await writeNotificationAudit(tx, input.authContext, input.requestMeta, {
        eventType: "pos.notification.read_all",
        entityId: input.authContext.userId,
        after: { updated },
      });
    }

    return { updated };
  });
}

export async function createPosNotificationDelivery(
  input: PosNotificationDeliveryInput,
  db: Database = getDb(),
): Promise<PosNotificationInboxItem> {
  return db.transaction((tx) => createPosNotificationDeliveryRecord(tx, input));
}

async function loadDeliveryOrThrow(
  db: Database,
  input: { tenantId: string; userId: string; deliveryId: string },
): Promise<PosNotificationInboxItem> {
  const delivery = await findPosNotificationDeliveryById(db, input);
  if (!delivery) {
    throw new PosNotificationError(
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
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await writeAuditLog(db, {
    actorUserId: authContext.userId,
    tenantId: authContext.tenantId,
    branchId: null,
    eventCategory: "pos_notification",
    eventType: input.eventType,
    entityType: "notification_delivery",
    entityId: input.entityId,
    before: input.before,
    after: input.after,
    metadata: input.metadata,
    ipAddress: requestMeta?.ipAddress,
    userAgent: requestMeta?.userAgent,
  });
}
