import { createId } from "@cleanhub/id";
import {
  and,
  desc,
  eq,
  getTableColumns,
  gte,
  inArray,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";

import {
  customerAccounts,
  customers,
  getDb,
  mobilePushTokens,
  notificationConfigs,
  notificationDeliveries,
  notificationPreferences,
  notifications,
  notificationSettings,
  notificationTemplates,
  serviceTickets,
  tenantFeatureFlags,
  tenantSettings,
  users,
  type Database,
} from "@cleanhub/db";

import type {
  DeliveryWorkItem,
  NotificationChannel,
  NotificationConfigRecord,
  NotificationDeliveryRecord,
  NotificationDeliveryStatus,
  NotificationPriority,
  NotificationRecord,
  NotificationRecipientType,
  NotificationTemplateRecord,
  OverdueTicketEventSource,
  PushTokenRecord,
} from "./notifications.types.js";

function toConfig(row: {
  config: typeof notificationConfigs.$inferSelect;
  templateCode: string;
}): NotificationConfigRecord {
  return {
    id: row.config.id,
    tenantId: row.config.tenantId,
    templateId: row.config.templateId,
    templateCode: row.templateCode,
    configName: row.config.configName,
    noticeType: row.config.noticeType,
    triggerEvent: row.config.triggerEvent,
    channel: row.config.channel as NotificationChannel,
    recipientType: row.config.recipientType,
    recipientRole: row.config.recipientRole,
    recipientUserId: row.config.recipientUserId,
    frequencyLimit: row.config.frequencyLimit,
    frequencyWindowMinutes: row.config.frequencyWindowMinutes,
  };
}

function toTemplate(
  row: typeof notificationTemplates.$inferSelect,
): NotificationTemplateRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    templateCode: row.templateCode,
    templateName: row.templateName,
    noticeType: row.noticeType,
    locale: row.locale,
    titleTemplate: row.titleTemplate,
    contentTemplate: row.contentTemplate,
  };
}

function toNotification(
  row: typeof notifications.$inferSelect,
): NotificationRecord {
  return {
    id: row.id,
    tenantId: row.tenantId ?? "",
    scope: row.scope,
    noticeType: row.noticeType,
    configId: row.configId,
    templateId: row.templateId,
    relatedType: row.relatedType,
    relatedId: row.relatedId,
    title: row.title,
    content: row.content,
    locale: row.locale,
    payload: row.payload ?? null,
    priority: row.priority,
    idempotencyKey: row.idempotencyKey,
    createdAt: row.createdAt,
  };
}

function toDelivery(
  row: typeof notificationDeliveries.$inferSelect,
): NotificationDeliveryRecord {
  return {
    id: row.id,
    tenantId: row.tenantId ?? "",
    notificationId: row.notificationId,
    channel: row.channel as NotificationChannel,
    recipientType: row.recipientType,
    recipientId: row.recipientId,
    status: row.status,
    priority: row.priority,
    scheduledAt: row.scheduledAt,
    sentAt: row.sentAt,
    attemptCount: row.attemptCount,
    maxAttempts: row.maxAttempts,
    nextRetryAt: row.nextRetryAt,
    externalId: row.externalId,
    failedReason: row.failedReason,
    createdAt: row.createdAt,
  };
}

export class NotificationsRepository {
  constructor(private readonly db: Database = getDb()) {}

  async listEnabledConfigsForEvent(input: {
    tenantId: string;
    triggerEvent: string;
  }): Promise<NotificationConfigRecord[]> {
    const rows = await this.db
      .select({
        config: getTableColumns(notificationConfigs),
        templateCode: notificationTemplates.templateCode,
      })
      .from(notificationConfigs)
      .innerJoin(
        notificationTemplates,
        eq(notificationTemplates.id, notificationConfigs.templateId),
      )
      .where(
        and(
          eq(notificationConfigs.tenantId, input.tenantId),
          eq(notificationConfigs.triggerType, "event"),
          eq(notificationConfigs.triggerEvent, input.triggerEvent),
          inArray(notificationConfigs.channel, ["email", "push"]),
          eq(notificationConfigs.isEnabled, true),
          isNull(notificationConfigs.deletedAt),
          eq(notificationTemplates.isEnabled, true),
          isNull(notificationTemplates.deletedAt),
        ),
      );

    return rows.map(toConfig);
  }

  async getTenantDefaultLocale(tenantId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ defaultLanguage: tenantSettings.defaultLanguage })
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, tenantId))
      .limit(1);

    return row?.defaultLanguage ?? null;
  }

  async findTemplate(input: {
    tenantId: string;
    templateCode: string;
    localeCandidates: string[];
  }): Promise<NotificationTemplateRecord | null> {
    const rows = await this.db
      .select({ ...getTableColumns(notificationTemplates) })
      .from(notificationTemplates)
      .where(
        and(
          or(
            eq(notificationTemplates.tenantId, input.tenantId),
            isNull(notificationTemplates.tenantId),
          ),
          eq(notificationTemplates.templateCode, input.templateCode),
          inArray(notificationTemplates.locale, input.localeCandidates),
          eq(notificationTemplates.isEnabled, true),
          isNull(notificationTemplates.deletedAt),
        ),
      );

    return selectPreferredTemplate(
      rows.map(toTemplate),
      input.localeCandidates,
    );
  }

  async createNotificationWithDelivery(input: {
    tenantId: string;
    config: NotificationConfigRecord;
    template: NotificationTemplateRecord;
    relatedType?: string | null;
    relatedId?: string | null;
    title: string;
    content: string;
    locale: string;
    payload: Record<string, unknown>;
    priority?: NotificationPriority;
    idempotencyKey: string;
    recipientId?: string | null;
  }): Promise<{
    notification: NotificationRecord;
    delivery: NotificationDeliveryRecord | null;
    idempotent: boolean;
  }> {
    const notificationId = createId();
    const deliveryId = createId();

    const inserted = await this.db.transaction(async (tx) => {
      const [notification] = await tx
        .insert(notifications)
        .values({
          id: notificationId,
          tenantId: input.tenantId,
          scope: "mobile",
          noticeType: input.config.noticeType,
          configId: input.config.id,
          templateId: input.template.id,
          relatedType: input.relatedType,
          relatedId: input.relatedId,
          title: input.title,
          content: input.content,
          locale: input.locale,
          payload: input.payload,
          priority: input.priority ?? "normal",
          idempotencyKey: input.idempotencyKey,
        })
        .onConflictDoNothing({
          target: [notifications.tenantId, notifications.idempotencyKey],
        })
        .returning({ ...getTableColumns(notifications) });

      if (!notification) {
        return null;
      }

      const [delivery] = await tx
        .insert(notificationDeliveries)
        .values({
          id: deliveryId,
          tenantId: input.tenantId,
          notificationId: notification.id,
          channel: input.config.channel,
          recipientType: input.config.recipientType,
          recipientId:
            input.config.recipientType === "user"
              ? input.config.recipientUserId
              : input.recipientId,
          senderType: "system",
          status: "pending",
          priority: input.priority ?? "normal",
        })
        .returning({ ...getTableColumns(notificationDeliveries) });

      return { notification, delivery };
    });

    if (inserted) {
      return {
        notification: toNotification(inserted.notification),
        delivery: inserted.delivery ? toDelivery(inserted.delivery) : null,
        idempotent: false,
      };
    }

    const existing = await this.findByIdempotencyKey({
      tenantId: input.tenantId,
      idempotencyKey: input.idempotencyKey,
    });

    if (!existing) {
      throw new Error("Notification insert failed.");
    }

    return {
      ...existing,
      idempotent: true,
    };
  }

  async findByIdempotencyKey(input: {
    tenantId: string;
    idempotencyKey: string;
  }): Promise<{
    notification: NotificationRecord;
    delivery: NotificationDeliveryRecord | null;
  } | null> {
    const [notification] = await this.db
      .select({ ...getTableColumns(notifications) })
      .from(notifications)
      .where(
        and(
          eq(notifications.tenantId, input.tenantId),
          eq(notifications.idempotencyKey, input.idempotencyKey),
          isNull(notifications.deletedAt),
        ),
      )
      .limit(1);

    if (!notification) {
      return null;
    }

    const [delivery] = await this.db
      .select({ ...getTableColumns(notificationDeliveries) })
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.notificationId, notification.id))
      .limit(1);

    return {
      notification: toNotification(notification),
      delivery: delivery ? toDelivery(delivery) : null,
    };
  }

  async isTenantNotificationsEnabled(tenantId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ notificationsEnabled: tenantFeatureFlags.notificationsEnabled })
      .from(tenantFeatureFlags)
      .where(eq(tenantFeatureFlags.tenantId, tenantId))
      .limit(1);

    return row?.notificationsEnabled ?? true;
  }

  async getTenantNotificationSettings(
    tenantId: string,
  ): Promise<Record<string, unknown>> {
    const [row] = await this.db
      .select({ settings: notificationSettings.settings })
      .from(notificationSettings)
      .where(eq(notificationSettings.tenantId, tenantId))
      .limit(1);

    return row?.settings ?? {};
  }

  async findCustomerEmail(input: {
    tenantId: string;
    customerId: string;
  }): Promise<string | null> {
    const [row] = await this.db
      .select({
        email: customers.email,
        customerAccountId: customers.customerAccountId,
      })
      .from(customers)
      .where(
        and(
          eq(customers.tenantId, input.tenantId),
          eq(customers.id, input.customerId),
          eq(customers.status, "active"),
          isNull(customers.deletedAt),
        ),
      )
      .limit(1);

    if (!row) {
      return null;
    }

    if (row.email) {
      return row.email;
    }

    const [account] = await this.db
      .select({ email: customerAccounts.email })
      .from(customerAccounts)
      .where(
        and(
          eq(customerAccounts.tenantId, input.tenantId),
          eq(customerAccounts.id, row.customerAccountId),
          eq(customerAccounts.status, "active"),
          isNull(customerAccounts.deletedAt),
        ),
      )
      .limit(1);

    return account?.email ?? null;
  }

  async findUserEmail(input: {
    tenantId: string;
    userId: string;
  }): Promise<string | null> {
    const [row] = await this.db
      .select({ email: users.email })
      .from(users)
      .where(
        and(
          eq(users.tenantId, input.tenantId),
          eq(users.id, input.userId),
          eq(users.status, "active"),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);

    return row?.email ?? null;
  }

  async isUserPreferenceEnabled(input: {
    tenantId: string;
    userId: string;
    noticeType: "system" | "business";
    channel: NotificationChannel;
  }): Promise<boolean> {
    const [row] = await this.db
      .select({ isEnabled: notificationPreferences.isEnabled })
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.tenantId, input.tenantId),
          eq(notificationPreferences.userId, input.userId),
          eq(notificationPreferences.noticeType, input.noticeType),
          eq(notificationPreferences.channel, input.channel),
          isNull(notificationPreferences.deletedAt),
        ),
      )
      .limit(1);

    return row?.isEnabled ?? true;
  }

  async countRecentDeliveries(input: {
    tenantId: string;
    configId: string;
    recipientType: NotificationRecipientType;
    recipientId: string | null;
    since: Date;
    excludeDeliveryId?: string;
  }): Promise<number> {
    const [row] = await this.db
      .select({ value: sql<number>`count(*)::int` })
      .from(notificationDeliveries)
      .innerJoin(
        notifications,
        eq(notifications.id, notificationDeliveries.notificationId),
      )
      .where(
        and(
          eq(notificationDeliveries.tenantId, input.tenantId),
          eq(notificationDeliveries.recipientType, input.recipientType),
          input.recipientId
            ? eq(notificationDeliveries.recipientId, input.recipientId)
            : isNull(notificationDeliveries.recipientId),
          eq(notifications.configId, input.configId),
          input.excludeDeliveryId
            ? ne(notificationDeliveries.id, input.excludeDeliveryId)
            : undefined,
          gte(notificationDeliveries.createdAt, input.since),
          isNull(notificationDeliveries.deletedAt),
          isNull(notifications.deletedAt),
        ),
      );

    return row?.value ?? 0;
  }

  async listClaimableEmailDeliveries(input: {
    now: Date;
    limit: number;
    leaseUntil: Date;
  }): Promise<DeliveryWorkItem[]> {
    return this.listClaimableDeliveries("email", input);
  }

  async listClaimablePushDeliveries(input: {
    now: Date;
    limit: number;
    leaseUntil: Date;
  }): Promise<DeliveryWorkItem[]> {
    return this.listClaimableDeliveries("push", input);
  }

  async listPushTokensForDelivery(input: {
    tenantId: string;
    recipientType: NotificationRecipientType;
    recipientId: string;
  }): Promise<PushTokenRecord[]> {
    let subjectType: "customer" | "staff";
    let subjectId: string;

    if (input.recipientType === "customer") {
      // Delivery recipients reference customers.id while mobile push tokens
      // are bound to the login subject (customer_accounts.id).
      const [customer] = await this.db
        .select({ customerAccountId: customers.customerAccountId })
        .from(customers)
        .where(
          and(
            eq(customers.tenantId, input.tenantId),
            eq(customers.id, input.recipientId),
            isNull(customers.deletedAt),
          ),
        )
        .limit(1);

      if (!customer?.customerAccountId) {
        return [];
      }

      subjectType = "customer";
      subjectId = customer.customerAccountId;
    } else if (input.recipientType === "user") {
      subjectType = "staff";
      subjectId = input.recipientId;
    } else {
      return [];
    }

    const rows = await this.db
      .select({
        id: mobilePushTokens.id,
        tenantId: mobilePushTokens.tenantId,
        subjectType: mobilePushTokens.subjectType,
        subjectId: mobilePushTokens.subjectId,
        platform: mobilePushTokens.platform,
        token: mobilePushTokens.token,
        deviceId: mobilePushTokens.deviceId,
        locale: mobilePushTokens.locale,
      })
      .from(mobilePushTokens)
      .where(
        and(
          eq(mobilePushTokens.tenantId, input.tenantId),
          eq(mobilePushTokens.subjectType, subjectType),
          eq(mobilePushTokens.subjectId, subjectId),
          isNull(mobilePushTokens.deletedAt),
        ),
      )
      .orderBy(desc(mobilePushTokens.lastSeenAt));

    return rows;
  }

  async softDeletePushTokens(input: {
    tenantId: string;
    tokenIds: string[];
    now: Date;
  }): Promise<void> {
    if (input.tokenIds.length === 0) {
      return;
    }

    await this.db
      .update(mobilePushTokens)
      .set({
        deletedAt: input.now,
        updatedAt: input.now,
      })
      .where(
        and(
          eq(mobilePushTokens.tenantId, input.tenantId),
          inArray(mobilePushTokens.id, input.tokenIds),
          isNull(mobilePushTokens.deletedAt),
        ),
      );
  }

  private async listClaimableDeliveries(
    channel: NotificationChannel,
    input: {
      now: Date;
      limit: number;
      leaseUntil: Date;
    },
  ): Promise<DeliveryWorkItem[]> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select({ id: notificationDeliveries.id })
        .from(notificationDeliveries)
        .where(
          and(
            eq(notificationDeliveries.channel, channel),
            or(
              eq(notificationDeliveries.status, "pending"),
              and(
                eq(notificationDeliveries.status, "failed"),
                lte(notificationDeliveries.nextRetryAt, input.now),
                sql`${notificationDeliveries.attemptCount} < ${notificationDeliveries.maxAttempts}`,
              ),
            ),
            or(
              isNull(notificationDeliveries.scheduledAt),
              lte(notificationDeliveries.scheduledAt, input.now),
            ),
            or(
              isNull(notificationDeliveries.nextRetryAt),
              lte(notificationDeliveries.nextRetryAt, input.now),
            ),
            isNull(notificationDeliveries.deletedAt),
          ),
        )
        .orderBy(notificationDeliveries.createdAt)
        .limit(input.limit)
        .for("update", { skipLocked: true });

      const ids = rows.map((row) => row.id);

      if (ids.length === 0) {
        return [];
      }

      /* tenant-scope: system delivery lease */ await tx
        .update(notificationDeliveries)
        .set({
          nextRetryAt: input.leaseUntil,
          updatedAt: input.now,
        })
        .where(
          and(
            inArray(notificationDeliveries.id, ids),
            or(
              eq(notificationDeliveries.status, "pending"),
              eq(notificationDeliveries.status, "failed"),
            ),
          ),
        );

      const workRows = await tx
        .select({
          delivery: getTableColumns(notificationDeliveries),
          notification: getTableColumns(notifications),
          config: {
            id: notificationConfigs.id,
            triggerEvent: notificationConfigs.triggerEvent,
            frequencyLimit: notificationConfigs.frequencyLimit,
            frequencyWindowMinutes: notificationConfigs.frequencyWindowMinutes,
          },
        })
        .from(notificationDeliveries)
        .innerJoin(
          notifications,
          eq(notifications.id, notificationDeliveries.notificationId),
        )
        .leftJoin(
          notificationConfigs,
          eq(notificationConfigs.id, notifications.configId),
        )
        .where(inArray(notificationDeliveries.id, ids));

      return workRows.map((row) => ({
        delivery: toDelivery(row.delivery),
        notification: toNotification(row.notification),
        config: row.config?.id ? row.config : null,
      }));
    });
  }

  async markDeliverySent(input: {
    tenantId: string;
    deliveryId: string;
    externalId: string;
    now: Date;
  }): Promise<void> {
    await this.updateDeliveryStatus({
      deliveryId: input.deliveryId,
      tenantId: input.tenantId,
      status: "sent",
      now: input.now,
      externalId: input.externalId,
      sentAt: input.now,
      failedReason: null,
      nextRetryAt: null,
      incrementAttempt: true,
    });
  }

  async markDeliveryFailed(input: {
    delivery: NotificationDeliveryRecord;
    failedReason: string;
    nextRetryAt: Date | null;
    now: Date;
  }): Promise<void> {
    await this.updateDeliveryStatus({
      tenantId: input.delivery.tenantId,
      deliveryId: input.delivery.id,
      status: "failed",
      now: input.now,
      failedReason: input.failedReason,
      nextRetryAt: input.nextRetryAt,
      incrementAttempt: true,
    });
  }

  async skipDelivery(input: {
    tenantId: string;
    deliveryId: string;
    reason: string;
    now: Date;
  }): Promise<void> {
    await this.updateDeliveryStatus({
      deliveryId: input.deliveryId,
      tenantId: input.tenantId,
      status: "cancelled",
      now: input.now,
      failedReason: input.reason,
      nextRetryAt: null,
      incrementAttempt: false,
    });
  }

  async listOverdueTicketEventSources(input: {
    now: Date;
    limit: number;
  }): Promise<OverdueTicketEventSource[]> {
    const rows = await this.db
      .select({
        ticketId: serviceTickets.id,
        tenantId: serviceTickets.tenantId,
        branchId: serviceTickets.branchId,
        customerId: serviceTickets.customerId,
        ticketNo: serviceTickets.ticketNo,
        expectedPickupAt: serviceTickets.expectedPickupAt,
        customerName: customers.fullName,
      })
      .from(serviceTickets)
      .innerJoin(customers, eq(customers.id, serviceTickets.customerId))
      .where(
        and(
          eq(serviceTickets.ticketStatus, "ready_to_pick"),
          lte(serviceTickets.expectedPickupAt, input.now),
          isNull(serviceTickets.deletedAt),
          isNull(customers.deletedAt),
        ),
      )
      .orderBy(desc(serviceTickets.expectedPickupAt))
      .limit(input.limit);

    return rows;
  }

  private async updateDeliveryStatus(input: {
    tenantId: string;
    deliveryId: string;
    status: NotificationDeliveryStatus;
    now: Date;
    externalId?: string;
    sentAt?: Date | null;
    failedReason?: string | null;
    nextRetryAt?: Date | null;
    incrementAttempt: boolean;
  }): Promise<void> {
    await this.db
      .update(notificationDeliveries)
      .set({
        status: input.status,
        externalId: input.externalId,
        sentAt: input.sentAt,
        failedReason: input.failedReason,
        nextRetryAt: input.nextRetryAt,
        attemptCount: input.incrementAttempt
          ? sql`${notificationDeliveries.attemptCount} + 1`
          : undefined,
        updatedAt: input.now,
      })
      .where(
        and(
          eq(notificationDeliveries.tenantId, input.tenantId),
          eq(notificationDeliveries.id, input.deliveryId),
        ),
      );
  }
}

function selectPreferredTemplate(
  templates: NotificationTemplateRecord[],
  localeCandidates: string[],
): NotificationTemplateRecord | null {
  for (const locale of localeCandidates) {
    const tenantTemplate = templates.find(
      (row) => row.locale === locale && row.tenantId,
    );

    if (tenantTemplate) {
      return tenantTemplate;
    }

    const template = templates.find((row) => row.locale === locale);

    if (template) {
      return template;
    }
  }

  return templates[0] ?? null;
}
