import { notificationEventOptions } from "../constants";
import type {
  NotificationSettingsFormValues,
  NotificationTemplateSettings,
} from "../types";

type NotificationSettingsErrors = Partial<Record<string, string>>;

export type NotificationSettingsValidation =
  | {
      ok: true;
      data: NotificationSettingsFormValues;
    }
  | {
      ok: false;
      errors: NotificationSettingsErrors;
      message: string;
    };

/**
 * Provider template keys are dot-delimited identifiers (e.g. `order.created`,
 * `delivery.updated`). Allow letters, digits, underscores, and dots; reject
 * whitespace and other punctuation that would break provider lookups.
 */
const TEMPLATE_KEY_PATTERN = /^[A-Za-z0-9_.]+$/;

export function validateNotificationSettings(
  input: NotificationSettingsFormValues,
): NotificationSettingsValidation {
  const errors: NotificationSettingsErrors = {};
  const templates = { ...input.templates } as NotificationTemplateSettings;

  for (const option of notificationEventOptions) {
    const templateKey = input.templates[option.value].templateKey.trim();
    const errorKey = `templates.${option.value}.templateKey`;

    if (!templateKey) {
      errors[errorKey] = "Template key is required.";
      continue;
    }

    if (templateKey.length > 120) {
      errors[errorKey] = "Template key must be 120 characters or fewer.";
      continue;
    }

    if (!TEMPLATE_KEY_PATTERN.test(templateKey)) {
      errors[errorKey] =
        "Template key may only contain letters, numbers, dots, and underscores.";
      continue;
    }

    templates[option.value] = {
      ...templates[option.value],
      templateKey,
    };
  }

  if (Object.keys(errors).length > 0) {
    return {
      ok: false,
      errors,
      message: Object.values(errors)[0] ?? "Check the notification settings.",
    };
  }

  return {
    ok: true,
    data: {
      ...input,
      templates,
    },
  };
}
