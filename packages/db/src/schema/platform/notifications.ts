import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { ulidColumn, ulidPrimaryKey } from "../id.js";
import { users } from "../identity/users.js";
import { tenants } from "../tenancy/tenants.js";

// ──────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────

export const noticeTypeEnum = pgEnum("notice_type", ["system", "business"]);

export const noticeScopeEnum = pgEnum("notice_scope", [
  "pos",
  "saas",
  "tenant",
  "mobile",
  "desktop",
]);

export const noticeChannelEnum = pgEnum("notice_channel", [
  "pos",
  "app",
  "sms",
  "whatsapp",
  "email",
]);

export const noticePriorityEnum = pgEnum("notice_priority", [
  "low",
  "normal",
  "high",
  "critical",
]);

export const noticeRecipientTypeEnum = pgEnum("notice_recipient_type", [
  "role",
  "user",
  "customer",
  "branch_all",
  "tenant_all",
]);

export const noticeSenderTypeEnum = pgEnum("notice_sender_type", [
  "system",
  "user",
  "customer",
  "scheduler",
]);

export const noticeDeliveryStatusEnum = pgEnum("notice_delivery_status", [
  "pending",
  "sent",
  "failed",
  "cancelled",
]);

export const noticeReadStatusEnum = pgEnum("notice_read_status", [
  "unread",
  "read",
  "archived",
]);

export const noticeTriggerTypeEnum = pgEnum("notice_trigger_type", [
  "event",
  "schedule",
]);

// ──────────────────────────────────────────────
// 1. notification_templates
// ──────────────────────────────────────────────

export const notificationTemplates = pgTable(
  "notification_templates",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id").references(() => tenants.id),
    templateCode: varchar("template_code", { length: 80 }).notNull(),
    templateName: varchar("template_name", { length: 120 }).notNull(),
    noticeType: noticeTypeEnum("notice_type").notNull(),
    locale: varchar("locale", { length: 16 }).notNull(),
    titleTemplate: text("title_template").notNull(),
    contentTemplate: text("content_template").notNull(),
    variables: jsonb("variables")
      .notNull()
      .$type<Record<string, unknown>[]>()
      .default([]),
    isSystem: boolean("is_system").notNull().default(false),
    isEnabled: boolean("is_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: ulidColumn("updated_by").references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: ulidColumn("deleted_by").references(() => users.id),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("notification_templates_tenant_code_locale_unique").on(
      table.tenantId,
      table.templateCode,
      table.locale,
    ),
    index("notification_templates_tenant_id_idx").on(table.tenantId),
    index("notification_templates_template_code_idx").on(table.templateCode),
  ],
);

// ──────────────────────────────────────────────
// 2. notification_configs
// ──────────────────────────────────────────────

export const notificationConfigs = pgTable(
  "notification_configs",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id").references(() => tenants.id),
    templateId: ulidColumn("template_id")
      .notNull()
      .references(() => notificationTemplates.id),
    configName: varchar("config_name", { length: 120 }).notNull(),
    noticeType: noticeTypeEnum("notice_type").notNull(),
    triggerType: noticeTriggerTypeEnum("trigger_type").notNull(),
    triggerEvent: varchar("trigger_event", { length: 120 }),
    triggerCron: varchar("trigger_cron", { length: 120 }),
    channel: noticeChannelEnum("channel").notNull(),
    recipientType: noticeRecipientTypeEnum("recipient_type").notNull(),
    recipientRole: varchar("recipient_role", { length: 80 }),
    recipientUserId: ulidColumn("recipient_user_id").references(() => users.id),
    frequencyLimit: integer("frequency_limit"),
    frequencyWindowMinutes: integer("frequency_window_minutes"),
    isEnabled: boolean("is_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: ulidColumn("updated_by").references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: ulidColumn("deleted_by").references(() => users.id),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("notification_configs_tenant_trigger_event_idx").on(
      table.tenantId,
      table.triggerEvent,
    ),
    index("notification_configs_tenant_trigger_type_idx").on(
      table.tenantId,
      table.triggerType,
    ),
    index("notification_configs_template_id_idx").on(table.templateId),
  ],
);

// ──────────────────────────────────────────────
// 3. notifications
// ──────────────────────────────────────────────

export const notifications = pgTable(
  "notifications",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id").references(() => tenants.id),
    scope: noticeScopeEnum("scope").notNull(),
    noticeType: noticeTypeEnum("notice_type").notNull(),
    configId: ulidColumn("config_id").references(() => notificationConfigs.id),
    templateId: ulidColumn("template_id").references(
      () => notificationTemplates.id,
    ),
    relatedType: varchar("related_type", { length: 80 }),
    relatedId: ulidColumn("related_id"),
    title: varchar("title", { length: 200 }).notNull(),
    content: text("content").notNull(),
    locale: varchar("locale", { length: 16 }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    priority: noticePriorityEnum("priority").notNull().default("normal"),
    idempotencyKey: varchar("idempotency_key", { length: 120 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: ulidColumn("updated_by").references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: ulidColumn("deleted_by").references(() => users.id),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("notifications_tenant_idempotency_key_unique").on(
      table.tenantId,
      table.idempotencyKey,
    ),
    index("notifications_tenant_scope_type_idx").on(
      table.tenantId,
      table.scope,
      table.noticeType,
    ),
    index("notifications_related_idx").on(
      table.relatedType,
      table.relatedId,
    ),
    index("notifications_created_at_idx").on(table.createdAt),
  ],
);

// ──────────────────────────────────────────────
// 4. notification_deliveries
// ──────────────────────────────────────────────

export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id").references(() => tenants.id),
    notificationId: ulidColumn("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    channel: noticeChannelEnum("channel").notNull(),
    recipientType: noticeRecipientTypeEnum("recipient_type").notNull(),
    recipientId: ulidColumn("recipient_id"),
    senderType: noticeSenderTypeEnum("sender_type").notNull().default("system"),
    senderId: ulidColumn("sender_id"),
    status: noticeDeliveryStatusEnum("status").notNull().default("pending"),
    readStatus: noticeReadStatusEnum("read_status")
      .notNull()
      .default("unread"),
    priority: noticePriorityEnum("priority").notNull().default("normal"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    externalId: varchar("external_id", { length: 120 }),
    failedReason: text("failed_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: ulidColumn("updated_by").references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: ulidColumn("deleted_by").references(() => users.id),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("notification_deliveries_notification_id_idx").on(
      table.notificationId,
    ),
    index("notification_deliveries_recipient_idx").on(
      table.tenantId,
      table.recipientType,
      table.recipientId,
      table.readStatus,
    ),
    index("notification_deliveries_channel_status_idx").on(
      table.tenantId,
      table.channel,
      table.status,
    ),
    index("notification_deliveries_retry_idx").on(
      table.status,
      table.nextRetryAt,
    ),
    index("notification_deliveries_external_id_idx").on(table.externalId),
  ],
);

// ──────────────────────────────────────────────
// 5. notification_preferences
// ──────────────────────────────────────────────

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: ulidColumn("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    noticeType: noticeTypeEnum("notice_type").notNull(),
    channel: noticeChannelEnum("channel").notNull(),
    isEnabled: boolean("is_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: ulidColumn("updated_by").references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: ulidColumn("deleted_by").references(() => users.id),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("notification_preferences_user_type_channel_unique").on(
      table.tenantId,
      table.userId,
      table.noticeType,
      table.channel,
    ),
    index("notification_preferences_user_id_idx").on(table.userId),
  ],
);

// ──────────────────────────────────────────────
// 6. notification_settings
// ──────────────────────────────────────────────

export const notificationSettings = pgTable(
  "notification_settings",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id").references(() => tenants.id),
    settings: jsonb("settings")
      .notNull()
      .$type<Record<string, unknown>>()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: ulidColumn("updated_by").references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: ulidColumn("deleted_by").references(() => users.id),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("notification_settings_tenant_id_unique").on(table.tenantId),
  ],
);
