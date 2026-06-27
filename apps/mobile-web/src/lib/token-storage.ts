import type { MobileAuthContext, MobileTokenResponse } from "@cleanhub/api-client";

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

async function getPreferenceStore(): Promise<PreferenceStore | null> {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const preferences = await import("@capacitor/preferences");
    return preferences.Preferences;
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
  return readValue(STORAGE_KEYS.accessToken);
}

export async function getRefreshToken(): Promise<string | null> {
  return readValue(STORAGE_KEYS.refreshToken);
}

export async function saveMobileSession(response: MobileTokenResponse): Promise<void> {
  await Promise.all([
    writeValue(STORAGE_KEYS.accessToken, response.accessToken),
    writeValue(STORAGE_KEYS.refreshToken, response.refreshToken),
    writeValue(STORAGE_KEYS.accessTokenExpiresAt, response.accessTokenExpiresAt),
    writeValue(STORAGE_KEYS.refreshTokenExpiresAt, response.refreshTokenExpiresAt),
    writeValue(STORAGE_KEYS.authContext, JSON.stringify(response.authContext)),
  ]);
}

export async function getMobileSession(): Promise<StoredMobileSession | null> {
  const [accessToken, refreshToken, accessTokenExpiresAt, refreshTokenExpiresAt, authContext] =
    await Promise.all([
      readValue(STORAGE_KEYS.accessToken),
      readValue(STORAGE_KEYS.refreshToken),
      readValue(STORAGE_KEYS.accessTokenExpiresAt),
      readValue(STORAGE_KEYS.refreshTokenExpiresAt),
      readValue(STORAGE_KEYS.authContext),
    ]);

  if (!accessToken || !refreshToken || !accessTokenExpiresAt || !refreshTokenExpiresAt || !authContext) {
    return null;
  }

  try {
    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      authContext: JSON.parse(authContext) as MobileAuthContext,
    };
  } catch {
    await clearMobileSession();
    return null;
  }
}

export async function clearMobileSession(): Promise<void> {
  await Promise.all([
    removeValue(STORAGE_KEYS.accessToken),
    removeValue(STORAGE_KEYS.refreshToken),
    removeValue(STORAGE_KEYS.accessTokenExpiresAt),
    removeValue(STORAGE_KEYS.refreshTokenExpiresAt),
    removeValue(STORAGE_KEYS.authContext),
  ]);
}

export async function saveTenantCode(tenantCode: string): Promise<void> {
  await writeValue(STORAGE_KEYS.tenantCode, tenantCode.trim().toUpperCase());
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
