import { createId } from "@cleanhub/id";
import { eq, sql } from "drizzle-orm";

import {
  type Database,
  notificationSettings,
  tenantSettings,
} from "@cleanhub/db";

import { writeAuditLog } from "../../audit/audit.helper.js";
import type {
  NotificationEvent,
  NotificationLanguage,
  NotificationSettingsValue,
  TenantNotificationSettings,
  UpdateTenantNotificationSettingsRequest,
} from "./notifications.types.js";

function resolveLanguage(value: unknown): NotificationLanguage {
  if (value === "fr" || value === "zh-CN") {
    return value;
  }

  return "en";
}

function createDefaultSettings(
  defaultLanguage: NotificationLanguage,
): NotificationSettingsValue {
  return {
    defaultLanguage,
    channels: {
      whatsapp: true,
      sms: true,
      email: false,
    },
    templates: {
      "order.created": {
        enabled: true,
        templateKey: "order.created",
      },
      "order.ready": {
        enabled: true,
        templateKey: "order.ready",
      },
      "order.overdue_pickup": {
        enabled: true,
        templateKey: "order.overdue_pickup",
      },
      "delivery.updated": {
        enabled: true,
        templateKey: "delivery.updated",
      },
    },
  };
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readTemplate(
  value: unknown,
  event: NotificationEvent,
): { enabled: boolean; templateKey: string } {
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  return {
    enabled: readBoolean(record.enabled, true),
    templateKey:
      typeof record.templateKey === "string" && record.templateKey.trim()
        ? record.templateKey
        : event,
  };
}

function resolveSettings(
  value: Record<string, unknown>,
  fallbackLanguage: NotificationLanguage,
): NotificationSettingsValue {
  const channels =
    value.channels && typeof value.channels === "object"
      ? (value.channels as Record<string, unknown>)
      : {};
  const templates =
    value.templates && typeof value.templates === "object"
      ? (value.templates as Record<string, unknown>)
      : {};

  return {
    defaultLanguage: resolveLanguage(value.defaultLanguage ?? fallbackLanguage),
    channels: {
      whatsapp: readBoolean(channels.whatsapp, true),
      sms: readBoolean(channels.sms, true),
      email: readBoolean(channels.email, false),
    },
    templates: {
      "order.created": readTemplate(templates["order.created"], "order.created"),
      "order.ready": readTemplate(templates["order.ready"], "order.ready"),
      "order.overdue_pickup": readTemplate(
        templates["order.overdue_pickup"],
        "order.overdue_pickup",
      ),
      "delivery.updated": readTemplate(
        templates["delivery.updated"],
        "delivery.updated",
      ),
    },
  };
}

export async function findTenantDefaultLanguage(
  db: Database,
  tenantId: string,
): Promise<NotificationLanguage> {
  const rows = await db
    .select({ defaultLanguage: tenantSettings.defaultLanguage })
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1);

  return resolveLanguage(rows[0]?.defaultLanguage);
}

export async function findTenantNotificationSettings(
  db: Database,
  tenantId: string,
): Promise<TenantNotificationSettings | null> {
  const fallbackLanguage = await findTenantDefaultLanguage(db, tenantId);
  const rows = await db
    .select({
      id: notificationSettings.id,
      tenantId: notificationSettings.tenantId,
      settings: notificationSettings.settings,
      updatedAt: notificationSettings.updatedAt,
      updatedBy: notificationSettings.updatedBy,
      version: notificationSettings.version,
    })
    .from(notificationSettings)
    .where(eq(notificationSettings.tenantId, tenantId))
    .limit(1);
  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    tenantId: row.tenantId,
    deliveryMode: "not_connected",
    ...resolveSettings(row.settings, fallbackLanguage),
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
    version: row.version,
  };
}

export async function ensureTenantNotificationSettings(
  db: Database,
  input: {
    actorUserId: string;
    tenantId: string;
  },
): Promise<TenantNotificationSettings> {
  const current = await findTenantNotificationSettings(db, input.tenantId);

  if (current) {
    return current;
  }

  const defaultLanguage = await findTenantDefaultLanguage(db, input.tenantId);
  const now = new Date();

  await db
    .insert(notificationSettings)
    .values({
      id: createId(),
      tenantId: input.tenantId,
      settings: createDefaultSettings(defaultLanguage),
      createdAt: now,
      updatedAt: now,
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
    })
    .onConflictDoNothing({
      target: notificationSettings.tenantId,
    });

  const settings = await findTenantNotificationSettings(db, input.tenantId);

  if (!settings) {
    throw new Error("Notification settings could not be initialized.");
  }

  return settings;
}

export async function updateTenantNotificationSettingsRecord(
  db: Database,
  input: {
    actorUserId: string;
    tenantId: string;
    data: UpdateTenantNotificationSettingsRequest;
  },
): Promise<TenantNotificationSettings> {
  await db
    .update(notificationSettings)
    .set({
      settings: input.data,
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${notificationSettings.version} + 1`,
    })
    .where(eq(notificationSettings.tenantId, input.tenantId));

  const settings = await findTenantNotificationSettings(db, input.tenantId);

  if (!settings) {
    throw new Error("Notification settings could not be updated.");
  }

  return settings;
}

export async function writeTenantNotificationSettingsUpdatedAuditLog(
  db: Database,
  input: {
    actorUserId: string;
    before: TenantNotificationSettings;
    after: TenantNotificationSettings;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  await writeAuditLog(db, {
    actorUserId: input.actorUserId,
    tenantId: input.after.tenantId,
    eventCategory: "tenant_notification",
    eventType: "notification_settings.updated",
    entityType: "notification_settings",
    entityId: input.after.id,
    before: {
      defaultLanguage: input.before.defaultLanguage,
      channels: input.before.channels,
      templates: input.before.templates,
    },
    after: {
      defaultLanguage: input.after.defaultLanguage,
      channels: input.after.channels,
      templates: input.after.templates,
    },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
}
