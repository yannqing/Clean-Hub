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
import type {
  EmailDeliveryWorkItem,
  NotificationConfigRecord,
  NotificationDeliveryRecord,
  NotificationDeliveryRunResult,
  NotificationEnqueueResult,
  NotificationEvent,
  NotificationPublishResult,
  NotificationRecipientType,
  OverdueTicketEventSource,
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
  | "markDeliverySent"
  | "markDeliveryFailed"
  | "skipDelivery"
  | "listOverdueTicketEventSources"
>;

export type NotificationsServiceOptions = {
  repository?: NotificationsRepositoryLike;
  emailAdapter?: ChannelAdapter;
  emailConfig?: EmailConfig;
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

  constructor(options: NotificationsServiceOptions = {}) {
    this.repository = options.repository ?? new NotificationsRepository();
    this.emailAdapter = options.emailAdapter;
    this.emailConfig = options.emailConfig;
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

  async processEmailDeliveries(input: {
    now?: Date;
    limit?: number;
    leaseSeconds?: number;
  } = {}): Promise<NotificationDeliveryRunResult> {
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

  async publishOverdueTicketEvents(input: {
    now?: Date;
    limit?: number;
  } = {}): Promise<NotificationPublishResult> {
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
    item: EmailDeliveryWorkItem,
    now: Date,
  ): Promise<"sent" | "failed" | "skipped"> {
    const validation = await this.validateEmailDelivery(item, now);

    if (!validation.ok) {
      await this.repository.skipDelivery({
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
      await this.markDeliverySendFailure(item.delivery, error, now);
      return "failed";
    }
  }

  private async validateEmailDelivery(
    item: EmailDeliveryWorkItem,
    now: Date,
  ): Promise<{ ok: true; to: string } | { ok: false; reason: string }> {
    if (!(await this.repository.isTenantNotificationsEnabled(item.delivery.tenantId))) {
      return { ok: false, reason: "tenant_notifications_disabled" };
    }

    const settings = await this.repository.getTenantNotificationSettings(
      item.delivery.tenantId,
    );

    if (isEmailDisabledBySettings(settings, item.config?.triggerEvent ?? null)) {
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
    item: EmailDeliveryWorkItem,
  ): Promise<string | null> {
    if (item.delivery.recipientType === "customer" && item.delivery.recipientId) {
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
  ): Promise<void> {
    const attemptAfterFailure = delivery.attemptCount + 1;
    const nextRetryAt =
      attemptAfterFailure >= delivery.maxAttempts
        ? null
        : new Date(
            now.getTime() +
              getBackoffSeconds(
                attemptAfterFailure,
                this.getEmailConfig().retryBaseSeconds,
                this.getEmailConfig().retryMaxSeconds,
              ) *
                1000,
          );
    const failedReason =
      error instanceof Error ? error.message : "Email delivery failed.";

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
        attemptAfterFailure,
        nextRetryAt: nextRetryAt?.toISOString() ?? null,
      },
      "Email notification delivery failed",
    );
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
}

export function createNotificationsServiceFromEnv(
  options: Omit<NotificationsServiceOptions, "env"> = {},
): NotificationsService {
  return new NotificationsService(options);
}

function requiresConcreteRecipient(type: NotificationRecipientType): boolean {
  return type === "customer" || type === "user";
}

function isEmailDisabledBySettings(
  settings: Record<string, unknown>,
  triggerEvent: string | null,
): boolean {
  if (settings.emailEnabled === false || settings.disableEmail === true) {
    return true;
  }

  if (readNestedBoolean(settings, ["channels", "email"]) === false) {
    return true;
  }

  if (
    triggerEvent &&
    (readNestedBoolean(settings, ["events", triggerEvent, "email"]) === false ||
      readNestedBoolean(settings, [triggerEvent, "email"]) === false)
  ) {
    return true;
  }

  return false;
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
