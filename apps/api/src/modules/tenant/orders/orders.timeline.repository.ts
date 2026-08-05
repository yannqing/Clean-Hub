import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";

import {
  auditLogs,
  deliveryTaskEvents,
  deliveryTasks,
  notificationDeliveries,
  notifications,
  mediaObjects,
  orderCommentAttachments,
  orderCommentMentions,
  orderComments,
  type Database,
  userProfiles,
  users,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import type { TenantOrderRepositoryTimelineInput } from "./orders.types.js";
import { TenantOrdersError } from "./orders.errors.js";

function auditCursorCondition(
  before: TenantOrderRepositoryTimelineInput["before"],
) {
  if (!before) {
    return undefined;
  }

  return or(
    lt(auditLogs.createdAt, before.occurredAt),
    and(
      eq(auditLogs.createdAt, before.occurredAt),
      lt(auditLogs.id, before.id),
    ),
  );
}

function commentCursorCondition(
  before: TenantOrderRepositoryTimelineInput["before"],
) {
  if (!before) {
    return undefined;
  }

  return or(
    lt(orderComments.createdAt, before.occurredAt),
    and(
      eq(orderComments.createdAt, before.occurredAt),
      lt(orderComments.id, before.id),
    ),
  );
}

function deliveryCursorCondition(
  before: TenantOrderRepositoryTimelineInput["before"],
) {
  if (!before) {
    return undefined;
  }

  return or(
    lt(deliveryTaskEvents.createdAt, before.occurredAt),
    and(
      eq(deliveryTaskEvents.createdAt, before.occurredAt),
      lt(deliveryTaskEvents.id, before.id),
    ),
  );
}

export async function findTenantOrderTimelineRows(
  db: Database,
  input: TenantOrderRepositoryTimelineInput,
) {
  const rowLimit = input.limit + 1;
  const entityConditions = [
    and(
      eq(auditLogs.entityType, "order"),
      eq(auditLogs.entityId, input.orderId),
    ),
    input.linkedTicketIds.length > 0
      ? and(
          eq(auditLogs.entityType, "service_ticket"),
          inArray(auditLogs.entityId, input.linkedTicketIds),
        )
      : undefined,
    and(
      inArray(auditLogs.eventType, [
        "pos.order.payment_corrected",
        "pos.order.payment_refunded",
      ]),
      sql`${auditLogs.metadata}->>'orderId' = ${input.orderId}`,
    ),
  ];

  const [auditRows, commentRows, deliveryRows, creationRows] =
    await Promise.all([
      db
        .select({
          id: auditLogs.id,
          entityType: auditLogs.entityType,
          eventType: auditLogs.eventType,
          actorUserId: auditLogs.actorUserId,
          actorDisplayName: userProfiles.displayName,
          actorAvatarUrl: userProfiles.avatarUrl,
          reason: auditLogs.reason,
          before: auditLogs.before,
          after: auditLogs.after,
          metadata: auditLogs.metadata,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .leftJoin(userProfiles, eq(userProfiles.userId, auditLogs.actorUserId))
        .where(
          and(
            eq(auditLogs.tenantId, input.tenantId),
            eq(auditLogs.success, true),
            inArray(auditLogs.eventCategory, [
              "pos_order",
              "pos_service_ticket",
            ]),
            or(...entityConditions),
            auditCursorCondition(input.before),
          ),
        )
        .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
        .limit(rowLimit),
      db
        .select({
          id: orderComments.id,
          authorUserId: orderComments.authorUserId,
          actorDisplayName: userProfiles.displayName,
          actorAvatarUrl: userProfiles.avatarUrl,
          body: orderComments.body,
          editedAt: orderComments.editedAt,
          version: orderComments.version,
          createdAt: orderComments.createdAt,
        })
        .from(orderComments)
        .leftJoin(
          userProfiles,
          eq(userProfiles.userId, orderComments.authorUserId),
        )
        .where(
          and(
            eq(orderComments.tenantId, input.tenantId),
            eq(orderComments.orderId, input.orderId),
            isNull(orderComments.deletedAt),
            commentCursorCondition(input.before),
          ),
        )
        .orderBy(desc(orderComments.createdAt), desc(orderComments.id))
        .limit(rowLimit),
      db
        .select({
          id: deliveryTaskEvents.id,
          taskId: deliveryTaskEvents.taskId,
          fromStatus: deliveryTaskEvents.fromStatus,
          toStatus: deliveryTaskEvents.toStatus,
          note: deliveryTaskEvents.note,
          actorUserId: deliveryTaskEvents.createdBy,
          actorDisplayName: userProfiles.displayName,
          actorAvatarUrl: userProfiles.avatarUrl,
          createdAt: deliveryTaskEvents.createdAt,
        })
        .from(deliveryTaskEvents)
        .innerJoin(
          deliveryTasks,
          eq(deliveryTasks.id, deliveryTaskEvents.taskId),
        )
        .leftJoin(
          userProfiles,
          eq(userProfiles.userId, deliveryTaskEvents.createdBy),
        )
        .where(
          and(
            eq(deliveryTaskEvents.tenantId, input.tenantId),
            eq(deliveryTasks.orderId, input.orderId),
            deliveryCursorCondition(input.before),
          ),
        )
        .orderBy(
          desc(deliveryTaskEvents.createdAt),
          desc(deliveryTaskEvents.id),
        )
        .limit(rowLimit),
      db
        .select({ id: auditLogs.id })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.tenantId, input.tenantId),
            eq(auditLogs.entityType, "order"),
            eq(auditLogs.entityId, input.orderId),
            eq(auditLogs.eventType, "pos.order.created"),
            eq(auditLogs.success, true),
          ),
        )
        .limit(1),
    ]);

  const commentIds = commentRows.map((row) => row.id);
  const [mentionRows, attachmentRows] = await Promise.all([
    commentIds.length > 0
      ? await db
          .select({
            commentId: orderCommentMentions.commentId,
            userId: orderCommentMentions.mentionedUserId,
            displayName: userProfiles.displayName,
            avatarUrl: userProfiles.avatarUrl,
          })
          .from(orderCommentMentions)
          .innerJoin(
            userProfiles,
            eq(userProfiles.userId, orderCommentMentions.mentionedUserId),
          )
          .where(
            and(
              eq(orderCommentMentions.tenantId, input.tenantId),
              inArray(orderCommentMentions.commentId, commentIds),
            ),
          )
      : [],
    commentIds.length > 0
      ? db
          .select({
            id: orderCommentAttachments.id,
            commentId: orderCommentAttachments.commentId,
            fileName: orderCommentAttachments.fileName,
            objectKey: mediaObjects.objectKey,
            contentType: mediaObjects.contentType,
            sizeBytes: mediaObjects.sizeBytes,
          })
          .from(orderCommentAttachments)
          .innerJoin(
            mediaObjects,
            eq(mediaObjects.id, orderCommentAttachments.mediaObjectId),
          )
          .where(
            and(
              eq(orderCommentAttachments.tenantId, input.tenantId),
              inArray(orderCommentAttachments.commentId, commentIds),
              eq(mediaObjects.status, "committed"),
              isNull(mediaObjects.deletedAt),
            ),
          )
          .orderBy(asc(orderCommentAttachments.sortOrder))
      : [],
  ]);
  const mentionsByCommentId = new Map<
    string,
    Array<{ userId: string; displayName: string; avatarUrl: string | null }>
  >();
  for (const mention of mentionRows) {
    const current = mentionsByCommentId.get(mention.commentId) ?? [];
    current.push({
      userId: mention.userId,
      displayName: mention.displayName,
      avatarUrl: mention.avatarUrl,
    });
    mentionsByCommentId.set(mention.commentId, current);
  }
  const attachmentsByCommentId = new Map<
    string,
    Array<{
      id: string;
      fileName: string;
      objectKey: string;
      contentType: string;
      sizeBytes: number;
    }>
  >();
  for (const attachment of attachmentRows) {
    const current = attachmentsByCommentId.get(attachment.commentId) ?? [];
    current.push({
      id: attachment.id,
      fileName: attachment.fileName,
      objectKey: attachment.objectKey,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
    });
    attachmentsByCommentId.set(attachment.commentId, current);
  }

  return {
    auditRows,
    commentRows: commentRows.map((row) => ({
      ...row,
      mentions: mentionsByCommentId.get(row.id) ?? [],
      attachments: attachmentsByCommentId.get(row.id) ?? [],
    })),
    deliveryRows,
    hasCreationAudit: creationRows.length > 0,
  };
}

export async function bindTenantOrderCommentAttachments(
  db: Database,
  input: {
    tenantId: string;
    commentId: string;
    actorUserId: string;
    attachments: Array<{ objectKey: string; fileName: string }>;
  },
) {
  if (input.attachments.length === 0) {
    return [];
  }

  const objectKeys = input.attachments.map((attachment) => attachment.objectKey);
  if (new Set(objectKeys).size !== objectKeys.length) {
    throw new TenantOrdersError(
      "COMMENT_ATTACHMENT_INVALID",
      "The same attachment cannot be added more than once.",
      422,
    );
  }
  const rows = await db
    .select({
      id: mediaObjects.id,
      objectKey: mediaObjects.objectKey,
      contentType: mediaObjects.contentType,
      sizeBytes: mediaObjects.sizeBytes,
      status: mediaObjects.status,
      purpose: mediaObjects.purpose,
      createdBy: mediaObjects.createdBy,
      expiresAt: mediaObjects.expiresAt,
    })
    .from(mediaObjects)
    .where(
      and(
        eq(mediaObjects.tenantId, input.tenantId),
        inArray(mediaObjects.objectKey, objectKeys),
        isNull(mediaObjects.deletedAt),
      ),
    )
    .orderBy(asc(mediaObjects.objectKey))
    .for("update");
  const rowsByKey = new Map(rows.map((row) => [row.objectKey, row]));

  for (const objectKey of objectKeys) {
    const row = rowsByKey.get(objectKey);
    if (!row) {
      throw new TenantOrdersError(
        "COMMENT_ATTACHMENT_NOT_FOUND",
        "One or more comment attachments were not found.",
        404,
      );
    }
    if (row.createdBy !== input.actorUserId) {
      throw new TenantOrdersError(
        "COMMENT_ATTACHMENT_INVALID",
        "One or more comment attachments are not accessible.",
        403,
      );
    }
    if (
      row.purpose !== "order_comment_attachment" ||
      row.status !== "pending" ||
      row.expiresAt.getTime() < Date.now()
    ) {
      throw new TenantOrdersError(
        "COMMENT_ATTACHMENT_INVALID",
        "One or more comment attachments are invalid or expired.",
        422,
      );
    }
  }

  const attachmentRecords = input.attachments.map((attachment, index) => {
    const media = rowsByKey.get(attachment.objectKey)!;
    return {
      id: createId(),
      tenantId: input.tenantId,
      commentId: input.commentId,
      mediaObjectId: media.id,
      fileName: attachment.fileName,
      sortOrder: index,
      objectKey: media.objectKey,
      contentType: media.contentType,
      sizeBytes: media.sizeBytes,
    };
  });

  await db.insert(orderCommentAttachments).values(
    attachmentRecords.map((record) => ({
      id: record.id,
      tenantId: record.tenantId,
      commentId: record.commentId,
      mediaObjectId: record.mediaObjectId,
      fileName: record.fileName,
      sortOrder: record.sortOrder,
    })),
  );
  const committed = await db
    .update(mediaObjects)
    .set({
      status: "committed",
      committedAt: new Date(),
      cleanupClaimToken: null,
      cleanupClaimedAt: null,
    })
    .where(
      and(
        eq(mediaObjects.tenantId, input.tenantId),
        inArray(
          mediaObjects.id,
          attachmentRecords.map((attachment) => attachment.mediaObjectId),
        ),
        eq(mediaObjects.status, "pending"),
        isNull(mediaObjects.deletedAt),
      ),
    )
    .returning({ id: mediaObjects.id });
  if (committed.length !== attachmentRecords.length) {
    throw new TenantOrdersError(
      "COMMENT_ATTACHMENT_CONFLICT",
      "One or more comment attachments have already been used.",
      409,
    );
  }

  return attachmentRecords.map((record) => ({
    id: record.id,
    fileName: record.fileName,
    objectKey: record.objectKey,
    contentType: record.contentType,
    sizeBytes: record.sizeBytes,
  }));
}

export async function findTenantOrderCommentAttachments(
  db: Database,
  input: { tenantId: string; commentId: string },
) {
  return db
    .select({
      id: orderCommentAttachments.id,
      fileName: orderCommentAttachments.fileName,
      objectKey: mediaObjects.objectKey,
      contentType: mediaObjects.contentType,
      sizeBytes: mediaObjects.sizeBytes,
    })
    .from(orderCommentAttachments)
    .innerJoin(
      mediaObjects,
      eq(mediaObjects.id, orderCommentAttachments.mediaObjectId),
    )
    .where(
      and(
        eq(orderCommentAttachments.tenantId, input.tenantId),
        eq(orderCommentAttachments.commentId, input.commentId),
        eq(mediaObjects.status, "committed"),
        isNull(mediaObjects.deletedAt),
      ),
    )
    .orderBy(asc(orderCommentAttachments.sortOrder));
}

export async function findActiveTenantMentionUsers(
  db: Database,
  input: { tenantId: string; userIds: string[] },
) {
  if (input.userIds.length === 0) {
    return [];
  }

  return db
    .select({
      userId: users.id,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
      language: userProfiles.language,
    })
    .from(users)
    .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(
      and(
        eq(users.tenantId, input.tenantId),
        eq(users.status, "active"),
        isNull(users.deletedAt),
        inArray(users.id, input.userIds),
      ),
    );
}

export async function listTenantOrderCommentMentionIds(
  db: Database,
  input: { tenantId: string; commentId: string },
): Promise<string[]> {
  const rows = await db
    .select({ userId: orderCommentMentions.mentionedUserId })
    .from(orderCommentMentions)
    .where(
      and(
        eq(orderCommentMentions.tenantId, input.tenantId),
        eq(orderCommentMentions.commentId, input.commentId),
      ),
    );
  return rows.map((row) => row.userId);
}

export async function replaceTenantOrderCommentMentions(
  db: Database,
  input: { tenantId: string; commentId: string; userIds: string[] },
): Promise<void> {
  await db
    .delete(orderCommentMentions)
    .where(
      and(
        eq(orderCommentMentions.tenantId, input.tenantId),
        eq(orderCommentMentions.commentId, input.commentId),
      ),
    );

  if (input.userIds.length > 0) {
    await db.insert(orderCommentMentions).values(
      input.userIds.map((userId) => ({
        id: createId(),
        tenantId: input.tenantId,
        commentId: input.commentId,
        mentionedUserId: userId,
      })),
    );
  }
}

export async function findTenantOrderCommentForMutation(
  db: Database,
  input: { tenantId: string; orderId: string; commentId: string },
) {
  const rows = await db
    .select()
    .from(orderComments)
    .where(
      and(
        eq(orderComments.id, input.commentId),
        eq(orderComments.tenantId, input.tenantId),
        eq(orderComments.orderId, input.orderId),
        isNull(orderComments.deletedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function updateTenantOrderCommentRecord(
  db: Database,
  input: {
    tenantId: string;
    orderId: string;
    commentId: string;
    body: string;
    version: number;
  },
) {
  const now = new Date();
  const rows = await db
    .update(orderComments)
    .set({
      body: input.body,
      editedAt: now,
      updatedAt: now,
      version: sql`${orderComments.version} + 1`,
    })
    .where(
      and(
        eq(orderComments.id, input.commentId),
        eq(orderComments.tenantId, input.tenantId),
        eq(orderComments.orderId, input.orderId),
        eq(orderComments.version, input.version),
        isNull(orderComments.deletedAt),
      ),
    )
    .returning();
  return rows[0] ?? null;
}

export async function softDeleteTenantOrderCommentRecord(
  db: Database,
  input: {
    tenantId: string;
    orderId: string;
    commentId: string;
    actorUserId: string;
    version: number;
  },
) {
  const now = new Date();
  const rows = await db
    .update(orderComments)
    .set({
      deletedAt: now,
      deletedBy: input.actorUserId,
      updatedAt: now,
      version: sql`${orderComments.version} + 1`,
    })
    .where(
      and(
        eq(orderComments.id, input.commentId),
        eq(orderComments.tenantId, input.tenantId),
        eq(orderComments.orderId, input.orderId),
        eq(orderComments.version, input.version),
        isNull(orderComments.deletedAt),
      ),
    )
    .returning({ id: orderComments.id });
  return rows[0] ?? null;
}

export async function createTenantOrderMentionNotification(
  db: Database,
  input: {
    tenantId: string;
    orderId: string;
    commentId: string;
    commentVersion: number;
    recipientUserId: string;
    senderUserId: string;
    locale: string;
    title: string;
    content: string;
  },
): Promise<void> {
  const idempotencyKey = `order-comment-mention:${input.commentId}:${input.commentVersion}:${input.recipientUserId}`;
  const notificationId = createId();
  const inserted = await db
    .insert(notifications)
    .values({
      id: notificationId,
      tenantId: input.tenantId,
      scope: "tenant",
      noticeType: "business",
      relatedType: "order",
      relatedId: input.orderId,
      title: input.title,
      content: input.content,
      locale: input.locale,
      payload: {
        orderId: input.orderId,
        commentId: input.commentId,
        href: `/tenant/orders/${input.orderId}`,
      },
      priority: "normal",
      idempotencyKey,
      createdBy: input.senderUserId,
      updatedBy: input.senderUserId,
    })
    .onConflictDoNothing({
      target: [notifications.tenantId, notifications.idempotencyKey],
    })
    .returning({ id: notifications.id });

  if (!inserted[0]) {
    return;
  }

  await db.insert(notificationDeliveries).values({
    id: createId(),
    tenantId: input.tenantId,
    notificationId,
    channel: "app",
    recipientType: "user",
    recipientId: input.recipientUserId,
    senderType: "user",
    senderId: input.senderUserId,
    status: "sent",
    readStatus: "unread",
    priority: "normal",
    sentAt: new Date(),
    attemptCount: 1,
    createdBy: input.senderUserId,
    updatedBy: input.senderUserId,
  });
}

export async function createTenantOrderCommentRecord(
  db: Database,
  input: {
    id: string;
    tenantId: string;
    branchId: string;
    orderId: string;
    authorUserId: string;
    body: string;
    idempotencyKey: string;
  },
) {
  const inserted = await db
    .insert(orderComments)
    .values(input)
    .onConflictDoNothing({
      target: [
        orderComments.tenantId,
        orderComments.orderId,
        orderComments.idempotencyKey,
      ],
    })
    .returning();

  if (inserted[0]) {
    return { comment: inserted[0], created: true };
  }

  const existing = await db
    .select()
    .from(orderComments)
    .where(
      and(
        eq(orderComments.tenantId, input.tenantId),
        eq(orderComments.orderId, input.orderId),
        eq(orderComments.idempotencyKey, input.idempotencyKey),
        isNull(orderComments.deletedAt),
      ),
    )
    .limit(1);

  return existing[0]
    ? { comment: existing[0], created: false }
    : { comment: null, created: false };
}
