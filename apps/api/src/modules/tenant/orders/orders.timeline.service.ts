import { createId } from "@cleanhub/id";
import { getDb, type Database } from "@cleanhub/db";

import { writeAuditLog } from "../../audit/audit.helper.js";
import { MediaService } from "../../media/media.service.js";
import { TenantOrdersError } from "./orders.errors.js";
import { getTenantOrderDetail } from "./orders.service.js";
import {
  createTenantOrderMentionNotification,
  bindTenantOrderCommentAttachments,
  createTenantOrderCommentRecord,
  findActiveTenantMentionUsers,
  findTenantOrderCommentForMutation,
  findTenantOrderCommentAttachments,
  findTenantOrderTimelineRows,
  listTenantOrderCommentMentionIds,
  replaceTenantOrderCommentMentions,
  softDeleteTenantOrderCommentRecord,
  updateTenantOrderCommentRecord,
} from "./orders.timeline.repository.js";
import type {
  CreateTenantOrderCommentInput,
  DeleteTenantOrderCommentInput,
  TenantOrderCommentMention,
  TenantOrderCommentAttachment,
  TenantOrderTimelineDataValue,
  TenantOrderTimelineInput,
  TenantOrderTimelineItem,
  TenantOrderTimelineResponse,
  UpdateTenantOrderCommentInput,
} from "./orders.types.js";

type TimelineCursor = { occurredAt: Date; id: string };
type TimelineRows = Awaited<ReturnType<typeof findTenantOrderTimelineRows>>;
type AttachmentRow = {
  id: string;
  fileName: string;
  objectKey: string;
  contentType: string;
  sizeBytes: number;
};

function decodeTimelineCursor(
  cursor: string | undefined,
): TimelineCursor | undefined {
  if (!cursor) {
    return undefined;
  }

  try {
    const value = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as { occurredAt?: unknown; id?: unknown };
    const occurredAt =
      typeof value.occurredAt === "string" ? new Date(value.occurredAt) : null;

    if (
      !occurredAt ||
      Number.isNaN(occurredAt.getTime()) ||
      typeof value.id !== "string" ||
      !/^[0-9A-HJKMNP-TV-Z]{26}$/.test(value.id)
    ) {
      throw new Error("Invalid cursor payload.");
    }

    return { occurredAt, id: value.id };
  } catch {
    throw new TenantOrdersError(
      "INVALID_TIMELINE_CURSOR",
      "Timeline cursor is invalid.",
      400,
    );
  }
}

function encodeTimelineCursor(item: TenantOrderTimelineItem): string {
  return Buffer.from(
    JSON.stringify({ occurredAt: item.occurredAt, id: item.id }),
    "utf8",
  ).toString("base64url");
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readScalar(
  record: Record<string, unknown>,
  key: string,
): TenantOrderTimelineDataValue | undefined {
  const value = record[key];
  return value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
    ? value
    : undefined;
}

function buildAuditTimelineData(
  row: TimelineRows["auditRows"][number],
): Record<string, TenantOrderTimelineDataValue> {
  const before = readRecord(row.before);
  const after = readRecord(row.after);
  const metadata = readRecord(row.metadata);
  const data: Record<string, TenantOrderTimelineDataValue> = {};
  const candidates: Array<[string, Record<string, unknown>, string]> = [
    ["fromStatus", before, "status"],
    ["fromStatus", before, "ticketStatus"],
    ["fromStatus", before, "itemStatus"],
    ["toStatus", after, "status"],
    ["toStatus", after, "ticketStatus"],
    ["toStatus", after, "itemStatus"],
    ["beforePaymentStatus", before, "paymentStatus"],
    ["paymentStatus", after, "paymentStatus"],
    ["beforePaidAmount", before, "paidAmount"],
    ["paidAmount", after, "paidAmount"],
    ["paymentMethod", after, "paymentMethod"],
    ["provider", after, "provider"],
    ["transactionStatus", after, "transactionStatus"],
    ["itemId", after, "itemId"],
    ["serviceId", after, "serviceId"],
    ["quantity", after, "quantity"],
    ["weight", after, "weight"],
    ["discountAmount", after, "discountAmount"],
    ["note", metadata, "note"],
    ["orderId", metadata, "orderId"],
    ["direction", metadata, "direction"],
  ];

  for (const [targetKey, record, sourceKey] of candidates) {
    if (data[targetKey] !== undefined) {
      continue;
    }
    const value = readScalar(record, sourceKey);
    if (value !== undefined) {
      data[targetKey] = value;
    }
  }

  if (row.reason) {
    data.reason = row.reason;
  }

  return data;
}

function compareTimelineItems(
  left: TenantOrderTimelineItem,
  right: TenantOrderTimelineItem,
): number {
  const dateComparison = right.occurredAt.localeCompare(left.occurredAt);
  return dateComparison || right.id.localeCompare(left.id);
}

function isBeforeCursor(
  item: TenantOrderTimelineItem,
  cursor: TimelineCursor | undefined,
): boolean {
  if (!cursor) {
    return true;
  }

  const occurredAt = new Date(item.occurredAt).getTime();
  const cursorTime = cursor.occurredAt.getTime();
  return (
    occurredAt < cursorTime ||
    (occurredAt === cursorTime && item.id < cursor.id)
  );
}

function toAuditTimelineItem(
  row: TimelineRows["auditRows"][number],
): TenantOrderTimelineItem {
  return {
    id: row.id,
    kind: "system",
    source: row.entityType === "service_ticket" ? "service_ticket" : "order",
    eventType: row.eventType,
    actorUserId: row.actorUserId,
    actorDisplayName: row.actorDisplayName,
    actorAvatarUrl: row.actorAvatarUrl,
    data: buildAuditTimelineData(row),
    body: null,
    editedAt: null,
    version: null,
    mentions: [],
    attachments: [],
    canEdit: false,
    canDelete: false,
    occurredAt: row.createdAt.toISOString(),
  };
}

function toCommentTimelineItem(
  row: TimelineRows["commentRows"][number],
  authContext: TenantOrderTimelineInput["authContext"],
  attachments: TenantOrderCommentAttachment[],
): TenantOrderTimelineItem {
  const isAuthor = row.authorUserId === authContext.userId;

  return {
    id: row.id,
    kind: "comment",
    source: "comment",
    eventType: "tenant.order.comment_created",
    actorUserId: row.authorUserId,
    actorDisplayName: row.actorDisplayName,
    actorAvatarUrl: row.actorAvatarUrl,
    data: {},
    body: row.body,
    editedAt: row.editedAt?.toISOString() ?? null,
    version: row.version,
    mentions: row.mentions,
    attachments,
    canEdit: isAuthor,
    canDelete: isAuthor || authContext.role === "owner",
    occurredAt: row.createdAt.toISOString(),
  };
}

function toDeliveryTimelineItem(
  row: TimelineRows["deliveryRows"][number],
): TenantOrderTimelineItem {
  return {
    id: row.id,
    kind: "system",
    source: "delivery",
    eventType: "delivery.task.status_changed",
    actorUserId: row.actorUserId,
    actorDisplayName: row.actorDisplayName,
    actorAvatarUrl: row.actorAvatarUrl,
    data: {
      taskId: row.taskId,
      fromStatus: row.fromStatus,
      toStatus: row.toStatus,
      note: row.note,
    },
    body: null,
    editedAt: null,
    version: null,
    mentions: [],
    attachments: [],
    canEdit: false,
    canDelete: false,
    occurredAt: row.createdAt.toISOString(),
  };
}

export async function getTenantOrderTimeline(
  input: TenantOrderTimelineInput,
  db: Database = getDb(),
): Promise<TenantOrderTimelineResponse> {
  const order = await getTenantOrderDetail(
    input.authContext,
    input.orderId,
    db,
  );
  const cursor = decodeTimelineCursor(input.query.cursor);
  const linkedTicketIds = Array.from(
    new Set(
      order.items
        .map((item) => item.ticketId)
        .filter((ticketId): ticketId is string => Boolean(ticketId)),
    ),
  );
  const rows = await findTenantOrderTimelineRows(db, {
    tenantId: order.tenantId,
    orderId: order.id,
    linkedTicketIds,
    before: cursor,
    limit: input.query.limit,
  });
  const hasAttachments = rows.commentRows.some(
    (row) => row.attachments.length > 0,
  );
  const mediaService = hasAttachments ? new MediaService() : undefined;
  const commentItems = await Promise.all(
    rows.commentRows.map(async (row) =>
      toCommentTimelineItem(
        row,
        input.authContext,
        await toAttachmentDtos(order.tenantId, row.attachments, mediaService),
      ),
    ),
  );
  const items = [
    ...rows.auditRows.map(toAuditTimelineItem),
    ...commentItems,
    ...rows.deliveryRows.map(toDeliveryTimelineItem),
  ];

  if (!rows.hasCreationAudit) {
    const syntheticCreated: TenantOrderTimelineItem = {
      id: order.id,
      kind: "system",
      source: "synthetic",
      eventType: "pos.order.created",
      actorUserId: null,
      actorDisplayName: null,
      actorAvatarUrl: null,
      data: { orderType: order.orderType },
      body: null,
      editedAt: null,
      version: null,
      mentions: [],
      attachments: [],
      canEdit: false,
      canDelete: false,
      occurredAt: order.createdAt,
    };
    if (isBeforeCursor(syntheticCreated, cursor)) {
      items.push(syntheticCreated);
    }
  }

  items.sort(compareTimelineItems);
  const hasMore = items.length > input.query.limit;
  const page = items.slice(0, input.query.limit);

  return {
    data: page,
    nextCursor:
      hasMore && page.length > 0
        ? encodeTimelineCursor(page[page.length - 1])
        : null,
  };
}

export async function createTenantOrderComment(
  input: CreateTenantOrderCommentInput,
  db: Database = getDb(),
): Promise<TenantOrderTimelineItem> {
  const order = await getTenantOrderDetail(
    input.authContext,
    input.orderId,
    db,
  );
  const body = input.data.body.trim();
  const mentionedUserIds = Array.from(
    new Set(input.data.mentionedUserIds ?? []),
  );
  const attachments = input.data.attachments ?? [];
  const mediaService = attachments.length > 0 ? new MediaService() : undefined;

  return db.transaction(async (tx) => {
    const mentionUsers = await resolveMentionUsers(tx, {
      tenantId: order.tenantId,
      userIds: mentionedUserIds,
    });
    const result = await createTenantOrderCommentRecord(tx, {
      id: createId(),
      tenantId: order.tenantId,
      branchId: order.branchId,
      orderId: order.id,
      authorUserId: input.authContext.userId,
      body,
      idempotencyKey: input.data.idempotencyKey,
    });

    if (!result.comment) {
      throw new TenantOrdersError(
        "COMMENT_IDEMPOTENCY_CONFLICT",
        "The comment could not be replayed safely.",
        409,
      );
    }
    if (!result.created && result.comment.body !== body) {
      throw new TenantOrdersError(
        "COMMENT_IDEMPOTENCY_CONFLICT",
        "The idempotency key has already been used for another comment.",
        409,
      );
    }

    const existingMentionIds = await listTenantOrderCommentMentionIds(tx, {
      tenantId: order.tenantId,
      commentId: result.comment.id,
    });
    if (
      !result.created &&
      !sameStringSet(existingMentionIds, mentionedUserIds)
    ) {
      throw new TenantOrdersError(
        "COMMENT_IDEMPOTENCY_CONFLICT",
        "The idempotency key has already been used with different mentions.",
        409,
      );
    }
    const existingAttachments = await findTenantOrderCommentAttachments(tx, {
      tenantId: order.tenantId,
      commentId: result.comment.id,
    });
    if (
      !result.created &&
      !sameStringSet(
        existingAttachments.map((attachment) => attachment.objectKey),
        attachments.map((attachment) => attachment.objectKey),
      )
    ) {
      throw new TenantOrdersError(
        "COMMENT_IDEMPOTENCY_CONFLICT",
        "The idempotency key has already been used with different attachments.",
        409,
      );
    }

    let boundAttachments = existingAttachments;

    if (result.created) {
      await Promise.all(
        attachments.map((attachment) =>
          mediaService!.assertOwnedPendingAndUploaded({
            tenantId: order.tenantId,
            objectKey: attachment.objectKey,
            expectedPurpose: "order_comment_attachment",
            expectedCreatedBy: input.authContext.userId,
          }),
        ),
      );
      await replaceTenantOrderCommentMentions(tx, {
        tenantId: order.tenantId,
        commentId: result.comment.id,
        userIds: mentionedUserIds,
      });
      boundAttachments = await bindTenantOrderCommentAttachments(tx, {
        tenantId: order.tenantId,
        commentId: result.comment.id,
        actorUserId: input.authContext.userId,
        attachments,
      });
      await writeAuditLog(tx, {
        actorUserId: input.authContext.userId,
        tenantId: order.tenantId,
        branchId: order.branchId,
        eventCategory: "tenant_order",
        eventType: "tenant.order.comment_created",
        entityType: "order",
        entityId: order.id,
        metadata: {
          commentId: result.comment.id,
          mentionedUserIds,
          attachmentIds: boundAttachments.map((attachment) => attachment.id),
        },
        ipAddress: input.requestMeta?.ipAddress,
        userAgent: input.requestMeta?.userAgent,
      });
      await notifyMentionedUsers(tx, {
        tenantId: order.tenantId,
        orderId: order.id,
        commentId: result.comment.id,
        commentVersion: result.comment.version,
        senderUserId: input.authContext.userId,
        senderDisplayName: input.authContext.displayName,
        users: mentionUsers,
      });
    }

    return {
      id: result.comment.id,
      kind: "comment",
      source: "comment",
      eventType: "tenant.order.comment_created",
      actorUserId: input.authContext.userId,
      actorDisplayName: input.authContext.displayName,
      actorAvatarUrl: null,
      data: {},
      body: result.comment.body,
      editedAt: result.comment.editedAt?.toISOString() ?? null,
      version: result.comment.version,
      mentions: toCommentMentions(mentionUsers, mentionedUserIds),
      attachments: await toAttachmentDtos(
        order.tenantId,
        boundAttachments,
        mediaService,
      ),
      canEdit: true,
      canDelete: true,
      occurredAt: result.comment.createdAt.toISOString(),
    };
  });
}

async function toAttachmentDtos(
  tenantId: string,
  attachments: AttachmentRow[],
  mediaService?: MediaService,
): Promise<TenantOrderCommentAttachment[]> {
  if (attachments.length === 0) {
    return [];
  }
  const downloadService = mediaService ?? new MediaService();
  return Promise.all(
    attachments.map(async (attachment) => {
      const ticket =
        await downloadService.createDownloadLinkForKnownCommittedObject({
          tenantId,
          objectKey: attachment.objectKey,
        });
      return {
        id: attachment.id,
        fileName: attachment.fileName,
        contentType: attachment.contentType,
        sizeBytes: attachment.sizeBytes,
        downloadUrl: ticket.downloadUrl,
        expiresAt: ticket.expiresAt,
      };
    }),
  );
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

async function resolveMentionUsers(
  db: Database,
  input: { tenantId: string; userIds: string[] },
) {
  const users = await findActiveTenantMentionUsers(db, input);
  if (users.length !== input.userIds.length) {
    throw new TenantOrdersError(
      "MENTIONED_USER_NOT_FOUND",
      "One or more mentioned staff members are not active in this tenant.",
      400,
    );
  }
  return users;
}

function toCommentMentions(
  users: Awaited<ReturnType<typeof findActiveTenantMentionUsers>>,
  orderedUserIds: string[],
): TenantOrderCommentMention[] {
  const byId = new Map(users.map((user) => [user.userId, user]));
  return orderedUserIds.flatMap((userId) => {
    const user = byId.get(userId);
    return user
      ? [{ userId, displayName: user.displayName, avatarUrl: user.avatarUrl }]
      : [];
  });
}

function getMentionNotificationCopy(locale: string, actor: string) {
  if (locale === "zh-CN") {
    return {
      title: "你在订单评论中被提及",
      content: `${actor} 在一条内部订单评论中提及了你。`,
    };
  }
  if (locale === "fr") {
    return {
      title: "Vous avez été mentionné dans une commande",
      content: `${actor} vous a mentionné dans un commentaire interne de commande.`,
    };
  }
  return {
    title: "You were mentioned in an order comment",
    content: `${actor} mentioned you in an internal order comment.`,
  };
}

async function notifyMentionedUsers(
  db: Database,
  input: {
    tenantId: string;
    orderId: string;
    commentId: string;
    commentVersion: number;
    senderUserId: string;
    senderDisplayName: string;
    users: Awaited<ReturnType<typeof findActiveTenantMentionUsers>>;
  },
) {
  for (const user of input.users) {
    if (user.userId === input.senderUserId) {
      continue;
    }
    const copy = getMentionNotificationCopy(
      user.language,
      input.senderDisplayName,
    );
    await createTenantOrderMentionNotification(db, {
      tenantId: input.tenantId,
      orderId: input.orderId,
      commentId: input.commentId,
      commentVersion: input.commentVersion,
      recipientUserId: user.userId,
      senderUserId: input.senderUserId,
      locale: user.language,
      ...copy,
    });
  }
}

export async function updateTenantOrderComment(
  input: UpdateTenantOrderCommentInput,
  db: Database = getDb(),
): Promise<TenantOrderTimelineItem> {
  const order = await getTenantOrderDetail(
    input.authContext,
    input.orderId,
    db,
  );
  const body = input.data.body.trim();
  const mentionedUserIds = Array.from(
    new Set(input.data.mentionedUserIds ?? []),
  );

  return db.transaction(async (tx) => {
    const comment = await findTenantOrderCommentForMutation(tx, {
      tenantId: order.tenantId,
      orderId: order.id,
      commentId: input.commentId,
    });
    if (!comment) {
      throw new TenantOrdersError(
        "COMMENT_NOT_FOUND",
        "Comment was not found.",
        404,
      );
    }
    if (comment.authorUserId !== input.authContext.userId) {
      throw new TenantOrdersError(
        "COMMENT_FORBIDDEN",
        "Only the comment author can edit this comment.",
        403,
      );
    }
    if (comment.version !== input.data.version) {
      throw new TenantOrdersError(
        "COMMENT_VERSION_CONFLICT",
        "The comment has changed. Refresh and try again.",
        409,
      );
    }

    const mentionUsers = await resolveMentionUsers(tx, {
      tenantId: order.tenantId,
      userIds: mentionedUserIds,
    });
    const previousMentionIds = await listTenantOrderCommentMentionIds(tx, {
      tenantId: order.tenantId,
      commentId: comment.id,
    });
    const attachmentRows = await findTenantOrderCommentAttachments(tx, {
      tenantId: order.tenantId,
      commentId: comment.id,
    });
    const updated = await updateTenantOrderCommentRecord(tx, {
      tenantId: order.tenantId,
      orderId: order.id,
      commentId: comment.id,
      body,
      version: input.data.version,
    });
    if (!updated) {
      throw new TenantOrdersError(
        "COMMENT_VERSION_CONFLICT",
        "The comment has changed. Refresh and try again.",
        409,
      );
    }

    await replaceTenantOrderCommentMentions(tx, {
      tenantId: order.tenantId,
      commentId: comment.id,
      userIds: mentionedUserIds,
    });
    await writeAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId: order.tenantId,
      branchId: order.branchId,
      eventCategory: "tenant_order",
      eventType: "tenant.order.comment_updated",
      entityType: "order",
      entityId: order.id,
      metadata: { commentId: comment.id, mentionedUserIds },
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });
    const newlyMentionedIds = mentionedUserIds.filter(
      (userId) => !previousMentionIds.includes(userId),
    );
    await notifyMentionedUsers(tx, {
      tenantId: order.tenantId,
      orderId: order.id,
      commentId: comment.id,
      commentVersion: updated.version,
      senderUserId: input.authContext.userId,
      senderDisplayName: input.authContext.displayName,
      users: mentionUsers.filter((user) =>
        newlyMentionedIds.includes(user.userId),
      ),
    });

    return {
      id: updated.id,
      kind: "comment",
      source: "comment",
      eventType: "tenant.order.comment_updated",
      actorUserId: updated.authorUserId,
      actorDisplayName: input.authContext.displayName,
      actorAvatarUrl: null,
      data: {},
      body: updated.body,
      editedAt: updated.editedAt?.toISOString() ?? null,
      version: updated.version,
      mentions: toCommentMentions(mentionUsers, mentionedUserIds),
      attachments: await toAttachmentDtos(
        order.tenantId,
        attachmentRows,
        new MediaService(),
      ),
      canEdit: true,
      canDelete: true,
      occurredAt: updated.createdAt.toISOString(),
    };
  });
}

export async function deleteTenantOrderComment(
  input: DeleteTenantOrderCommentInput,
  db: Database = getDb(),
): Promise<void> {
  const order = await getTenantOrderDetail(
    input.authContext,
    input.orderId,
    db,
  );

  await db.transaction(async (tx) => {
    const comment = await findTenantOrderCommentForMutation(tx, {
      tenantId: order.tenantId,
      orderId: order.id,
      commentId: input.commentId,
    });
    if (!comment) {
      throw new TenantOrdersError(
        "COMMENT_NOT_FOUND",
        "Comment was not found.",
        404,
      );
    }
    const canDelete =
      comment.authorUserId === input.authContext.userId ||
      input.authContext.role === "owner";
    if (!canDelete) {
      throw new TenantOrdersError(
        "COMMENT_FORBIDDEN",
        "Only the author or a tenant owner can delete this comment.",
        403,
      );
    }
    if (comment.version !== input.data.version) {
      throw new TenantOrdersError(
        "COMMENT_VERSION_CONFLICT",
        "The comment has changed. Refresh and try again.",
        409,
      );
    }

    const deleted = await softDeleteTenantOrderCommentRecord(tx, {
      tenantId: order.tenantId,
      orderId: order.id,
      commentId: comment.id,
      actorUserId: input.authContext.userId,
      version: input.data.version,
    });
    if (!deleted) {
      throw new TenantOrdersError(
        "COMMENT_VERSION_CONFLICT",
        "The comment has changed. Refresh and try again.",
        409,
      );
    }

    await writeAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId: order.tenantId,
      branchId: order.branchId,
      eventCategory: "tenant_order",
      eventType: "tenant.order.comment_deleted",
      entityType: "order",
      entityId: order.id,
      metadata: { commentId: comment.id },
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });
  });
}
