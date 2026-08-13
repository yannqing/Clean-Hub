import { createLogger, type AppLogger } from "@cleanhub/logger";

import type { ChannelAdapter } from "./channel-adapter.js";
import { EmailAdapter } from "./email.adapter.js";
import { loadEmailConfig, type EmailConfig } from "./email-config.js";
import {
  buildLocaleCandidates,
  normalizeLocale,
  renderNotificationTemplate,
} from "./notification-renderer.js";
import { NotificationsRepository } from "./notifications.repository.js";
import { PushAdapter, PushSendError } from "./push.adapter.js";
import {
  loadPushConfig,
  loadPushRetrySettings,
  type PushConfig,
} from "./push-config.js";
import type {
  DeliveryWorkItem,
  NotificationChannel,
  NotificationConfigRecord,
  NotificationDeliveryRecord,
  NotificationDeliveryRunResult,
  NotificationEnqueueResult,
  NotificationEvent,
  NotificationPublishResult,
  NotificationRecipientType,
  NotificationRecord,
  OverdueTicketEventSource,
  PushTokenRecord,
} from "./notifications.types.js";

export type NotificationPublisher = {
  publish(event: NotificationEvent): Promise<NotificationPublishResult>;
};

export type NotificationsRepositoryLike = Pick<
  NotificationsRepository,
  | "listEnabledConfigsForEvent"
  | "getTenantDefaultLocale"
  | "findTemplate"
  | "createNotificationWithDelivery"
  | "isTenantNotificationsEnabled"
  | "getTenantNotificationSettings"
  | "findCustomerEmail"
  | "findUserEmail"
  | "isUserPreferenceEnabled"
  | "countRecentDeliveries"
  | "listClaimableEmailDeliveries"
  | "listClaimablePushDeliveries"
  | "listPushTokensForDelivery"
  | "softDeletePushTokens"
  | "markDeliverySent"
  | "markDeliveryFailed"
  | "skipDelivery"
  | "listOverdueTicketEventSources"
>;

export type NotificationsServiceOptions = {
  repository?: NotificationsRepositoryLike;
  emailAdapter?: ChannelAdapter;
  emailConfig?: EmailConfig;
  pushAdapter?: ChannelAdapter;
  pushConfig?: PushConfig;
  env?: NodeJS.ProcessEnv;
  logger?: Pick<AppLogger, "info" | "warn" | "error">;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class NotificationsService implements NotificationPublisher {
  private readonly repository: NotificationsRepositoryLike;
  private readonly logger: Pick<AppLogger, "info" | "warn" | "error">;
  private readonly env: NodeJS.ProcessEnv;
  private emailAdapter?: ChannelAdapter;
  private emailConfig?: EmailConfig;
  private pushAdapter?: ChannelAdapter;
  private pushConfig?: PushConfig;

  constructor(options: NotificationsServiceOptions = {}) {
    this.repository = options.repository ?? new NotificationsRepository();
    this.emailAdapter = options.emailAdapter;
    this.emailConfig = options.emailConfig;
    this.pushAdapter = options.pushAdapter;
    this.pushConfig = options.pushConfig;
    this.env = options.env ?? process.env;
    this.logger =
      options.logger ??
      createLogger({ name: "notifications", service: "cleanhub-api" });
  }

  async publish(event: NotificationEvent): Promise<NotificationPublishResult> {
    const configs = await this.repository.listEnabledConfigsForEvent({
      tenantId: event.tenantId,
      triggerEvent: event.name,
    });
    const result: NotificationPublishResult = {
      matched: configs.length,
      enqueued: 0,
      skipped: 0,
      idempotent: 0,
    };

    if (configs.length === 0) {
      this.logger.info(
        { tenantId: event.tenantId, eventName: event.name },
        "Notification event has no enabled configs",
      );
      return result;
    }

    const tenantDefaultLocale =
      (await this.repository.getTenantDefaultLocale(event.tenantId)) ??
      this.getDefaultLocale();

    for (const config of configs) {
      const enqueueResult = await this.enqueueForConfig({
        event,
        config,
        tenantDefaultLocale,
      });

      if (!enqueueResult) {
        result.skipped += 1;
        continue;
      }

      if (enqueueResult.idempotent) {
        result.idempotent += 1;
      } else {
        result.enqueued += 1;
      }
    }

    return result;
  }

  async processEmailDeliveries(
    input: {
      now?: Date;
      limit?: number;
      leaseSeconds?: number;
    } = {},
  ): Promise<NotificationDeliveryRunResult> {
    const now = input.now ?? new Date();
    const leaseUntil = new Date(
      now.getTime() + (input.leaseSeconds ?? 5 * 60) * 1000,
    );
    const workItems = await this.repository.listClaimableEmailDeliveries({
      now,
      limit: input.limit ?? 50,
      leaseUntil,
    });
    const result: NotificationDeliveryRunResult = {
      claimed: workItems.length,
      sent: 0,
      failed: 0,
      skipped: 0,
    };

    for (const item of workItems) {
      const itemResult = await this.processEmailDelivery(item, now);

      result[itemResult] += 1;
    }

    return result;
  }

  async processPushDeliveries(
    input: {
      now?: Date;
      limit?: number;
      leaseSeconds?: number;
    } = {},
  ): Promise<NotificationDeliveryRunResult> {
    const now = input.now ?? new Date();
    const leaseUntil = new Date(
      now.getTime() + (input.leaseSeconds ?? 5 * 60) * 1000,
    );
    const workItems = await this.repository.listClaimablePushDeliveries({
      now,
      limit: input.limit ?? 50,
      leaseUntil,
    });
    const result: NotificationDeliveryRunResult = {
      claimed: workItems.length,
      sent: 0,
      failed: 0,
      skipped: 0,
    };

    for (const item of workItems) {
      const itemResult = await this.processPushDelivery(item, now);

      result[itemResult] += 1;
    }

    return result;
  }

  async publishOverdueTicketEvents(
    input: {
      now?: Date;
      limit?: number;
    } = {},
  ): Promise<NotificationPublishResult> {
    const now = input.now ?? new Date();
    const sources = await this.repository.listOverdueTicketEventSources({
      now,
      limit: input.limit ?? 100,
    });
    const total: NotificationPublishResult = {
      matched: 0,
      enqueued: 0,
      skipped: 0,
      idempotent: 0,
    };

    for (const source of sources) {
      const result = await this.publish(toOverdueTicketEvent(source));

      total.matched += result.matched;
      total.enqueued += result.enqueued;
      total.skipped += result.skipped;
      total.idempotent += result.idempotent;
    }

    return total;
  }

  private async enqueueForConfig(input: {
    event: NotificationEvent;
    config: NotificationConfigRecord;
    tenantDefaultLocale: string;
  }): Promise<NotificationEnqueueResult | null> {
    const recipientId = this.resolveRecipientId(input.event, input.config);

    if (!recipientId && requiresConcreteRecipient(input.config.recipientType)) {
      this.logger.warn(
        {
          tenantId: input.event.tenantId,
          eventName: input.event.name,
          configId: input.config.id,
          recipientType: input.config.recipientType,
        },
        "Notification skipped because no recipient id was available",
      );
      return null;
    }

    const localeCandidates = buildLocaleCandidates({
      requestedLocale: input.event.locale,
      tenantDefaultLocale: input.tenantDefaultLocale,
      fallbackLocale: this.getDefaultLocale(),
    });
    const template = await this.repository.findTemplate({
      tenantId: input.event.tenantId,
      templateCode: input.config.templateCode,
      localeCandidates,
    });

    if (!template) {
      this.logger.warn(
        {
          tenantId: input.event.tenantId,
          eventName: input.event.name,
          configId: input.config.id,
          templateCode: input.config.templateCode,
        },
        "Notification skipped because template was not found",
      );
      return null;
    }

    const payload = {
      eventName: input.event.name,
      tenantId: input.event.tenantId,
      branchId: input.event.branchId ?? null,
      customerId: input.event.customerId ?? null,
      userId: input.event.userId ?? null,
      relatedType: input.event.relatedType ?? null,
      relatedId: input.event.relatedId ?? null,
      occurredAt: (input.event.occurredAt ?? new Date()).toISOString(),
      ...(input.event.payload ?? {}),
    };
    const rendered = renderNotificationTemplate(
      template,
      payload,
      input.event.locale ?? input.tenantDefaultLocale,
    );
    const idempotencyKey = buildNotificationIdempotencyKey(
      input.event,
      input.config,
    );
    const created = await this.repository.createNotificationWithDelivery({
      tenantId: input.event.tenantId,
      config: input.config,
      template,
      relatedType: input.event.relatedType,
      relatedId: input.event.relatedId,
      title: rendered.title,
      content: rendered.content,
      locale: rendered.locale,
      payload,
      priority: "normal",
      idempotencyKey,
      recipientId,
    });

    this.logger.info(
      {
        tenantId: input.event.tenantId,
        eventName: input.event.name,
        configId: input.config.id,
        notificationId: created.notification.id,
        deliveryId: created.delivery?.id,
        idempotent: created.idempotent,
        fallbackUsed: rendered.fallbackUsed,
      },
      "Notification enqueued",
    );

    return created;
  }

  private async processEmailDelivery(
    item: DeliveryWorkItem,
    now: Date,
  ): Promise<"sent" | "failed" | "skipped"> {
    const validation = await this.validateEmailDelivery(item, now);

    if (!validation.ok) {
      await this.repository.skipDelivery({
        tenantId: item.delivery.tenantId,
        deliveryId: item.delivery.id,
        reason: validation.reason,
        now,
      });
      this.logger.info(
        {
          tenantId: item.delivery.tenantId,
          deliveryId: item.delivery.id,
          reason: validation.reason,
        },
        "Email notification delivery skipped",
      );
      return "skipped";
    }

    try {
      const sendResult = await this.getEmailAdapter().send({
        deliveryId: item.delivery.id,
        to: validation.to,
        subject: item.notification.title,
        text: item.notification.content,
      });

      await this.repository.markDeliverySent({
        tenantId: item.delivery.tenantId,
        deliveryId: item.delivery.id,
        externalId: sendResult.externalId,
        now,
      });
      this.logger.info(
        {
          tenantId: item.delivery.tenantId,
          deliveryId: item.delivery.id,
          externalId: sendResult.externalId,
        },
        "Email notification sent",
      );
      return "sent";
    } catch (error) {
      await this.markDeliverySendFailure(item.delivery, error, now, "email");
      return "failed";
    }
  }

  private async processPushDelivery(
    item: DeliveryWorkItem,
    now: Date,
  ): Promise<"sent" | "failed" | "skipped"> {
    const validation = await this.validatePushDelivery(item, now);

    if (!validation.ok) {
      await this.repository.skipDelivery({
        tenantId: item.delivery.tenantId,
        deliveryId: item.delivery.id,
        reason: validation.reason,
        now,
      });
      this.logger.info(
        {
          tenantId: item.delivery.tenantId,
          deliveryId: item.delivery.id,
          reason: validation.reason,
        },
        "Push notification delivery skipped",
      );
      return "skipped";
    }

    let adapter: ChannelAdapter;

    try {
      adapter = this.getPushAdapter();
    } catch (error) {
      // Missing FCM credentials: fail the delivery (retried later) instead of
      // crashing the process.
      await this.markDeliverySendFailure(item.delivery, error, now, "push");
      return "failed";
    }

    const data = buildPushData(item.notification);
    const invalidTokenIds: string[] = [];
    let sentExternalId: string | null = null;
    let transientError: unknown = null;

    for (const pushToken of validation.tokens) {
      try {
        const sendResult = await adapter.send({
          deliveryId: item.delivery.id,
          to: pushToken.token,
          subject: item.notification.title,
          text: item.notification.content,
          data,
        });

        sentExternalId ??= sendResult.externalId;
      } catch (error) {
        if (error instanceof PushSendError && error.isTokenInvalid) {
          invalidTokenIds.push(pushToken.id);
          continue;
        }

        transientError = error;
      }
    }

    if (invalidTokenIds.length > 0) {
      await this.repository.softDeletePushTokens({
        tenantId: item.delivery.tenantId,
        tokenIds: invalidTokenIds,
        now,
      });
      this.logger.warn(
        {
          tenantId: item.delivery.tenantId,
          deliveryId: item.delivery.id,
          invalidTokenIds,
        },
        "Push tokens invalidated by FCM and soft deleted",
      );
    }

    if (sentExternalId) {
      await this.repository.markDeliverySent({
        tenantId: item.delivery.tenantId,
        deliveryId: item.delivery.id,
        externalId: sentExternalId,
        now,
      });
      this.logger.info(
        {
          tenantId: item.delivery.tenantId,
          deliveryId: item.delivery.id,
          externalId: sentExternalId,
          tokenCount: validation.tokens.length,
          invalidTokenCount: invalidTokenIds.length,
        },
        "Push notification sent",
      );
      return "sent";
    }

    if (transientError) {
      await this.markDeliverySendFailure(
        item.delivery,
        transientError,
        now,
        "push",
      );
      return "failed";
    }

    await this.repository.skipDelivery({
      tenantId: item.delivery.tenantId,
      deliveryId: item.delivery.id,
      reason: "push_tokens_invalid",
      now,
    });
    this.logger.info(
      {
        tenantId: item.delivery.tenantId,
        deliveryId: item.delivery.id,
      },
      "Push notification delivery skipped because every token was invalid",
    );
    return "skipped";
  }

  private async validatePushDelivery(
    item: DeliveryWorkItem,
    now: Date,
  ): Promise<
    { ok: true; tokens: PushTokenRecord[] } | { ok: false; reason: string }
  > {
    if (
      !(await this.repository.isTenantNotificationsEnabled(
        item.delivery.tenantId,
      ))
    ) {
      return { ok: false, reason: "tenant_notifications_disabled" };
    }

    const settings = await this.repository.getTenantNotificationSettings(
      item.delivery.tenantId,
    );

    if (
      isChannelDisabledBySettings(
        settings,
        "push",
        item.config?.triggerEvent ?? null,
      )
    ) {
      return { ok: false, reason: "notification_settings_disabled" };
    }

    if (!item.delivery.recipientId) {
      return { ok: false, reason: "recipient_id_missing" };
    }

    if (
      item.delivery.recipientType === "user" &&
      !(await this.repository.isUserPreferenceEnabled({
        tenantId: item.delivery.tenantId,
        userId: item.delivery.recipientId,
        noticeType: item.notification.noticeType,
        channel: "push",
      }))
    ) {
      return { ok: false, reason: "recipient_preference_disabled" };
    }

    if (item.config?.frequencyLimit && item.config.frequencyWindowMinutes) {
      const since = new Date(
        now.getTime() - item.config.frequencyWindowMinutes * 60_000,
      );
      const count = await this.repository.countRecentDeliveries({
        tenantId: item.delivery.tenantId,
        configId: item.config.id,
        recipientType: item.delivery.recipientType,
        recipientId: item.delivery.recipientId,
        since,
        excludeDeliveryId: item.delivery.id,
      });

      if (count >= item.config.frequencyLimit) {
        return { ok: false, reason: "frequency_limit_exceeded" };
      }
    }

    const tokens = await this.repository.listPushTokensForDelivery({
      tenantId: item.delivery.tenantId,
      recipientType: item.delivery.recipientType,
      recipientId: item.delivery.recipientId,
    });

    if (tokens.length === 0) {
      return { ok: false, reason: "no_push_tokens" };
    }

    return { ok: true, tokens };
  }

  private async validateEmailDelivery(
    item: DeliveryWorkItem,
    now: Date,
  ): Promise<{ ok: true; to: string } | { ok: false; reason: string }> {
    if (
      !(await this.repository.isTenantNotificationsEnabled(
        item.delivery.tenantId,
      ))
    ) {
      return { ok: false, reason: "tenant_notifications_disabled" };
    }

    const settings = await this.repository.getTenantNotificationSettings(
      item.delivery.tenantId,
    );

    if (
      isChannelDisabledBySettings(
        settings,
        "email",
        item.config?.triggerEvent ?? null,
      )
    ) {
      return { ok: false, reason: "notification_settings_disabled" };
    }

    const recipientEmail = await this.resolveRecipientEmail(item);

    if (!recipientEmail || !EMAIL_PATTERN.test(recipientEmail)) {
      return { ok: false, reason: "recipient_email_invalid" };
    }

    if (
      item.delivery.recipientType === "user" &&
      item.delivery.recipientId &&
      !(await this.repository.isUserPreferenceEnabled({
        tenantId: item.delivery.tenantId,
        userId: item.delivery.recipientId,
        noticeType: item.notification.noticeType,
        channel: "email",
      }))
    ) {
      return { ok: false, reason: "recipient_preference_disabled" };
    }

    if (item.config?.frequencyLimit && item.config.frequencyWindowMinutes) {
      const since = new Date(
        now.getTime() - item.config.frequencyWindowMinutes * 60_000,
      );
      const count = await this.repository.countRecentDeliveries({
        tenantId: item.delivery.tenantId,
        configId: item.config.id,
        recipientType: item.delivery.recipientType,
        recipientId: item.delivery.recipientId,
        since,
        excludeDeliveryId: item.delivery.id,
      });

      if (count >= item.config.frequencyLimit) {
        return { ok: false, reason: "frequency_limit_exceeded" };
      }
    }

    return { ok: true, to: recipientEmail };
  }

  private async resolveRecipientEmail(
    item: DeliveryWorkItem,
  ): Promise<string | null> {
    if (
      item.delivery.recipientType === "customer" &&
      item.delivery.recipientId
    ) {
      return this.repository.findCustomerEmail({
        tenantId: item.delivery.tenantId,
        customerId: item.delivery.recipientId,
      });
    }

    if (item.delivery.recipientType === "user" && item.delivery.recipientId) {
      return this.repository.findUserEmail({
        tenantId: item.delivery.tenantId,
        userId: item.delivery.recipientId,
      });
    }

    return null;
  }

  private async markDeliverySendFailure(
    delivery: NotificationDeliveryRecord,
    error: unknown,
    now: Date,
    channel: NotificationChannel,
  ): Promise<void> {
    const retrySettings = this.getRetrySettings(channel);
    const attemptAfterFailure = delivery.attemptCount + 1;
    const nextRetryAt =
      attemptAfterFailure >= delivery.maxAttempts
        ? null
        : new Date(
            now.getTime() +
              getBackoffSeconds(
                attemptAfterFailure,
                retrySettings.retryBaseSeconds,
                retrySettings.retryMaxSeconds,
              ) *
                1000,
          );
    const failedReason =
      error instanceof Error
        ? error.message
        : `${channel === "push" ? "Push" : "Email"} delivery failed.`;

    await this.repository.markDeliveryFailed({
      delivery,
      failedReason,
      nextRetryAt,
      now,
    });
    this.logger.error(
      {
        error,
        tenantId: delivery.tenantId,
        deliveryId: delivery.id,
        channel,
        attemptAfterFailure,
        nextRetryAt: nextRetryAt?.toISOString() ?? null,
      },
      "Notification delivery failed",
    );
  }

  private getRetrySettings(channel: NotificationChannel): {
    retryBaseSeconds: number;
    retryMaxSeconds: number;
  } {
    if (channel === "push") {
      return loadPushRetrySettings(this.env);
    }

    return this.getEmailConfig();
  }

  private resolveRecipientId(
    event: NotificationEvent,
    config: NotificationConfigRecord,
  ): string | null {
    if (config.recipientType === "customer") {
      return event.customerId ?? null;
    }

    if (config.recipientType === "user") {
      return config.recipientUserId ?? event.userId ?? null;
    }

    return null;
  }

  private getDefaultLocale(): string {
    return (
      normalizeLocale(this.emailConfig?.defaultLocale) ??
      normalizeLocale(this.env.EMAIL_DEFAULT_LOCALE) ??
      "en"
    );
  }

  private getEmailConfig(): EmailConfig {
    this.emailConfig ??= loadEmailConfig(this.env);
    return this.emailConfig;
  }

  private getEmailAdapter(): ChannelAdapter {
    this.emailAdapter ??= new EmailAdapter(this.getEmailConfig());
    return this.emailAdapter;
  }

  private getPushConfig(): PushConfig {
    this.pushConfig ??= loadPushConfig(this.env);
    return this.pushConfig;
  }

  private getPushAdapter(): ChannelAdapter {
    this.pushAdapter ??= new PushAdapter(this.getPushConfig());
    return this.pushAdapter;
  }
}

export function createNotificationsServiceFromEnv(
  options: Omit<NotificationsServiceOptions, "env"> = {},
): NotificationsService {
  return new NotificationsService(options);
}

function requiresConcreteRecipient(type: NotificationRecipientType): boolean {
  return type === "customer" || type === "user";
}

function isChannelDisabledBySettings(
  settings: Record<string, unknown>,
  channel: NotificationChannel,
  triggerEvent: string | null,
): boolean {
  if (
    channel === "email" &&
    (settings.emailEnabled === false || settings.disableEmail === true)
  ) {
    return true;
  }

  if (
    channel === "push" &&
    (settings.pushEnabled === false || settings.disablePush === true)
  ) {
    return true;
  }

  if (readNestedBoolean(settings, ["channels", channel]) === false) {
    return true;
  }

  if (
    triggerEvent &&
    (readNestedBoolean(settings, ["events", triggerEvent, channel]) === false ||
      readNestedBoolean(settings, [triggerEvent, channel]) === false)
  ) {
    return true;
  }

  return false;
}

/**
 * Builds the FCM data payload used by the mobile client for deep-linking.
 * FCM only accepts string values.
 */
function buildPushData(
  notification: NotificationRecord,
): Record<string, string> {
  const data: Record<string, string> = {
    notificationId: notification.id,
  };
  const payload = notification.payload ?? {};

  if (typeof payload.eventName === "string" && payload.eventName) {
    data.eventName = payload.eventName;
  }

  if (notification.relatedType) {
    data.relatedType = notification.relatedType;
  }

  if (notification.relatedId) {
    data.relatedId = notification.relatedId;
  }

  for (const key of ["orderId", "ticketId", "taskId"] as const) {
    const value = payload[key];

    if (typeof value === "string" && value) {
      data[key] = value;
    }
  }

  return data;
}

function readNestedBoolean(
  source: Record<string, unknown>,
  path: string[],
): boolean | undefined {
  let current: unknown = source;

  for (const segment of path) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === "boolean" ? current : undefined;
}

function buildNotificationIdempotencyKey(
  event: NotificationEvent,
  config: NotificationConfigRecord,
): string {
  const base =
    event.idempotencyKey ??
    `${event.name}:${event.relatedType ?? "event"}:${
      event.relatedId ?? event.customerId ?? event.branchId ?? event.tenantId
    }`;
  const key = `${base}:${config.id}`;

  return key.length <= 120 ? key : `notification:${hashString(key)}`;
}

function hashString(input: string): string {
  let hash = 5381;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }

  return Math.abs(hash).toString(36);
}

function getBackoffSeconds(
  attempt: number,
  baseSeconds: number,
  maxSeconds: number,
): number {
  return Math.min(baseSeconds * 2 ** Math.max(0, attempt - 1), maxSeconds);
}

function toOverdueTicketEvent(
  source: OverdueTicketEventSource,
): NotificationEvent {
  return {
    name: "ticket.overdue",
    tenantId: source.tenantId,
    branchId: source.branchId,
    customerId: source.customerId,
    relatedType: "ticket",
    relatedId: source.ticketId,
    idempotencyKey: `ticket.overdue:${source.ticketId}`,
    payload: {
      ticketId: source.ticketId,
      ticketNo: source.ticketNo,
      customerName: source.customerName,
      expectedPickupAt: source.expectedPickupAt?.toISOString() ?? null,
    },
  };
}
