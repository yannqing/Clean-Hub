"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@cleanhub/ui";
import { useTranslation } from "@cleanhub/i18n/react";

import { apiClient } from "@/lib/api-client";
import {
  enablePushNotifications,
  getPushNotificationSetupState,
  registerPushNotificationsIfPermitted,
  type PushNotificationSetupState,
} from "@/lib/push-notifications";

export function PushNotificationSetupCard() {
  const { t } = useTranslation();
  const [state, setState] = useState<PushNotificationSetupState | "loading">(
    "loading",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function refreshState(): Promise<void> {
    const nextState = await getPushNotificationSetupState();

    if (nextState === "granted") {
      setState(await registerPushNotificationsIfPermitted(apiClient));
      return;
    }

    setState(nextState);
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshState();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  async function requestPermission(): Promise<void> {
    setIsSubmitting(true);
    setState(await enablePushNotifications(apiClient));
    setIsSubmitting(false);
  }

  if (state === "loading" || state === "unsupported" || state === "granted") {
    return null;
  }

  const permissionWasDenied = state === "denied";
  const registrationFailed = state === "error";

  return (
    <section className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950">
      <div className="flex gap-3">
        {permissionWasDenied ? (
          <BellOff className="mt-0.5 size-5 shrink-0 text-blue-700" aria-hidden="true" />
        ) : (
          <Bell className="mt-0.5 size-5 shrink-0 text-blue-700" aria-hidden="true" />
        )}
        <div className="min-w-0 space-y-1">
          <h2 className="text-sm font-semibold">
            {t("customer.notifications.setupTitle")}
          </h2>
          <p className="text-sm leading-5 text-blue-900">
            {permissionWasDenied
              ? t("customer.notifications.deniedBody")
              : registrationFailed
                ? t("customer.notifications.errorBody")
                : t("customer.notifications.setupBody")}
          </p>
          <Button
            className="mt-2"
            disabled={isSubmitting}
            size="sm"
            type="button"
            variant={permissionWasDenied ? "outline" : "default"}
            onClick={() => void (permissionWasDenied ? refreshState() : requestPermission())}
          >
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {permissionWasDenied
              ? t("customer.notifications.checkAgain")
              : registrationFailed
                ? t("customer.notifications.tryAgain")
                : t("customer.notifications.enable")}
          </Button>
        </div>
      </div>
    </section>
  );
}
