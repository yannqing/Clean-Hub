import assert from "node:assert/strict";

import type { ChannelAdapter, ChannelSendInput } from "./channel-adapter.js";
import { orderCreatedEvent } from "./notification-events.js";
import type { NotificationsRepositoryLike } from "./notifications.service.js";
import { NotificationsService } from "./notifications.service.js";
import type {
  EmailDeliveryWorkItem,
  NotificationConfigRecord,
  NotificationDeliveryRecord,
  NotificationEvent,
  NotificationRecord,
  NotificationTemplateRecord,
  OverdueTicketEventSource,
} from "./notifications.types.js";

const tenantId = "tenant_1";
const customerId = "customer_1";

function createConfig(
  overrides: Partial<NotificationConfigRecord> = {},
): NotificationConfigRecord {
  return {
    id: "config_1",
    tenantId,
    templateId: "template_en",
    templateCode: "email.order.created",
    configName: "Order created email",
    noticeType: "business",
    triggerEvent: "order.created",
    channel: "email",
    recipientType: "customer",
    recipientRole: null,
    recipientUserId: null,
    frequencyLimit: null,
    frequencyWindowMinutes: null,
    ...overrides,
  };
}

function createTemplate(
  locale: string,
  overrides: Partial<NotificationTemplateRecord> = {},
): NotificationTemplateRecord {
  return {
    id: `template_${locale}`,
    tenantId: null,
    templateCode: "email.order.created",
    templateName: `Template ${locale}`,
    noticeType: "business",
    locale,
    titleTemplate: "Order {{orderNo}}",
    contentTemplate: "Hello {{customerName}}, total {{totalAmount}}",
    ...overrides,
  };
}

function createEvent(overrides: Partial<NotificationEvent> = {}): NotificationEvent {
  const base = orderCreatedEvent({
    tenantId,
    branchId: "branch_1",
    customerId,
    orderId: "order_1",
    orderNo: "A-100",
    totalAmount: "42.00",
  });

  return {
    ...base,
    ...overrides,
  };
}

function createNotification(
  overrides: Partial<NotificationRecord> = {},
): NotificationRecord {
  return {
    id: "notification_1",
    tenantId,
    scope: "mobile",
    noticeType: "business",
    configId: "config_1",
    templateId: "template_en",
    relatedType: "order",
    relatedId: "order_1",
    title: "Order A-100",
    content: "Hello Ada, total 42.00",
    locale: "en",
    payload: {},
    priority: "normal",
    idempotencyKey: "order.created:order_1:config_1",
    createdAt: new Date(),
    ...overrides,
  };
}

function createDelivery(
  overrides: Partial<NotificationDeliveryRecord> = {},
): NotificationDeliveryRecord {
  return {
    id: "delivery_1",
    tenantId,
    notificationId: "notification_1",
    channel: "email",
    recipientType: "customer",
    recipientId: customerId,
    status: "pending",
    priority: "normal",
    scheduledAt: null,
    sentAt: null,
    attemptCount: 0,
    maxAttempts: 3,
    nextRetryAt: null,
    externalId: null,
    failedReason: null,
    createdAt: new Date(),
    ...overrides,
  };
}

class MemoryNotificationsRepository implements NotificationsRepositoryLike {
  configs: NotificationConfigRecord[] = [createConfig()];
  templates: NotificationTemplateRecord[] = [
    createTemplate("en"),
    createTemplate("fr", {
      titleTemplate: "Commande {{orderNo}}",
      contentTemplate: "Bonjour {{customerName}}, total {{totalAmount}}",
    }),
  ];
  notifications = new Map<string, NotificationRecord>();
  deliveries = new Map<string, NotificationDeliveryRecord>();
  tenantEnabled = true;
  tenantSettings: Record<string, unknown> = {};
  customerEmail: string | null = "ada@example.com";
  userEmail: string | null = "owner@example.com";
  userPreferenceEnabled = true;
  recentDeliveryCount = 0;
  overdueSources: OverdueTicketEventSource[] = [];
  tenantDefaultLocale = "fr";

  async listEnabledConfigsForEvent(input: {
    tenantId: string;
    triggerEvent: string;
  }): Promise<NotificationConfigRecord[]> {
    return this.configs.filter(
      (config) =>
        config.tenantId === input.tenantId &&
        config.triggerEvent === input.triggerEvent,
    );
  }

  async getTenantDefaultLocale(): Promise<string | null> {
    return this.tenantDefaultLocale;
  }

  async findTemplate(input: {
    templateCode: string;
    localeCandidates: string[];
  }): Promise<NotificationTemplateRecord | null> {
    const matching = this.templates.filter(
      (template) => template.templateCode === input.templateCode,
    );

    for (const locale of input.localeCandidates) {
      const template = matching.find((row) => row.locale === locale);

      if (template) {
        return template;
      }
    }

    return matching[0] ?? null;
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
    idempotencyKey: string;
    recipientId?: string | null;
  }) {
    const existing = this.notifications.get(input.idempotencyKey);

    if (existing) {
      const delivery =
        [...this.deliveries.values()].find(
          (row) => row.notificationId === existing.id,
        ) ?? null;

      return {
        notification: existing,
        delivery,
        idempotent: true,
      };
    }

    const notification = createNotification({
      id: `notification_${this.notifications.size + 1}`,
      tenantId: input.tenantId,
      configId: input.config.id,
      templateId: input.template.id,
      relatedType: input.relatedType ?? null,
      relatedId: input.relatedId ?? null,
      title: input.title,
      content: input.content,
      locale: input.locale,
      payload: input.payload,
      idempotencyKey: input.idempotencyKey,
    });
    const delivery = createDelivery({
      id: `delivery_${this.deliveries.size + 1}`,
      tenantId: input.tenantId,
      notificationId: notification.id,
      recipientId: input.recipientId ?? null,
    });

    this.notifications.set(input.idempotencyKey, notification);
    this.deliveries.set(delivery.id, delivery);

    return {
      notification,
      delivery,
      idempotent: false,
    };
  }

  async isTenantNotificationsEnabled(): Promise<boolean> {
    return this.tenantEnabled;
  }

  async getTenantNotificationSettings(): Promise<Record<string, unknown>> {
    return this.tenantSettings;
  }

  async findCustomerEmail(): Promise<string | null> {
    return this.customerEmail;
  }

  async findUserEmail(): Promise<string | null> {
    return this.userEmail;
  }

  async isUserPreferenceEnabled(): Promise<boolean> {
    return this.userPreferenceEnabled;
  }

  async countRecentDeliveries(): Promise<number> {
    return this.recentDeliveryCount;
  }

  async listClaimableEmailDeliveries(): Promise<EmailDeliveryWorkItem[]> {
    return [...this.deliveries.values()]
      .filter((delivery) => delivery.status === "pending")
      .map((delivery) => ({
        delivery,
        notification:
          [...this.notifications.values()].find(
            (row) => row.id === delivery.notificationId,
          ) ?? createNotification(),
        config: {
          id: "config_1",
          triggerEvent: "order.created",
          frequencyLimit: null,
          frequencyWindowMinutes: null,
        },
      }));
  }

  async markDeliverySent(input: {
    deliveryId: string;
    externalId: string;
    now: Date;
  }): Promise<void> {
    const delivery = this.mustDelivery(input.deliveryId);
    this.deliveries.set(input.deliveryId, {
      ...delivery,
      status: "sent",
      externalId: input.externalId,
      sentAt: input.now,
      attemptCount: delivery.attemptCount + 1,
      nextRetryAt: null,
    });
  }

  async markDeliveryFailed(input: {
    delivery: NotificationDeliveryRecord;
    failedReason: string;
    nextRetryAt: Date | null;
    now: Date;
  }): Promise<void> {
    this.deliveries.set(input.delivery.id, {
      ...input.delivery,
      status: "failed",
      failedReason: input.failedReason,
      nextRetryAt: input.nextRetryAt,
      attemptCount: input.delivery.attemptCount + 1,
    });
  }

  async skipDelivery(input: {
    deliveryId: string;
    reason: string;
  }): Promise<void> {
    const delivery = this.mustDelivery(input.deliveryId);
    this.deliveries.set(input.deliveryId, {
      ...delivery,
      status: "cancelled",
      failedReason: input.reason,
      nextRetryAt: null,
    });
  }

  async listOverdueTicketEventSources(): Promise<OverdueTicketEventSource[]> {
    return this.overdueSources;
  }

  private mustDelivery(deliveryId: string): NotificationDeliveryRecord {
    const delivery = this.deliveries.get(deliveryId);

    if (!delivery) {
      throw new Error(`Missing delivery ${deliveryId}`);
    }

    return delivery;
  }
}

class FakeEmailAdapter implements ChannelAdapter {
  readonly channel = "email" as const;
  sent: ChannelSendInput[] = [];
  fail = false;

  async send(input: ChannelSendInput) {
    this.sent.push(input);

    if (this.fail) {
      throw new Error("SMTP down");
    }

    return {
      externalId: `message_${this.sent.length}`,
      status: "sent" as const,
    };
  }
}

export async function runNotificationSmokeChecks(): Promise<void> {
  const repository = new MemoryNotificationsRepository();
  const adapter = new FakeEmailAdapter();
  const service = new NotificationsService({
    repository,
    emailAdapter: adapter,
    emailConfig: {
      smtpHost: "localhost",
      smtpPort: 1025,
      smtpSecure: false,
      from: "CleanHub <no-reply@cleanhub.local>",
      defaultLocale: "en",
      retryBaseSeconds: 60,
      retryMaxSeconds: 3600,
    },
    logger: {
      info() {},
      warn() {},
      error() {},
    },
  });

  const first = await service.publish(createEvent());

  assert.equal(first.matched, 1);
  assert.equal(first.enqueued, 1);
  assert.equal(repository.notifications.size, 1);
  assert.equal([...repository.notifications.values()][0]?.locale, "fr");

  const replay = await service.publish(createEvent());

  assert.equal(replay.idempotent, 1);
  assert.equal(repository.notifications.size, 1);

  repository.configs = [];
  const noConfig = await service.publish(
    createEvent({ relatedId: "order_no_config" }),
  );

  assert.equal(noConfig.matched, 0);
  assert.equal(noConfig.enqueued, 0);

  repository.configs = [createConfig()];
  repository.templates = [
    createTemplate("zh-CN"),
    createTemplate("zh", {
      titleTemplate: "Legacy order {{orderNo}}",
    }),
  ];
  const zhCanonical = await service.publish(
    createEvent({
      locale: "zh",
      relatedId: "order_zh",
      idempotencyKey: "order.created:zh",
    }),
  );
  const zhCanonicalNotification = [...repository.notifications.values()].at(-1);

  assert.equal(zhCanonical.enqueued, 1);
  assert.equal(zhCanonicalNotification?.locale, "zh-CN");
  assert.equal(zhCanonicalNotification?.templateId, "template_zh-CN");

  repository.templates = [createTemplate("zh")];
  const zhLegacy = await service.publish(
    createEvent({
      locale: "zh-Hans",
      relatedId: "order_zh_legacy",
      idempotencyKey: "order.created:zh-legacy",
    }),
  );
  const zhLegacyNotification = [...repository.notifications.values()].at(-1);

  assert.equal(zhLegacy.enqueued, 1);
  assert.equal(zhLegacyNotification?.locale, "zh-CN");
  assert.equal(zhLegacyNotification?.templateId, "template_zh");

  const deliveryResult = await service.processEmailDeliveries({
    now: new Date("2026-06-27T00:00:00.000Z"),
  });

  assert.equal(deliveryResult.sent, 3);
  assert.equal(adapter.sent.length, 3);
  assert.equal([...repository.deliveries.values()][0]?.status, "sent");
  assert.equal([...repository.deliveries.values()][0]?.externalId, "message_1");

  const skipRepository = new MemoryNotificationsRepository();
  skipRepository.tenantEnabled = false;
  await skipRepository.createNotificationWithDelivery({
    tenantId,
    config: createConfig(),
    template: createTemplate("en"),
    title: "Order A-100",
    content: "Hello",
    locale: "en",
    payload: {},
    idempotencyKey: "skip",
    recipientId: customerId,
  });
  const skipService = new NotificationsService({
    repository: skipRepository,
    emailAdapter: new FakeEmailAdapter(),
    logger: { info() {}, warn() {}, error() {} },
  });
  const skipResult = await skipService.processEmailDeliveries();

  assert.equal(skipResult.skipped, 1);
  assert.equal([...skipRepository.deliveries.values()][0]?.status, "cancelled");
  assert.equal(
    [...skipRepository.deliveries.values()][0]?.failedReason,
    "tenant_notifications_disabled",
  );

  const failRepository = new MemoryNotificationsRepository();
  await failRepository.createNotificationWithDelivery({
    tenantId,
    config: createConfig(),
    template: createTemplate("en"),
    title: "Order A-100",
    content: "Hello",
    locale: "en",
    payload: {},
    idempotencyKey: "fail",
    recipientId: customerId,
  });
  const failingAdapter = new FakeEmailAdapter();
  failingAdapter.fail = true;
  const failService = new NotificationsService({
    repository: failRepository,
    emailAdapter: failingAdapter,
    emailConfig: {
      smtpHost: "localhost",
      smtpPort: 1025,
      smtpSecure: false,
      from: "CleanHub <no-reply@cleanhub.local>",
      defaultLocale: "en",
      retryBaseSeconds: 60,
      retryMaxSeconds: 3600,
    },
    logger: { info() {}, warn() {}, error() {} },
  });
  const failed = await failService.processEmailDeliveries({
    now: new Date("2026-06-27T00:00:00.000Z"),
  });
  const failedDelivery = [...failRepository.deliveries.values()][0];

  assert.equal(failed.failed, 1);
  assert.equal(failedDelivery?.status, "failed");
  assert.equal(failedDelivery?.attemptCount, 1);
  assert.equal(
    failedDelivery?.nextRetryAt?.toISOString(),
    "2026-06-27T00:01:00.000Z",
  );

  const maxDelivery = createDelivery({
    id: "delivery_max",
    notificationId: "notification_max",
    attemptCount: 2,
    maxAttempts: 3,
  });
  failRepository.notifications.set(
    "max",
    createNotification({ id: "notification_max", idempotencyKey: "max" }),
  );
  failRepository.deliveries.set(maxDelivery.id, maxDelivery);
  const terminal = await failService.processEmailDeliveries({
    now: new Date("2026-06-27T01:00:00.000Z"),
  });
  const terminalDelivery = failRepository.deliveries.get("delivery_max");

  assert.equal(terminal.failed, 1);
  assert.equal(terminalDelivery?.status, "failed");
  assert.equal(terminalDelivery?.attemptCount, 3);
  assert.equal(terminalDelivery?.nextRetryAt, null);
}

if (process.argv[1]?.endsWith("notifications.smoke.ts")) {
  await runNotificationSmokeChecks();
}
