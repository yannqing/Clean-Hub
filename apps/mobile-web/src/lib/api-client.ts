import { createCleanHubApiClient, isApiHttpError } from "@cleanhub/api-client";
import { defaultLocale, localeStorageKey, normalizeLocale } from "@cleanhub/i18n";

import { clearMobileSession, getAccessToken, getOrCreateDeviceId, getRefreshToken, saveMobileSession } from "./token-storage";
import { mobileReleaseConfig } from "./mobile-release-config";

// Concurrent 401s must share one refresh attempt, otherwise every parallel
// request replays the refresh call and hammers the API after token expiry.
let refreshInFlight: Promise<"retry" | "logout"> | null = null;

async function refreshSessionOnce(): Promise<"retry" | "logout"> {
  const refreshToken = await getRefreshToken();

  if (!refreshToken) {
    await clearMobileSession();
    return "logout";
  }

  try {
    // skipAuthRefresh: a 401 from the refresh call itself must not re-enter
    // onUnauthorized, otherwise it awaits its own in-flight promise forever.
    const nextSession = await apiClient.mobile.auth.refresh(
      {
        refreshToken,
        deviceId: await getOrCreateDeviceId(),
      },
      { skipAuthRefresh: true },
    );
    if (await getRefreshToken() !== refreshToken) {
      // A completed request from the previous account must never restore it.
      return await getAccessToken() ? "retry" : "logout";
    }
    await saveMobileSession(nextSession);
    return "retry";
  } catch (error) {
    if (isApiHttpError(error) && (error.status === 401 || error.status === 403)) {
      if (await getRefreshToken() === refreshToken) await clearMobileSession();
      return await getAccessToken() ? "retry" : "logout";
    }
    // A network failure is not evidence that a refresh credential is invalid.
    throw error;
  }
}

export const apiClient = createCleanHubApiClient({
  baseUrl: mobileReleaseConfig.apiBaseUrl,
  credentials: "omit",
  defaultHeaders: async () => {
    let storedLocale: string | null = null;
    if (typeof window !== "undefined") {
      try {
        const { Preferences } = await import("@capacitor/preferences");
        storedLocale = (await Preferences.get({ key: localeStorageKey })).value;
      } catch { /* Device language remains usable if preferences are unavailable. */ }
    }
    return {
      "X-CleanHub-Auth-Client": "mobile",
      "Accept-Language": normalizeLocale(storedLocale) ??
        normalizeLocale(typeof navigator === "undefined" ? null : navigator.language) ?? defaultLocale,
    };
  },
  tokenProvider: getAccessToken,
  onUnauthorized: async () => {
    refreshInFlight ??= refreshSessionOnce().finally(() => {
      refreshInFlight = null;
    });

    return refreshInFlight;
  },
});
