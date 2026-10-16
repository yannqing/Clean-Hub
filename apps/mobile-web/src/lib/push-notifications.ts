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
 * This module only uses the native Firebase Messaging plugin. The plugin
 * returns an FCM registration token on both Android and iOS, which is the
 * token type accepted by the API delivery service. It is deliberately a
 * no-op for the plain web build.
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

type FirebaseMessagingPlugin = {
  checkPermissions(): Promise<{ receive: PushPermissionState }>;
  requestPermissions(): Promise<{ receive: PushPermissionState }>;
  getToken(): Promise<{ token: string }>;
  deleteToken(): Promise<void>;
  removeAllListeners(): Promise<void>;
  addListener(
    eventName: "tokenReceived",
    listener: (token: { token: string }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "notificationReceived",
    listener: (notification: PushNotificationSchema) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "notificationActionPerformed",
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

export type PushNotificationSetupState =
  | "unsupported"
  | "prompt"
  | "denied"
  | "granted"
  | "error";

const PUSH_TOKEN_STORAGE_KEY = "cleanhub.mobile.push-token";
const FCM_TOKEN_TIMEOUT_MS = 15_000;

let registeredToken: string | null = null;
let listenersReady = false;
let pendingFcmTokenRequest: Promise<PushNotificationSetupState> | null = null;
const pendingTokenSyncs = new Map<string, Promise<PushNotificationSetupState>>();

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: number | undefined;

  return Promise.race([
    promise,
    new Promise<never>((_resolve, reject) => {
      timeoutId = window.setTimeout(() => {
        reject(new Error("FCM token request timed out."));
      }, timeoutMs);
    }),
  ]).finally(() => {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  });
}

function getCapacitorGlobal(): CapacitorGlobal | null {
  if (typeof window === "undefined") {
    return null;
  }

  const candidate = window as Window & { Capacitor?: CapacitorGlobal };

  return candidate.Capacitor ?? null;
}

function getPushPlugin(): FirebaseMessagingPlugin | null {
  const plugin = getCapacitorGlobal()?.Plugins?.FirebaseMessaging;

  return plugin ? (plugin as FirebaseMessagingPlugin) : null;
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

async function getStoredPushToken(): Promise<string | null> {
  try {
    const preferences = await import("@capacitor/preferences");
    const result = await preferences.Preferences.get({ key: PUSH_TOKEN_STORAGE_KEY });

    if (result.value) {
      return result.value;
    }
  } catch {
    // Fall through to localStorage below.
  }

  try {
    return window.localStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

async function storePushToken(token: string | null): Promise<void> {
  try {
    const preferences = await import("@capacitor/preferences");

    if (token) {
      await preferences.Preferences.set({ key: PUSH_TOKEN_STORAGE_KEY, value: token });
    } else {
      await preferences.Preferences.remove({ key: PUSH_TOKEN_STORAGE_KEY });
    }

    return;
  } catch {
    // Fall through to localStorage below.
  }

  try {
    if (token) {
      window.localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Best effort only.
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

  writeMobileDetailUrlState(detailState, "push");
  window.dispatchEvent(new PopStateEvent("popstate"));
}

async function syncDeviceToken(
  token: string,
  apiClient: PushApiClient,
): Promise<PushNotificationSetupState> {
  const existing = pendingTokenSyncs.get(token);

  if (existing) {
    return existing;
  }

  const sync = (async (): Promise<PushNotificationSetupState> => {
    try {
      const [deviceId, locale] = await Promise.all([
        getOrCreateDeviceId(),
        getStoredLocale(),
      ]);

      await apiClient.mobile.notifications.registerDeviceToken({
        token,
        platform: getPlatform(),
        deviceId,
        locale,
      });
      registeredToken = token;
      await storePushToken(token);
      return "granted";
    } catch (error) {
      console.warn("[push] device token registration failed", error);
      return "error";
    } finally {
      pendingTokenSyncs.delete(token);
    }
  })();

  pendingTokenSyncs.set(token, sync);
  return sync;
}

async function attachListeners(
  plugin: FirebaseMessagingPlugin,
  apiClient: PushApiClient,
): Promise<void> {
  if (listenersReady) {
    return;
  }

  listenersReady = true;

  try {
    await plugin.addListener("tokenReceived", (event) => {
      if (event.token) {
        void syncDeviceToken(event.token, apiClient);
      }
    });

    await plugin.addListener("notificationReceived", (notification) => {
      showForegroundToast(notification);
    });

    await plugin.addListener("notificationActionPerformed", (action) => {
      handleNotificationAction(action.notification);
    });
  } catch (error) {
    listenersReady = false;
    throw error;
  }
}

async function registerDeviceToken(
  plugin: FirebaseMessagingPlugin,
  apiClient: PushApiClient,
): Promise<PushNotificationSetupState> {
  if (pendingFcmTokenRequest) {
    return pendingFcmTokenRequest;
  }

  pendingFcmTokenRequest = (async () => {
    try {
      // Firebase Installation Service may be unreachable on a newly configured
      // device. Do not leave the setup button in a permanent loading state.
      const result = await withTimeout(plugin.getToken(), FCM_TOKEN_TIMEOUT_MS);

      if (!result.token) {
        console.warn("[push] Firebase Messaging returned an empty token");
        return "error";
      }

      return syncDeviceToken(result.token, apiClient);
    } catch (error) {
      console.warn("[push] could not retrieve FCM token", error);
      return "error";
    } finally {
      pendingFcmTokenRequest = null;
    }
  })();

  return pendingFcmTokenRequest;
}

export async function enablePushNotifications(
  apiClient: PushApiClient,
): Promise<PushNotificationSetupState> {
  try {
    const plugin = getPushPlugin();

    if (!plugin) {
      return "unsupported";
    }

    let permission = await plugin.checkPermissions();

    if (permission.receive === "prompt" || permission.receive === "prompt-with-rationale") {
      permission = await plugin.requestPermissions();
    }

    if (permission.receive !== "granted") {
      console.warn("[push] notification permission not granted");
      return "denied";
    }

    await attachListeners(plugin, apiClient);
    return registerDeviceToken(plugin, apiClient);
  } catch (error) {
    console.warn("[push] enabling push notifications failed", error);
    return "error";
  }
}

export async function getPushNotificationSetupState(): Promise<PushNotificationSetupState> {
  try {
    const plugin = getPushPlugin();

    if (!plugin) {
      return "unsupported";
    }

    const permission = await plugin.checkPermissions();

    if (permission.receive === "granted") {
      return "granted";
    }

    if (permission.receive === "denied") {
      return "denied";
    }

    return "prompt";
  } catch (error) {
    console.warn("[push] checking notification permission failed", error);
    return "error";
  }
}

/**
 * Refresh the device token after the user has already granted native
 * notification permission. This deliberately never opens a system prompt.
 */
export async function registerPushNotificationsIfPermitted(
  apiClient: PushApiClient,
): Promise<PushNotificationSetupState> {
  const state = await getPushNotificationSetupState();

  if (state !== "granted") {
    return state;
  }

  try {
    const plugin = getPushPlugin();

    if (!plugin) {
      return "unsupported";
    }

    await attachListeners(plugin, apiClient);
    return registerDeviceToken(plugin, apiClient);
  } catch (error) {
    console.warn("[push] refreshing device token failed", error);
    return "error";
  }
}

export async function disablePushNotifications(
  apiClient: PushApiClient,
): Promise<void> {
  const plugin = getPushPlugin();

  if (!plugin) {
    return;
  }

  const token = registeredToken ?? (await getStoredPushToken());

  try {
    if (token) {
      await apiClient.mobile.notifications.unregisterDeviceToken({ token });
    }
  } catch (error) {
    console.warn("[push] device token unregister failed", error);
  } finally {
    // Deleting the FCM token prevents delivery to this signed-out device even
    // if it was offline when the API unregister request was attempted.
    await plugin.deleteToken().catch((error: unknown) => {
      console.warn("[push] native FCM token deletion failed", error);
    });
    await storePushToken(null);
    registeredToken = null;
    await plugin.removeAllListeners().catch((error: unknown) => {
      console.warn("[push] listener cleanup failed", error);
    });
    listenersReady = false;
  }
}
