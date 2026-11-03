import type { MobileAuthContext, MobileTokenResponse } from "@cleanhub/api-client";
import { credentialStorage } from "./credential-storage";
import { setBusinessTimeZone } from "./business-time";

const STORAGE_KEYS = {
  accessToken: "cleanhub.mobile.accessToken",
  refreshToken: "cleanhub.mobile.refreshToken",
  accessTokenExpiresAt: "cleanhub.mobile.accessTokenExpiresAt",
  refreshTokenExpiresAt: "cleanhub.mobile.refreshTokenExpiresAt",
  authContext: "cleanhub.mobile.authContext",
  tenantCode: "cleanhub.mobile.tenantCode",
  deviceId: "cleanhub.mobile.deviceId",
} as const;

type PreferenceStore = {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
};

export type StoredMobileSession = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  authContext: MobileAuthContext;
};

/** Non-secret installation preferences. Sessions use credentialStorage:
 * iOS Keychain / Android Keystore encryption, migrated from older Preferences.
 * Browser preview is development-only and uses PreferencesWeb. */
async function getPreferenceStore(): Promise<PreferenceStore | null> {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const preferences = await import("@capacitor/preferences");
    const store = preferences.Preferences;

    return {
      get: (options) => store.get(options),
      set: (options) => store.set(options),
      remove: (options) => store.remove(options),
    };
  } catch {
    return null;
  }
}

async function readValue(key: string): Promise<string | null> {
  const preferences = await getPreferenceStore();

  if (preferences) {
    const result = await preferences.get({ key });
    return result.value;
  }

  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(key);
}

async function writeValue(key: string, value: string): Promise<void> {
  const preferences = await getPreferenceStore();

  if (preferences) {
    await preferences.set({ key, value });
    return;
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(key, value);
  }
}

async function removeValue(key: string): Promise<void> {
  const preferences = await getPreferenceStore();

  if (preferences) {
    await preferences.remove({ key });
    return;
  }

  if (typeof window !== "undefined") {
    window.localStorage.removeItem(key);
  }
}

export async function getAccessToken(): Promise<string | null> {
  return credentialStorage.getItem(STORAGE_KEYS.accessToken);
}

export async function getRefreshToken(): Promise<string | null> {
  return credentialStorage.getItem(STORAGE_KEYS.refreshToken);
}

export async function saveMobileSession(response: MobileTokenResponse): Promise<void> {
  setBusinessTimeZone(response.authContext.timezone);
  await Promise.all([
    credentialStorage.setItem(STORAGE_KEYS.accessToken, response.accessToken),
    credentialStorage.setItem(STORAGE_KEYS.refreshToken, response.refreshToken),
    credentialStorage.setItem(STORAGE_KEYS.accessTokenExpiresAt, response.accessTokenExpiresAt),
    credentialStorage.setItem(STORAGE_KEYS.refreshTokenExpiresAt, response.refreshTokenExpiresAt),
    credentialStorage.setItem(STORAGE_KEYS.authContext, JSON.stringify(response.authContext)),
  ]);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("cleanhub:session-updated", { detail: response.authContext }));
}

export async function getMobileSession(): Promise<StoredMobileSession | null> {
  const [accessToken, refreshToken, accessTokenExpiresAt, refreshTokenExpiresAt, authContext] =
    await Promise.all([
      credentialStorage.getItem(STORAGE_KEYS.accessToken),
      credentialStorage.getItem(STORAGE_KEYS.refreshToken),
      credentialStorage.getItem(STORAGE_KEYS.accessTokenExpiresAt),
      credentialStorage.getItem(STORAGE_KEYS.refreshTokenExpiresAt),
      credentialStorage.getItem(STORAGE_KEYS.authContext),
    ]);

  if (!accessToken || !refreshToken || !accessTokenExpiresAt || !refreshTokenExpiresAt || !authContext) {
    return null;
  }

  try {
    const context = JSON.parse(authContext) as MobileAuthContext;
    setBusinessTimeZone(context.timezone);
    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      authContext: context,
    };
  } catch {
    await clearMobileSession();
    return null;
  }
}

export async function clearMobileSession(): Promise<void> {
  await Promise.all([
    credentialStorage.removeItem(STORAGE_KEYS.accessToken),
    credentialStorage.removeItem(STORAGE_KEYS.refreshToken),
    credentialStorage.removeItem(STORAGE_KEYS.accessTokenExpiresAt),
    credentialStorage.removeItem(STORAGE_KEYS.refreshTokenExpiresAt),
    credentialStorage.removeItem(STORAGE_KEYS.authContext),
  ]);
  if (typeof window !== "undefined") window.dispatchEvent(new Event("cleanhub:session-cleared"));
}

export async function saveTenantCode(tenantCode: string): Promise<void> {
  await writeValue(STORAGE_KEYS.tenantCode, tenantCode.normalize("NFKC").trim().toUpperCase());
}

export async function getTenantCode(): Promise<string | null> {
  return readValue(STORAGE_KEYS.tenantCode);
}

export async function clearTenantCode(): Promise<void> {
  await removeValue(STORAGE_KEYS.tenantCode);
}

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await readValue(STORAGE_KEYS.deviceId);

  if (existing) {
    return existing;
  }

  const generated =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await writeValue(STORAGE_KEYS.deviceId, generated);
  return generated;
}
