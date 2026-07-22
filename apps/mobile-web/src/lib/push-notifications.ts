import type {
  MobileDeviceTokenView,
  MobilePushPlatform,
  MobileRegisterDeviceTokenRequest,
  MobileUnregisterDeviceTokenRequest,
  MobileUnregisterDeviceTokenResponse,
} from "@cleanhub/api-client";
import { localeStorageKey } from "@cleanhub/i18n";
import { toast } from "@cleanhub/ui";

import {
  writeMobileDetailUrlState,
  type MobileDetailView,
} from "./detail-url";
import { getOrCreateDeviceId } from "./token-storage";

/**
 * Everything in this module is best-effort: on the plain web build (no
 * Capacitor runtime, no PushNotifications plugin) every function is a silent
 * no-op, and any failure is logged with console.warn without ever blocking
 * login/logout flows.
 */

type PushPermissionState = "prompt" | "prompt-with-rationale" | "granted" | "denied";

type PluginListenerHandle = {
  remove(): Promise<void>;
};

type PushNotificationSchema = {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
};

type PushNotificationsPlugin = {
  checkPermissions(): Promise<{ receive: PushPermissionState }>;
  requestPermissions(): Promise<{ receive: PushPermissionState }>;
  register(): Promise<void>;
  removeAllListeners(): Promise<void>;
  addListener(
    eventName: "registration",
    listener: (token: { value: string }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "registrationError",
    listener: (error: { error: string }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "pushNotificationReceived",
    listener: (notification: PushNotificationSchema) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "pushNotificationActionPerformed",
    listener: (action: { notification: PushNotificationSchema }) => void,
  ): Promise<PluginListenerHandle>;
};

type PushApiClient = {
  mobile: {
    notifications: {
      registerDeviceToken(
        input: MobileRegisterDeviceTokenRequest,
      ): Promise<MobileDeviceTokenView>;
      unregisterDeviceToken(
        input: MobileUnregisterDeviceTokenRequest,
      ): Promise<MobileUnregisterDeviceTokenResponse>;
    };
  };
};

type CapacitorGlobal = {
  Plugins?: Record<string, unknown>;
  getPlatform?: () => string;
};

let registeredToken: string | null = null;
let listenersReady = false;

function getCapacitorGlobal(): CapacitorGlobal | null {
  if (typeof window === "undefined") {
    return null;
  }

  const candidate = window as Window & { Capacitor?: CapacitorGlobal };

  return candidate.Capacitor ?? null;
}

function getPushPlugin(): PushNotificationsPlugin | null {
  const plugin = getCapacitorGlobal()?.Plugins?.PushNotifications;

  return plugin ? (plugin as PushNotificationsPlugin) : null;
}

function getPlatform(): MobilePushPlatform {
  const platform = getCapacitorGlobal()?.getPlatform?.();

  return platform === "android" || platform === "ios" ? platform : "web";
}

async function getStoredLocale(): Promise<string | null> {
  try {
    const preferences = await import("@capacitor/preferences");
    const result = await preferences.Preferences.get({ key: localeStorageKey });

    if (result.value) {
      return result.value;
    }
  } catch {
    // Fall through to localStorage below.
  }

  try {
    return window.localStorage.getItem(localeStorageKey);
  } catch {
    return null;
  }
}

const DETAIL_VIEW_BY_RELATED_TYPE: Record<string, MobileDetailView> = {
  order: "order",
  ticket: "ticket",
  service_ticket: "ticket",
  delivery_task: "task",
};

function readString(data: Record<string, unknown> | undefined, key: string): string | null {
  const value = data?.[key];

  return typeof value === "string" && value ? value : null;
}

function resolveDetailState(
  data: Record<string, unknown> | undefined,
): { view: MobileDetailView; id: string } | null {
  const relatedType = readString(data, "relatedType");
  const relatedId = readString(data, "relatedId");

  if (relatedType && relatedId && DETAIL_VIEW_BY_RELATED_TYPE[relatedType]) {
    return { view: DETAIL_VIEW_BY_RELATED_TYPE[relatedType], id: relatedId };
  }

  const taskId = readString(data, "taskId");

  if (taskId) {
    return { view: "task", id: taskId };
  }

  const orderId = readString(data, "orderId");

  if (orderId) {
    return { view: "order", id: orderId };
  }

  const ticketId = readString(data, "ticketId");

  if (ticketId) {
    return { view: "ticket", id: ticketId };
  }

  return null;
}

function showForegroundToast(notification: PushNotificationSchema): void {
  const title = notification.title?.trim();
  const body = notification.body?.trim();

  if (title && body) {
    toast(title, { description: body });
    return;
  }

  if (title || body) {
    toast(title ?? body ?? "");
  }
}

function handleNotificationAction(notification: PushNotificationSchema): void {
  const detailState = resolveDetailState(notification.data);

  if (!detailState) {
    showForegroundToast(notification);
    return;
  }

  // The home screens restore detail views from the URL and listen to
  // popstate, so writing the deep-link state and replaying the event is
  // enough to open the matching detail sheet.
  writeMobileDetailUrlState(detailState, "push");
  window.dispatchEvent(new PopStateEvent("popstate"));
}

async function attachListeners(
  plugin: PushNotificationsPlugin,
  apiClient: PushApiClient,
): Promise<void> {
  if (listenersReady) {
    return;
  }

  listenersReady = true;

  await plugin.addListener("registration", (token) => {
    registeredToken = token.value;

    void (async () => {
      try {
        const [deviceId, locale] = await Promise.all([
          getOrCreateDeviceId(),
          getStoredLocale(),
        ]);

        await apiClient.mobile.notifications.registerDeviceToken({
          token: token.value,
          platform: getPlatform(),
          deviceId,
          locale,
        });
      } catch (error) {
        console.warn("[push] device token registration failed", error);
      }
    })();
  });

  await plugin.addListener("registrationError", (error) => {
    console.warn("[push] native registration failed", error);
  });

  await plugin.addListener("pushNotificationReceived", (notification) => {
    showForegroundToast(notification);
  });

  await plugin.addListener("pushNotificationActionPerformed", (action) => {
    handleNotificationAction(action.notification);
  });
}

export async function enablePushNotifications(
  apiClient: PushApiClient,
): Promise<void> {
  try {
    const plugin = getPushPlugin();

    if (!plugin) {
      return;
    }

    let permission = await plugin.checkPermissions();

    if (permission.receive === "prompt" || permission.receive === "prompt-with-rationale") {
      permission = await plugin.requestPermissions();
    }

    if (permission.receive !== "granted") {
      console.warn("[push] notification permission not granted");
      return;
    }

    await attachListeners(plugin, apiClient);
    await plugin.register();
  } catch (error) {
    console.warn("[push] enabling push notifications failed", error);
  }
}

export async function disablePushNotifications(
  apiClient: PushApiClient,
): Promise<void> {
  try {
    const plugin = getPushPlugin();

    if (!plugin) {
      return;
    }

    if (registeredToken) {
      await apiClient.mobile.notifications
        .unregisterDeviceToken({ token: registeredToken })
        .catch((error: unknown) => {
          console.warn("[push] device token unregister failed", error);
        });
      registeredToken = null;
    }

    await plugin.removeAllListeners();
    listenersReady = false;
  } catch (error) {
    console.warn("[push] disabling push notifications failed", error);
  }
}
