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

import type {
  TenantNotificationInboxItem,
  TenantNotificationListInput,
  TenantNotificationOverview,
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

function toInboxItem(row: NotificationInboxRow): TenantNotificationInboxItem {
  return {
    id: row.id,
    notificationId: row.notificationId,
    tenantId: row.tenantId,
    noticeType: row.noticeType,
    readStatus: row.readStatus,
    priority: row.priority,
    title: row.title,
    content: row.content,
    relatedType: row.relatedType,
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

function buildInboxFilters(input: TenantNotificationListInput): SQL[] {
  const filters: SQL[] = [
    eq(notificationDeliveries.tenantId, input.tenantId),
    eq(notificationDeliveries.channel, "app"),
    eq(notificationDeliveries.status, "sent"),
    eq(notificationDeliveries.recipientType, "user"),
    eq(notificationDeliveries.recipientId, input.userId),
    isNull(notificationDeliveries.deletedAt),
    isNull(notifications.deletedAt),
    eq(notifications.scope, "tenant"),
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

export async function findTenantNotificationInbox(
  db: Database,
  input: TenantNotificationListInput,
): Promise<TenantNotificationInboxItem[]> {
  const rows = await db
    .select(selectInboxFields())
    .from(notificationDeliveries)
    .innerJoin(
      notifications,
      eq(notifications.id, notificationDeliveries.notificationId),
    )
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

export async function countTenantNotificationInbox(
  db: Database,
  input: TenantNotificationListInput,
): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notificationDeliveries)
    .innerJoin(
      notifications,
      eq(notifications.id, notificationDeliveries.notificationId),
    )
    .where(and(...buildInboxFilters(input)));

  return rows[0]?.count ?? 0;
}

export async function getTenantNotificationOverview(
  db: Database,
  input: { tenantId: string; userId: string },
): Promise<TenantNotificationOverview> {
  const filters = [
    eq(notificationDeliveries.tenantId, input.tenantId),
    eq(notificationDeliveries.channel, "app"),
    eq(notificationDeliveries.status, "sent"),
    eq(notificationDeliveries.recipientType, "user"),
    eq(notificationDeliveries.recipientId, input.userId),
    ne(notificationDeliveries.readStatus, "archived"),
    isNull(notificationDeliveries.deletedAt),
    isNull(notifications.deletedAt),
    eq(notifications.scope, "tenant"),
  ];

  const rows = await db
    .select({
      unreadCount: sql<number>`count(*) filter (where ${notificationDeliveries.readStatus} = 'unread')::int`,
      urgentUnreadCount: sql<number>`count(*) filter (where ${notificationDeliveries.readStatus} = 'unread' and ${notificationDeliveries.priority} in ('high', 'critical'))::int`,
      businessCount: sql<number>`count(*) filter (where ${notifications.noticeType} = 'business')::int`,
      systemCount: sql<number>`count(*) filter (where ${notifications.noticeType} = 'system')::int`,
    })
    .from(notificationDeliveries)
    .innerJoin(
      notifications,
      eq(notifications.id, notificationDeliveries.notificationId),
    )
    .where(and(...filters));

  return {
    unreadCount: rows[0]?.unreadCount ?? 0,
    urgentUnreadCount: rows[0]?.urgentUnreadCount ?? 0,
    businessCount: rows[0]?.businessCount ?? 0,
    systemCount: rows[0]?.systemCount ?? 0,
  };
}

export async function findTenantNotificationDeliveryById(
  db: Database,
  input: { tenantId: string; userId: string; deliveryId: string },
): Promise<TenantNotificationInboxItem | null> {
  const rows = await db
    .select(selectInboxFields())
    .from(notificationDeliveries)
    .innerJoin(
      notifications,
      eq(notifications.id, notificationDeliveries.notificationId),
    )
    .where(
      and(
        eq(notificationDeliveries.id, input.deliveryId),
        eq(notificationDeliveries.tenantId, input.tenantId),
        eq(notificationDeliveries.channel, "app"),
        eq(notificationDeliveries.status, "sent"),
        eq(notificationDeliveries.recipientType, "user"),
        eq(notificationDeliveries.recipientId, input.userId),
        isNull(notificationDeliveries.deletedAt),
        isNull(notifications.deletedAt),
        eq(notifications.scope, "tenant"),
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

export async function markTenantNotificationDeliveryReadRecord(
  db: Database,
  input: {
    tenantId: string;
    userId: string;
    deliveryId: string;
    actorUserId: string;
  },
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
        eq(notificationDeliveries.channel, "app"),
        eq(notificationDeliveries.status, "sent"),
        eq(notificationDeliveries.recipientType, "user"),
        eq(notificationDeliveries.recipientId, input.userId),
        eq(notificationDeliveries.readStatus, "unread"),
        inArray(
          notificationDeliveries.notificationId,
          db
            .select({ id: notifications.id })
            .from(notifications)
            .where(
              and(
                eq(notifications.tenantId, input.tenantId),
                eq(notifications.scope, "tenant"),
                isNull(notifications.deletedAt),
              ),
            ),
        ),
        isNull(notificationDeliveries.deletedAt),
      ),
    );
}

export async function archiveTenantNotificationDeliveryRecord(
  db: Database,
  input: {
    tenantId: string;
    userId: string;
    deliveryId: string;
    actorUserId: string;
  },
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
        eq(notificationDeliveries.channel, "app"),
        eq(notificationDeliveries.status, "sent"),
        eq(notificationDeliveries.recipientType, "user"),
        eq(notificationDeliveries.recipientId, input.userId),
        inArray(notificationDeliveries.readStatus, ["unread", "read"]),
        inArray(
          notificationDeliveries.notificationId,
          db
            .select({ id: notifications.id })
            .from(notifications)
            .where(
              and(
                eq(notifications.tenantId, input.tenantId),
                eq(notifications.scope, "tenant"),
                isNull(notifications.deletedAt),
              ),
            ),
        ),
        isNull(notificationDeliveries.deletedAt),
      ),
    );
}

export async function markAllTenantNotificationDeliveriesRead(
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
        eq(notificationDeliveries.channel, "app"),
        eq(notificationDeliveries.status, "sent"),
        eq(notificationDeliveries.recipientType, "user"),
        eq(notificationDeliveries.recipientId, input.userId),
        eq(notificationDeliveries.readStatus, "unread"),
        inArray(
          notificationDeliveries.notificationId,
          db
            .select({ id: notifications.id })
            .from(notifications)
            .where(
              and(
                eq(notifications.tenantId, input.tenantId),
                eq(notifications.scope, "tenant"),
                isNull(notifications.deletedAt),
              ),
            ),
        ),
        isNull(notificationDeliveries.deletedAt),
      ),
    )
    .returning({ id: notificationDeliveries.id });

  return rows.length;
}
