import {
  and,
  desc,
  eq,
  inArray,
  isNull,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  notificationDeliveries,
  notifications,
  type Database,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import type {
  PosNotificationDeliveryInput,
  PosNotificationInboxItem,
  PosNotificationListInput,
  PosNotificationOverview,
} from "./notifications.types.js";

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

type NotificationInboxRow = typeof notificationDeliveries.$inferSelect & {
  noticeType: typeof notifications.$inferSelect.noticeType;
  title: string;
  content: string;
  relatedType: string | null;
  relatedId: string | null;
};

function toInboxItem(row: NotificationInboxRow): PosNotificationInboxItem {
  const relatedType =
    row.relatedType === "order" || row.relatedType === "ticket"
      ? row.relatedType
      : null;

  return {
    id: row.id,
    notificationId: row.notificationId,
    tenantId: row.tenantId,
    noticeType: row.noticeType,
    readStatus: row.readStatus,
    priority: row.priority,
    title: row.title,
    content: row.content,
    relatedType,
    relatedId: row.relatedId,
    senderType: row.senderType,
    senderId: row.senderId,
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

function buildInboxFilters(input: PosNotificationListInput): SQL[] {
  const filters: SQL[] = [
    eq(notificationDeliveries.tenantId, input.tenantId),
    eq(notificationDeliveries.channel, "pos"),
    eq(notificationDeliveries.status, "sent"),
    eq(notificationDeliveries.recipientType, "user"),
    eq(notificationDeliveries.recipientId, input.userId),
    isNull(notificationDeliveries.deletedAt),
    isNull(notifications.deletedAt),
    eq(notifications.scope, "pos"),
  ];

  const { query } = input;
  if (query.readStatus) {
    filters.push(eq(notificationDeliveries.readStatus, query.readStatus));
  } else {
    filters.push(ne(notificationDeliveries.readStatus, "archived"));
  }
  if (query.noticeType) {
    filters.push(eq(notifications.noticeType, query.noticeType));
  }
  if (query.priority) {
    filters.push(eq(notificationDeliveries.priority, query.priority));
  }
  if (query.relatedType) {
    filters.push(eq(notifications.relatedType, query.relatedType));
  }
  if (query.q) {
    const pattern = `%${escapeLikePattern(query.q)}%`;
    filters.push(
      or(
        sql`${notifications.title} ilike ${pattern} escape '\\'`,
        sql`${notifications.content} ilike ${pattern} escape '\\'`,
        sql`${notifications.relatedId}::text ilike ${pattern} escape '\\'`,
      )!,
    );
  }

  return filters;
}

function selectInboxFields() {
  return {
    delivery: notificationDeliveries,
    noticeType: notifications.noticeType,
    title: notifications.title,
    content: notifications.content,
    relatedType: notifications.relatedType,
    relatedId: notifications.relatedId,
  };
}

export async function findPosNotificationInbox(
  db: Database,
  input: PosNotificationListInput,
): Promise<PosNotificationInboxItem[]> {
  const rows = await db
    .select(selectInboxFields())
    .from(notificationDeliveries)
    .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
    .where(and(...buildInboxFilters(input)))
    .orderBy(desc(notificationDeliveries.createdAt))
    .limit(input.query.limit ?? 50)
    .offset(input.query.offset ?? 0);

  return rows.map((row) =>
    toInboxItem({
      ...row.delivery,
      noticeType: row.noticeType,
      title: row.title,
      content: row.content,
      relatedType: row.relatedType,
      relatedId: row.relatedId,
    }),
  );
}

export async function countPosNotificationInbox(
  db: Database,
  input: PosNotificationListInput,
): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notificationDeliveries)
    .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
    .where(and(...buildInboxFilters(input)));

  return rows[0]?.count ?? 0;
}

export async function getPosNotificationOverview(
  db: Database,
  input: { tenantId: string; userId: string },
): Promise<PosNotificationOverview> {
  const filters = [
    eq(notificationDeliveries.tenantId, input.tenantId),
    eq(notificationDeliveries.channel, "pos"),
    eq(notificationDeliveries.status, "sent"),
    eq(notificationDeliveries.recipientType, "user"),
    eq(notificationDeliveries.recipientId, input.userId),
    ne(notificationDeliveries.readStatus, "archived"),
    isNull(notificationDeliveries.deletedAt),
    isNull(notifications.deletedAt),
    eq(notifications.scope, "pos"),
  ];

  const rows = await db
    .select({
      unreadCount: sql<number>`count(*) filter (where ${notificationDeliveries.readStatus} = 'unread')::int`,
      urgentUnreadCount: sql<number>`count(*) filter (where ${notificationDeliveries.readStatus} = 'unread' and ${notificationDeliveries.priority} in ('high', 'critical'))::int`,
      businessCount: sql<number>`count(*) filter (where ${notifications.noticeType} = 'business')::int`,
      systemCount: sql<number>`count(*) filter (where ${notifications.noticeType} = 'system')::int`,
    })
    .from(notificationDeliveries)
    .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
    .where(and(...filters));

  return {
    unreadCount: rows[0]?.unreadCount ?? 0,
    urgentUnreadCount: rows[0]?.urgentUnreadCount ?? 0,
    businessCount: rows[0]?.businessCount ?? 0,
    systemCount: rows[0]?.systemCount ?? 0,
  };
}

export async function findPosNotificationDeliveryById(
  db: Database,
  input: { tenantId: string; userId: string; deliveryId: string },
): Promise<PosNotificationInboxItem | null> {
  const rows = await db
    .select(selectInboxFields())
    .from(notificationDeliveries)
    .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
    .where(
      and(
        eq(notificationDeliveries.id, input.deliveryId),
        eq(notificationDeliveries.tenantId, input.tenantId),
        eq(notificationDeliveries.channel, "pos"),
        eq(notificationDeliveries.status, "sent"),
        eq(notificationDeliveries.recipientType, "user"),
        eq(notificationDeliveries.recipientId, input.userId),
        isNull(notificationDeliveries.deletedAt),
        isNull(notifications.deletedAt),
        eq(notifications.scope, "pos"),
      ),
    )
    .limit(1);

  const row = rows[0];
  return row
    ? toInboxItem({
        ...row.delivery,
        noticeType: row.noticeType,
        title: row.title,
        content: row.content,
        relatedType: row.relatedType,
        relatedId: row.relatedId,
      })
    : null;
}

export async function markPosNotificationDeliveryReadRecord(
  db: Database,
  input: { tenantId: string; userId: string; deliveryId: string; actorUserId: string },
): Promise<void> {
  await db
    .update(notificationDeliveries)
    .set({
      readStatus: "read",
      readAt: new Date(),
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${notificationDeliveries.version} + 1`,
    })
    .where(
      and(
        eq(notificationDeliveries.id, input.deliveryId),
        eq(notificationDeliveries.tenantId, input.tenantId),
        eq(notificationDeliveries.channel, "pos"),
        eq(notificationDeliveries.status, "sent"),
        eq(notificationDeliveries.recipientType, "user"),
        eq(notificationDeliveries.recipientId, input.userId),
        eq(notificationDeliveries.readStatus, "unread"),
        isNull(notificationDeliveries.deletedAt),
      ),
    );
}

export async function archivePosNotificationDeliveryRecord(
  db: Database,
  input: { tenantId: string; userId: string; deliveryId: string; actorUserId: string },
): Promise<void> {
  await db
    .update(notificationDeliveries)
    .set({
      readStatus: "archived",
      readAt: sql`coalesce(${notificationDeliveries.readAt}, now())`,
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${notificationDeliveries.version} + 1`,
    })
    .where(
      and(
        eq(notificationDeliveries.id, input.deliveryId),
        eq(notificationDeliveries.tenantId, input.tenantId),
        eq(notificationDeliveries.channel, "pos"),
        eq(notificationDeliveries.status, "sent"),
        eq(notificationDeliveries.recipientType, "user"),
        eq(notificationDeliveries.recipientId, input.userId),
        inArray(notificationDeliveries.readStatus, ["unread", "read"]),
        isNull(notificationDeliveries.deletedAt),
      ),
    );
}

export async function markAllPosNotificationDeliveriesRead(
  db: Database,
  input: { tenantId: string; userId: string; actorUserId: string },
): Promise<number> {
  const rows = await db
    .update(notificationDeliveries)
    .set({
      readStatus: "read",
      readAt: new Date(),
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${notificationDeliveries.version} + 1`,
    })
    .where(
      and(
        eq(notificationDeliveries.tenantId, input.tenantId),
        eq(notificationDeliveries.channel, "pos"),
        eq(notificationDeliveries.status, "sent"),
        eq(notificationDeliveries.recipientType, "user"),
        eq(notificationDeliveries.recipientId, input.userId),
        eq(notificationDeliveries.readStatus, "unread"),
        isNull(notificationDeliveries.deletedAt),
      ),
    )
    .returning({ id: notificationDeliveries.id });

  return rows.length;
}

export async function createPosNotificationDeliveryRecord(
  db: Database,
  input: PosNotificationDeliveryInput,
): Promise<PosNotificationInboxItem> {
  let notificationId: string | null = null;

  if (input.idempotencyKey) {
    const existing = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.tenantId, input.tenantId),
          eq(notifications.idempotencyKey, input.idempotencyKey),
          isNull(notifications.deletedAt),
        ),
      )
      .limit(1);
    notificationId = existing[0]?.id ?? null;
  }

  if (!notificationId) {
    notificationId = createId();
    await db.insert(notifications).values({
      id: notificationId,
      tenantId: input.tenantId,
      scope: "pos",
      noticeType: input.noticeType,
      relatedType: input.relatedType,
      relatedId: input.relatedId ?? null,
      title: input.title.trim(),
      content: input.content.trim(),
      locale: input.locale ?? "zh-CN",
      payload: input.payload,
      priority: input.priority ?? "normal",
      idempotencyKey: input.idempotencyKey,
      createdBy: input.actorUserId ?? null,
      updatedBy: input.actorUserId ?? null,
    });
  }

  const existingDelivery = await db
    .select({ id: notificationDeliveries.id })
    .from(notificationDeliveries)
    .where(
      and(
        eq(notificationDeliveries.notificationId, notificationId),
        eq(notificationDeliveries.tenantId, input.tenantId),
        eq(notificationDeliveries.channel, "pos"),
        eq(notificationDeliveries.recipientType, "user"),
        eq(notificationDeliveries.recipientId, input.recipientUserId),
        isNull(notificationDeliveries.deletedAt),
      ),
    )
    .limit(1);

  if (!existingDelivery[0]) {
    await db.insert(notificationDeliveries).values({
      id: createId(),
      tenantId: input.tenantId,
      notificationId,
      channel: "pos",
      recipientType: "user",
      recipientId: input.recipientUserId,
      senderType: input.senderType ?? "system",
      senderId: input.senderId ?? null,
      status: "sent",
      readStatus: "unread",
      priority: input.priority ?? "normal",
      sentAt: new Date(),
      attemptCount: 1,
      createdBy: input.actorUserId ?? null,
      updatedBy: input.actorUserId ?? null,
    });
  }

  const deliveryId = existingDelivery[0]?.id;
  const rows = await db
    .select(selectInboxFields())
    .from(notificationDeliveries)
    .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
    .where(
      deliveryId
        ? eq(notificationDeliveries.id, deliveryId)
        : and(
            eq(notificationDeliveries.notificationId, notificationId),
            eq(notificationDeliveries.tenantId, input.tenantId),
            eq(notificationDeliveries.recipientId, input.recipientUserId),
            eq(notificationDeliveries.channel, "pos"),
            eq(notificationDeliveries.recipientType, "user"),
          ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new Error("Created notification delivery could not be loaded.");
  }

  return toInboxItem({
    ...row.delivery,
    noticeType: row.noticeType,
    title: row.title,
    content: row.content,
    relatedType: row.relatedType,
    relatedId: row.relatedId,
  });
}
