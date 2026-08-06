import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";

import {
  auditLogs,
  customerCommentAttachments,
  customerCommentMentions,
  customerComments,
  mediaObjects,
  notificationDeliveries,
  notifications,
  type Database,
  userProfiles,
  users,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import { TenantCustomersError } from "./customers.errors.js";

type TimelineCursor = { occurredAt: Date; id: string };

function cursorCondition(
  timestamp: typeof auditLogs.createdAt | typeof customerComments.createdAt,
  id: typeof auditLogs.id | typeof customerComments.id,
  before: TimelineCursor | undefined,
) {
  if (!before) return undefined;
  return or(
    lt(timestamp, before.occurredAt),
    and(eq(timestamp, before.occurredAt), lt(id, before.id)),
  );
}

export async function findTenantCustomerTimelineRows(
  db: Database,
  input: {
    tenantId: string;
    customerId: string;
    customerAccountId: string;
    before?: TimelineCursor;
    limit: number;
  },
) {
  const rowLimit = input.limit + 1;
  const [auditRows, commentRows, creationRows] = await Promise.all([
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
          eq(auditLogs.eventCategory, "pos_customer"),
          or(
            and(
              eq(auditLogs.entityType, "customer"),
              eq(auditLogs.entityId, input.customerId),
            ),
            and(
              eq(auditLogs.entityType, "customer_account"),
              eq(auditLogs.entityId, input.customerAccountId),
            ),
          ),
          cursorCondition(auditLogs.createdAt, auditLogs.id, input.before),
        ),
      )
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(rowLimit),
    db
      .select({
        id: customerComments.id,
        authorUserId: customerComments.authorUserId,
        actorDisplayName: userProfiles.displayName,
        actorAvatarUrl: userProfiles.avatarUrl,
        body: customerComments.body,
        editedAt: customerComments.editedAt,
        version: customerComments.version,
        createdAt: customerComments.createdAt,
      })
      .from(customerComments)
      .leftJoin(
        userProfiles,
        eq(userProfiles.userId, customerComments.authorUserId),
      )
      .where(
        and(
          eq(customerComments.tenantId, input.tenantId),
          eq(customerComments.customerId, input.customerId),
          isNull(customerComments.deletedAt),
          cursorCondition(
            customerComments.createdAt,
            customerComments.id,
            input.before,
          ),
        ),
      )
      .orderBy(desc(customerComments.createdAt), desc(customerComments.id))
      .limit(rowLimit),
    db
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.tenantId, input.tenantId),
          eq(auditLogs.entityType, "customer"),
          eq(auditLogs.entityId, input.customerId),
          eq(auditLogs.eventType, "pos_customer.profile_created"),
          eq(auditLogs.success, true),
        ),
      )
      .limit(1),
  ]);

  const commentIds = commentRows.map((row) => row.id);
  const [mentionRows, attachmentRows] = await Promise.all([
    commentIds.length === 0
      ? []
      : db
          .select({
            commentId: customerCommentMentions.commentId,
            userId: customerCommentMentions.mentionedUserId,
            displayName: userProfiles.displayName,
            avatarUrl: userProfiles.avatarUrl,
          })
          .from(customerCommentMentions)
          .innerJoin(
            userProfiles,
            eq(userProfiles.userId, customerCommentMentions.mentionedUserId),
          )
          .where(
            and(
              eq(customerCommentMentions.tenantId, input.tenantId),
              inArray(customerCommentMentions.commentId, commentIds),
            ),
          ),
    commentIds.length === 0
      ? []
      : db
          .select({
            id: customerCommentAttachments.id,
            commentId: customerCommentAttachments.commentId,
            fileName: customerCommentAttachments.fileName,
            objectKey: mediaObjects.objectKey,
            contentType: mediaObjects.contentType,
            sizeBytes: mediaObjects.sizeBytes,
          })
          .from(customerCommentAttachments)
          .innerJoin(
            mediaObjects,
            eq(mediaObjects.id, customerCommentAttachments.mediaObjectId),
          )
          .where(
            and(
              eq(customerCommentAttachments.tenantId, input.tenantId),
              inArray(customerCommentAttachments.commentId, commentIds),
              eq(mediaObjects.status, "committed"),
              isNull(mediaObjects.deletedAt),
            ),
          )
          .orderBy(asc(customerCommentAttachments.sortOrder)),
  ]);

  const mentionsByCommentId = new Map<string, typeof mentionRows>();
  for (const mention of mentionRows) {
    mentionsByCommentId.set(mention.commentId, [
      ...(mentionsByCommentId.get(mention.commentId) ?? []),
      mention,
    ]);
  }
  const attachmentsByCommentId = new Map<string, typeof attachmentRows>();
  for (const attachment of attachmentRows) {
    attachmentsByCommentId.set(attachment.commentId, [
      ...(attachmentsByCommentId.get(attachment.commentId) ?? []),
      attachment,
    ]);
  }

  return {
    auditRows,
    commentRows: commentRows.map((row) => ({
      ...row,
      mentions: (mentionsByCommentId.get(row.id) ?? []).map((mention) => ({
        userId: mention.userId,
        displayName: mention.displayName,
        avatarUrl: mention.avatarUrl,
      })),
      attachments: (attachmentsByCommentId.get(row.id) ?? []).map(
        ({ commentId: _commentId, ...attachment }) => attachment,
      ),
    })),
    hasCreationAudit: creationRows.length > 0,
  };
}

export async function findActiveTenantCustomerMentionUsers(
  db: Database,
  input: { tenantId: string; userIds: string[] },
) {
  if (input.userIds.length === 0) return [];
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

export async function createTenantCustomerCommentRecord(
  db: Database,
  input: {
    id: string;
    tenantId: string;
    customerId: string;
    authorUserId: string;
    body: string;
    idempotencyKey: string;
  },
) {
  const inserted = await db
    .insert(customerComments)
    .values(input)
    .onConflictDoNothing({
      target: [
        customerComments.tenantId,
        customerComments.customerId,
        customerComments.idempotencyKey,
      ],
    })
    .returning();
  if (inserted[0]) return { comment: inserted[0], created: true };

  const [existing] = await db
    .select()
    .from(customerComments)
    .where(
      and(
        eq(customerComments.tenantId, input.tenantId),
        eq(customerComments.customerId, input.customerId),
        eq(customerComments.idempotencyKey, input.idempotencyKey),
        isNull(customerComments.deletedAt),
      ),
    )
    .limit(1);
  return existing
    ? { comment: existing, created: false }
    : { comment: null, created: false };
}

export async function listTenantCustomerCommentMentionIds(
  db: Database,
  input: { tenantId: string; commentId: string },
) {
  const rows = await db
    .select({ userId: customerCommentMentions.mentionedUserId })
    .from(customerCommentMentions)
    .where(
      and(
        eq(customerCommentMentions.tenantId, input.tenantId),
        eq(customerCommentMentions.commentId, input.commentId),
      ),
    );
  return rows.map((row) => row.userId);
}

export async function replaceTenantCustomerCommentMentions(
  db: Database,
  input: { tenantId: string; commentId: string; userIds: string[] },
) {
  await db
    .delete(customerCommentMentions)
    .where(
      and(
        eq(customerCommentMentions.tenantId, input.tenantId),
        eq(customerCommentMentions.commentId, input.commentId),
      ),
    );
  if (input.userIds.length > 0) {
    await db.insert(customerCommentMentions).values(
      input.userIds.map((userId) => ({
        id: createId(),
        tenantId: input.tenantId,
        commentId: input.commentId,
        mentionedUserId: userId,
      })),
    );
  }
}

export async function findTenantCustomerCommentAttachments(
  db: Database,
  input: { tenantId: string; commentId: string },
) {
  return db
    .select({
      id: customerCommentAttachments.id,
      fileName: customerCommentAttachments.fileName,
      objectKey: mediaObjects.objectKey,
      contentType: mediaObjects.contentType,
      sizeBytes: mediaObjects.sizeBytes,
    })
    .from(customerCommentAttachments)
    .innerJoin(
      mediaObjects,
      eq(mediaObjects.id, customerCommentAttachments.mediaObjectId),
    )
    .where(
      and(
        eq(customerCommentAttachments.tenantId, input.tenantId),
        eq(customerCommentAttachments.commentId, input.commentId),
        eq(mediaObjects.status, "committed"),
        isNull(mediaObjects.deletedAt),
      ),
    )
    .orderBy(asc(customerCommentAttachments.sortOrder));
}

export async function bindTenantCustomerCommentAttachments(
  db: Database,
  input: {
    tenantId: string;
    commentId: string;
    actorUserId: string;
    attachments: Array<{ objectKey: string; fileName: string }>;
  },
) {
  if (input.attachments.length === 0) return [];
  const objectKeys = input.attachments.map(({ objectKey }) => objectKey);
  if (new Set(objectKeys).size !== objectKeys.length) {
    throw new TenantCustomersError(
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
      throw new TenantCustomersError(
        "COMMENT_ATTACHMENT_NOT_FOUND",
        "One or more comment attachments were not found.",
        404,
      );
    }
    if (row.createdBy !== input.actorUserId) {
      throw new TenantCustomersError(
        "COMMENT_ATTACHMENT_INVALID",
        "One or more comment attachments are not accessible.",
        403,
      );
    }
    if (
      row.purpose !== "customer_comment_attachment" ||
      row.status !== "pending" ||
      row.expiresAt.getTime() < Date.now()
    ) {
      throw new TenantCustomersError(
        "COMMENT_ATTACHMENT_INVALID",
        "One or more comment attachments are invalid or expired.",
        422,
      );
    }
  }

  const records = input.attachments.map((attachment, sortOrder) => {
    const media = rowsByKey.get(attachment.objectKey)!;
    return {
      id: createId(),
      tenantId: input.tenantId,
      commentId: input.commentId,
      mediaObjectId: media.id,
      fileName: attachment.fileName,
      sortOrder,
      objectKey: media.objectKey,
      contentType: media.contentType,
      sizeBytes: media.sizeBytes,
    };
  });
  await db
    .insert(customerCommentAttachments)
    .values(
      records.map(
        ({
          objectKey: _objectKey,
          contentType: _contentType,
          sizeBytes: _sizeBytes,
          ...record
        }) => record,
      ),
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
          records.map(({ mediaObjectId }) => mediaObjectId),
        ),
        eq(mediaObjects.status, "pending"),
        isNull(mediaObjects.deletedAt),
      ),
    )
    .returning({ id: mediaObjects.id });
  if (committed.length !== records.length) {
    throw new TenantCustomersError(
      "COMMENT_ATTACHMENT_CONFLICT",
      "One or more comment attachments have already been used.",
      409,
    );
  }
  return records.map(({ id, fileName, objectKey, contentType, sizeBytes }) => ({
    id,
    fileName,
    objectKey,
    contentType,
    sizeBytes,
  }));
}

export async function findTenantCustomerCommentForMutation(
  db: Database,
  input: { tenantId: string; customerId: string; commentId: string },
) {
  const [row] = await db
    .select()
    .from(customerComments)
    .where(
      and(
        eq(customerComments.id, input.commentId),
        eq(customerComments.tenantId, input.tenantId),
        eq(customerComments.customerId, input.customerId),
        isNull(customerComments.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function updateTenantCustomerCommentRecord(
  db: Database,
  input: {
    tenantId: string;
    customerId: string;
    commentId: string;
    body: string;
    version: number;
  },
) {
  const now = new Date();
  const [row] = await db
    .update(customerComments)
    .set({
      body: input.body,
      editedAt: now,
      updatedAt: now,
      version: sql`${customerComments.version} + 1`,
    })
    .where(
      and(
        eq(customerComments.id, input.commentId),
        eq(customerComments.tenantId, input.tenantId),
        eq(customerComments.customerId, input.customerId),
        eq(customerComments.version, input.version),
        isNull(customerComments.deletedAt),
      ),
    )
    .returning();
  return row ?? null;
}

export async function softDeleteTenantCustomerCommentRecord(
  db: Database,
  input: {
    tenantId: string;
    customerId: string;
    commentId: string;
    actorUserId: string;
    version: number;
  },
) {
  const now = new Date();
  const [row] = await db
    .update(customerComments)
    .set({
      deletedAt: now,
      deletedBy: input.actorUserId,
      updatedAt: now,
      version: sql`${customerComments.version} + 1`,
    })
    .where(
      and(
        eq(customerComments.id, input.commentId),
        eq(customerComments.tenantId, input.tenantId),
        eq(customerComments.customerId, input.customerId),
        eq(customerComments.version, input.version),
        isNull(customerComments.deletedAt),
      ),
    )
    .returning({ id: customerComments.id });
  return row ?? null;
}

export async function createTenantCustomerMentionNotification(
  db: Database,
  input: {
    tenantId: string;
    customerId: string;
    commentId: string;
    commentVersion: number;
    recipientUserId: string;
    senderUserId: string;
    locale: string;
    title: string;
    content: string;
  },
) {
  const idempotencyKey = `customer-comment-mention:${input.commentId}:${input.commentVersion}:${input.recipientUserId}`;
  const notificationId = createId();
  const inserted = await db
    .insert(notifications)
    .values({
      id: notificationId,
      tenantId: input.tenantId,
      scope: "tenant",
      noticeType: "business",
      relatedType: "customer",
      relatedId: input.customerId,
      title: input.title,
      content: input.content,
      locale: input.locale,
      payload: {
        customerId: input.customerId,
        commentId: input.commentId,
        href: `/tenant/customers/${input.customerId}`,
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
  if (!inserted[0]) return;
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
