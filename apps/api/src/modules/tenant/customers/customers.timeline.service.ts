import { getDb, type Database } from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import { writeAuditLog } from "../../audit/audit.helper.js";
import { MediaService } from "../../media/media.service.js";
import { TenantCustomersError } from "./customers.errors.js";
import { getTenantCustomerDetail } from "./customers.service.js";
import {
  bindTenantCustomerCommentAttachments,
  createTenantCustomerCommentRecord,
  createTenantCustomerMentionNotification,
  findActiveTenantCustomerMentionUsers,
  findTenantCustomerCommentAttachments,
  findTenantCustomerCommentForMutation,
  findTenantCustomerTimelineRows,
  listTenantCustomerCommentMentionIds,
  replaceTenantCustomerCommentMentions,
  softDeleteTenantCustomerCommentRecord,
  updateTenantCustomerCommentRecord,
} from "./customers.timeline.repository.js";
import type {
  CreateTenantCustomerCommentInput,
  DeleteTenantCustomerCommentInput,
  TenantCustomerAttachmentUploadRequest,
  TenantCustomerAttachmentUploadTicket,
  TenantCustomerCommentAttachment,
  TenantCustomerCommentMention,
  TenantCustomerTimelineDataValue,
  TenantCustomerTimelineInput,
  TenantCustomerTimelineItem,
  TenantCustomerTimelineResponse,
  UpdateTenantCustomerCommentInput,
} from "./customers.types.js";

type TimelineCursor = { occurredAt: Date; id: string };
type TimelineRows = Awaited<ReturnType<typeof findTenantCustomerTimelineRows>>;
type AttachmentRow = {
  id: string;
  fileName: string;
  objectKey: string;
  contentType: string;
  sizeBytes: number;
};

function decodeTimelineCursor(cursor: string | undefined) {
  if (!cursor) return undefined;
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
    throw new TenantCustomersError(
      "INVALID_TIMELINE_CURSOR",
      "Timeline cursor is invalid.",
      400,
    );
  }
}

function encodeTimelineCursor(item: TenantCustomerTimelineItem) {
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

function readScalar(record: Record<string, unknown>, key: string) {
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
): Record<string, TenantCustomerTimelineDataValue> {
  const before = readRecord(row.before);
  const after = readRecord(row.after);
  const data: Record<string, TenantCustomerTimelineDataValue> = {};
  const fromStatus = readScalar(before, "status");
  const toStatus = readScalar(after, "status");
  if (fromStatus !== undefined) data.fromStatus = fromStatus;
  if (toStatus !== undefined) data.toStatus = toStatus;
  if (row.reason) data.reason = row.reason;
  return data;
}

function compareTimelineItems(
  left: TenantCustomerTimelineItem,
  right: TenantCustomerTimelineItem,
) {
  return (
    right.occurredAt.localeCompare(left.occurredAt) ||
    right.id.localeCompare(left.id)
  );
}

function isBeforeCursor(
  item: TenantCustomerTimelineItem,
  cursor: TimelineCursor | undefined,
) {
  if (!cursor) return true;
  const occurredAt = new Date(item.occurredAt).getTime();
  const cursorTime = cursor.occurredAt.getTime();
  return (
    occurredAt < cursorTime ||
    (occurredAt === cursorTime && item.id < cursor.id)
  );
}

function toAuditTimelineItem(
  row: TimelineRows["auditRows"][number],
): TenantCustomerTimelineItem {
  return {
    id: row.id,
    kind: "system",
    source:
      row.entityType === "customer_account" ? "customer_account" : "customer",
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
  authContext: TenantCustomerTimelineInput["authContext"],
  attachments: TenantCustomerCommentAttachment[],
): TenantCustomerTimelineItem {
  const isAuthor = row.authorUserId === authContext.userId;
  return {
    id: row.id,
    kind: "comment",
    source: "comment",
    eventType: "tenant.customer.comment_created",
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

async function toAttachmentDtos(
  tenantId: string,
  attachments: AttachmentRow[],
  mediaService?: MediaService,
): Promise<TenantCustomerCommentAttachment[]> {
  if (attachments.length === 0) return [];
  const service = mediaService ?? new MediaService();
  return Promise.all(
    attachments.map(async (attachment) => {
      const ticket = await service.createDownloadLinkForKnownCommittedObject({
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

export async function getTenantCustomerTimeline(
  input: TenantCustomerTimelineInput,
  db: Database = getDb(),
): Promise<TenantCustomerTimelineResponse> {
  const customer = await getTenantCustomerDetail(
    input.authContext,
    input.customerId,
    db,
  );
  const tenantId = input.authContext.tenantId!;
  const cursor = decodeTimelineCursor(input.query.cursor);
  const rows = await findTenantCustomerTimelineRows(db, {
    tenantId,
    customerId: customer.id,
    customerAccountId: customer.customerAccountId,
    before: cursor,
    limit: input.query.limit,
  });
  const mediaService = rows.commentRows.some(
    ({ attachments }) => attachments.length > 0,
  )
    ? new MediaService()
    : undefined;
  const comments = await Promise.all(
    rows.commentRows.map(async (row) =>
      toCommentTimelineItem(
        row,
        input.authContext,
        await toAttachmentDtos(tenantId, row.attachments, mediaService),
      ),
    ),
  );
  const items = [...rows.auditRows.map(toAuditTimelineItem), ...comments];
  if (!rows.hasCreationAudit) {
    const synthetic: TenantCustomerTimelineItem = {
      id: customer.id,
      kind: "system",
      source: "synthetic",
      eventType: "pos_customer.profile_created",
      actorUserId: null,
      actorDisplayName: null,
      actorAvatarUrl: null,
      data: {},
      body: null,
      editedAt: null,
      version: null,
      mentions: [],
      attachments: [],
      canEdit: false,
      canDelete: false,
      occurredAt: customer.createdAt,
    };
    if (isBeforeCursor(synthetic, cursor)) items.push(synthetic);
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

function sameStringSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

async function resolveMentionUsers(
  db: Database,
  input: { tenantId: string; userIds: string[] },
) {
  const users = await findActiveTenantCustomerMentionUsers(db, input);
  if (users.length !== input.userIds.length) {
    throw new TenantCustomersError(
      "MENTIONED_USER_NOT_FOUND",
      "One or more mentioned staff members are not active in this tenant.",
      400,
    );
  }
  return users;
}

function toCommentMentions(
  users: Awaited<ReturnType<typeof findActiveTenantCustomerMentionUsers>>,
  orderedUserIds: string[],
): TenantCustomerCommentMention[] {
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
      title: "你在顾客评论中被提及",
      content: `${actor} 在一条内部顾客评论中提及了你。`,
    };
  }
  if (locale === "fr") {
    return {
      title: "Vous avez été mentionné dans un commentaire client",
      content: `${actor} vous a mentionné dans un commentaire client interne.`,
    };
  }
  return {
    title: "You were mentioned in a customer comment",
    content: `${actor} mentioned you in an internal customer comment.`,
  };
}

async function notifyMentionedUsers(
  db: Database,
  input: {
    tenantId: string;
    customerId: string;
    commentId: string;
    commentVersion: number;
    senderUserId: string;
    senderDisplayName: string;
    users: Awaited<ReturnType<typeof findActiveTenantCustomerMentionUsers>>;
  },
) {
  for (const user of input.users) {
    if (user.userId === input.senderUserId) continue;
    await createTenantCustomerMentionNotification(db, {
      tenantId: input.tenantId,
      customerId: input.customerId,
      commentId: input.commentId,
      commentVersion: input.commentVersion,
      recipientUserId: user.userId,
      senderUserId: input.senderUserId,
      locale: user.language,
      ...getMentionNotificationCopy(user.language, input.senderDisplayName),
    });
  }
}

export async function createTenantCustomerComment(
  input: CreateTenantCustomerCommentInput,
  db: Database = getDb(),
): Promise<TenantCustomerTimelineItem> {
  const customer = await getTenantCustomerDetail(
    input.authContext,
    input.customerId,
    db,
  );
  const tenantId = input.authContext.tenantId!;
  const body = input.data.body.trim();
  const mentionedUserIds = Array.from(
    new Set(input.data.mentionedUserIds ?? []),
  );
  const attachments = input.data.attachments ?? [];
  const mediaService = attachments.length > 0 ? new MediaService() : undefined;

  return db.transaction(async (tx) => {
    const mentionUsers = await resolveMentionUsers(tx, {
      tenantId,
      userIds: mentionedUserIds,
    });
    const result = await createTenantCustomerCommentRecord(tx, {
      id: createId(),
      tenantId,
      customerId: customer.id,
      authorUserId: input.authContext.userId,
      body,
      idempotencyKey: input.data.idempotencyKey,
    });
    if (!result.comment) {
      throw new TenantCustomersError(
        "COMMENT_IDEMPOTENCY_CONFLICT",
        "The comment could not be replayed safely.",
        409,
      );
    }
    if (!result.created && result.comment.body !== body) {
      throw new TenantCustomersError(
        "COMMENT_IDEMPOTENCY_CONFLICT",
        "The idempotency key has already been used for another comment.",
        409,
      );
    }
    const existingMentionIds = await listTenantCustomerCommentMentionIds(tx, {
      tenantId,
      commentId: result.comment.id,
    });
    if (
      !result.created &&
      !sameStringSet(existingMentionIds, mentionedUserIds)
    ) {
      throw new TenantCustomersError(
        "COMMENT_IDEMPOTENCY_CONFLICT",
        "The idempotency key has already been used with different mentions.",
        409,
      );
    }
    const existingAttachments = await findTenantCustomerCommentAttachments(tx, {
      tenantId,
      commentId: result.comment.id,
    });
    if (
      !result.created &&
      !sameStringSet(
        existingAttachments.map(({ objectKey }) => objectKey),
        attachments.map(({ objectKey }) => objectKey),
      )
    ) {
      throw new TenantCustomersError(
        "COMMENT_IDEMPOTENCY_CONFLICT",
        "The idempotency key has already been used with different attachments.",
        409,
      );
    }

    let boundAttachments = existingAttachments;
    if (result.created) {
      await Promise.all(
        attachments.map(({ objectKey }) =>
          mediaService!.assertOwnedPendingAndUploaded({
            tenantId,
            objectKey,
            expectedPurpose: "customer_comment_attachment",
            expectedCreatedBy: input.authContext.userId,
          }),
        ),
      );
      await replaceTenantCustomerCommentMentions(tx, {
        tenantId,
        commentId: result.comment.id,
        userIds: mentionedUserIds,
      });
      boundAttachments = await bindTenantCustomerCommentAttachments(tx, {
        tenantId,
        commentId: result.comment.id,
        actorUserId: input.authContext.userId,
        attachments,
      });
      await writeAuditLog(tx, {
        tenantId,
        actorUserId: input.authContext.userId,
        eventCategory: "tenant_customer",
        eventType: "tenant.customer.comment_created",
        entityType: "customer",
        entityId: customer.id,
        metadata: {
          commentId: result.comment.id,
          mentionedUserIds,
          attachmentIds: boundAttachments.map(({ id }) => id),
        },
        ipAddress: input.requestMeta?.ipAddress,
        userAgent: input.requestMeta?.userAgent,
      });
      await notifyMentionedUsers(tx, {
        tenantId,
        customerId: customer.id,
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
      eventType: "tenant.customer.comment_created",
      actorUserId: input.authContext.userId,
      actorDisplayName: input.authContext.displayName,
      actorAvatarUrl: null,
      data: {},
      body: result.comment.body,
      editedAt: result.comment.editedAt?.toISOString() ?? null,
      version: result.comment.version,
      mentions: toCommentMentions(mentionUsers, mentionedUserIds),
      attachments: await toAttachmentDtos(
        tenantId,
        boundAttachments,
        mediaService,
      ),
      canEdit: true,
      canDelete: true,
      occurredAt: result.comment.createdAt.toISOString(),
    };
  });
}

export async function updateTenantCustomerComment(
  input: UpdateTenantCustomerCommentInput,
  db: Database = getDb(),
): Promise<TenantCustomerTimelineItem> {
  const customer = await getTenantCustomerDetail(
    input.authContext,
    input.customerId,
    db,
  );
  const tenantId = input.authContext.tenantId!;
  const mentionedUserIds = Array.from(
    new Set(input.data.mentionedUserIds ?? []),
  );

  return db.transaction(async (tx) => {
    const comment = await findTenantCustomerCommentForMutation(tx, {
      tenantId,
      customerId: customer.id,
      commentId: input.commentId,
    });
    if (!comment) {
      throw new TenantCustomersError(
        "COMMENT_NOT_FOUND",
        "Comment was not found.",
        404,
      );
    }
    if (comment.authorUserId !== input.authContext.userId) {
      throw new TenantCustomersError(
        "COMMENT_FORBIDDEN",
        "Only the comment author can edit this comment.",
        403,
      );
    }
    if (comment.version !== input.data.version) {
      throw new TenantCustomersError(
        "COMMENT_VERSION_CONFLICT",
        "The comment has changed. Refresh and try again.",
        409,
      );
    }
    const [mentionUsers, previousMentionIds, attachments] = await Promise.all([
      resolveMentionUsers(tx, { tenantId, userIds: mentionedUserIds }),
      listTenantCustomerCommentMentionIds(tx, {
        tenantId,
        commentId: comment.id,
      }),
      findTenantCustomerCommentAttachments(tx, {
        tenantId,
        commentId: comment.id,
      }),
    ]);
    const updated = await updateTenantCustomerCommentRecord(tx, {
      tenantId,
      customerId: customer.id,
      commentId: comment.id,
      body: input.data.body.trim(),
      version: input.data.version,
    });
    if (!updated) {
      throw new TenantCustomersError(
        "COMMENT_VERSION_CONFLICT",
        "The comment has changed. Refresh and try again.",
        409,
      );
    }
    await replaceTenantCustomerCommentMentions(tx, {
      tenantId,
      commentId: comment.id,
      userIds: mentionedUserIds,
    });
    await writeAuditLog(tx, {
      tenantId,
      actorUserId: input.authContext.userId,
      eventCategory: "tenant_customer",
      eventType: "tenant.customer.comment_updated",
      entityType: "customer",
      entityId: customer.id,
      metadata: { commentId: comment.id, mentionedUserIds },
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });
    const previous = new Set(previousMentionIds);
    await notifyMentionedUsers(tx, {
      tenantId,
      customerId: customer.id,
      commentId: comment.id,
      commentVersion: updated.version,
      senderUserId: input.authContext.userId,
      senderDisplayName: input.authContext.displayName,
      users: mentionUsers.filter(({ userId }) => !previous.has(userId)),
    });
    return {
      id: updated.id,
      kind: "comment",
      source: "comment",
      eventType: "tenant.customer.comment_created",
      actorUserId: updated.authorUserId,
      actorDisplayName: input.authContext.displayName,
      actorAvatarUrl: null,
      data: {},
      body: updated.body,
      editedAt: updated.editedAt?.toISOString() ?? null,
      version: updated.version,
      mentions: toCommentMentions(mentionUsers, mentionedUserIds),
      attachments: await toAttachmentDtos(tenantId, attachments),
      canEdit: true,
      canDelete: true,
      occurredAt: updated.createdAt.toISOString(),
    };
  });
}

export async function deleteTenantCustomerComment(
  input: DeleteTenantCustomerCommentInput,
  db: Database = getDb(),
) {
  const customer = await getTenantCustomerDetail(
    input.authContext,
    input.customerId,
    db,
  );
  const tenantId = input.authContext.tenantId!;
  await db.transaction(async (tx) => {
    const comment = await findTenantCustomerCommentForMutation(tx, {
      tenantId,
      customerId: customer.id,
      commentId: input.commentId,
    });
    if (!comment) {
      throw new TenantCustomersError(
        "COMMENT_NOT_FOUND",
        "Comment was not found.",
        404,
      );
    }
    const canDelete =
      comment.authorUserId === input.authContext.userId ||
      input.authContext.role === "owner";
    if (!canDelete) {
      throw new TenantCustomersError(
        "COMMENT_FORBIDDEN",
        "Only the author or tenant owner can delete this comment.",
        403,
      );
    }
    if (comment.version !== input.data.version) {
      throw new TenantCustomersError(
        "COMMENT_VERSION_CONFLICT",
        "The comment has changed. Refresh and try again.",
        409,
      );
    }
    const deleted = await softDeleteTenantCustomerCommentRecord(tx, {
      tenantId,
      customerId: customer.id,
      commentId: comment.id,
      actorUserId: input.authContext.userId,
      version: input.data.version,
    });
    if (!deleted) {
      throw new TenantCustomersError(
        "COMMENT_VERSION_CONFLICT",
        "The comment has changed. Refresh and try again.",
        409,
      );
    }
    await writeAuditLog(tx, {
      tenantId,
      actorUserId: input.authContext.userId,
      eventCategory: "tenant_customer",
      eventType: "tenant.customer.comment_deleted",
      entityType: "customer",
      entityId: customer.id,
      metadata: { commentId: comment.id },
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });
  });
}

export async function requestTenantCustomerAttachmentUpload(
  authContext: TenantCustomerTimelineInput["authContext"],
  customerId: string,
  data: TenantCustomerAttachmentUploadRequest,
  db: Database = getDb(),
  mediaService: MediaService = new MediaService(),
): Promise<TenantCustomerAttachmentUploadTicket> {
  await getTenantCustomerDetail(authContext, customerId, db);
  return mediaService.requestUpload({
    tenantId: authContext.tenantId!,
    actorUserId: authContext.userId,
    purpose: "customer_comment_attachment",
    contentType: data.contentType,
    sizeBytes: data.sizeBytes,
    entityId: customerId,
  });
}
