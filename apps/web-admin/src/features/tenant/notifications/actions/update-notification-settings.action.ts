import { webAdminApi } from "@/lib/api-client";

import type { NotificationSettingsFormValues } from "../types";
import { validateNotificationSettings } from "../validators";

export async function updateNotificationSettingsAction(
  input: NotificationSettingsFormValues,
) {
  const validation = validateNotificationSettings(input);

  if (!validation.ok) {
    return validation;
  }

  const settings =
    await webAdminApi.tenant.notifications.updateSettings(validation.data);

  return {
    ok: true as const,
    data: settings,
  };
}
