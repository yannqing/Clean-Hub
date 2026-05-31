import { z } from "zod";

const notificationTemplateSchema = z.object({
  enabled: z.boolean(),
  templateKey: z.string().trim().min(1).max(120),
});

export const updateTenantNotificationSettingsBodySchema = z.object({
  defaultLanguage: z.enum(["en", "fr", "zh-CN"]),
  channels: z.object({
    whatsapp: z.boolean(),
    sms: z.boolean(),
    email: z.boolean(),
  }),
  templates: z.object({
    "order.created": notificationTemplateSchema,
    "order.ready": notificationTemplateSchema,
    "order.overdue_pickup": notificationTemplateSchema,
    "delivery.updated": notificationTemplateSchema,
  }),
});
