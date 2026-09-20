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

/**
 * Where the customer session is kept.
 *
 * On a device Capacitor routes `Preferences` to the native implementation --
 * SharedPreferences on Android, the keychain-backed store on iOS -- and that is
 * the only configuration this app actually ships in: `next.config` exports a
 * static bundle that `apps/mobile` loads, and nothing deploys it as a website.
 *
 * In a plain browser (`pnpm dev`, or a static export served directly)
 * `Preferences` resolves to `PreferencesWeb`, which IS `window.localStorage`.
 * So does the fallback below. A browser therefore keeps the tokens somewhere
 * any injected script can read, whichever path is taken -- there is no safer
 * option available to a page, which is why CLAUDE.md requires HttpOnly cookies
 * for the web apps and why this one is not served as a website.
 *
 * Android backups are disabled for the same reason: SharedPreferences is a
 * backup domain, so without that, the session would sync to the user's cloud
 * account. See `apps/mobile/android/.../data_extraction_rules.xml`.
 */
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
    // Only reachable if the Capacitor import itself failed; see the note on
    // getPreferenceStore for why this is no worse than what it falls back from.
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
