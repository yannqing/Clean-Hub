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

export function validateNotificationSettings(
  input: NotificationSettingsFormValues,
): NotificationSettingsValidation {
  const errors: NotificationSettingsErrors = {};
  const templates = { ...input.templates } as NotificationTemplateSettings;

  for (const option of notificationEventOptions) {
    const templateKey = input.templates[option.value].templateKey.trim();

    if (!templateKey) {
      errors[`templates.${option.value}.templateKey`] =
        "Template key is required.";
      continue;
    }

    if (templateKey.length > 120) {
      errors[`templates.${option.value}.templateKey`] =
        "Template key must be 120 characters or fewer.";
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
