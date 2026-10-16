import { createCleanHubApiClient } from "@cleanhub/api-client";

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
    await saveMobileSession(nextSession);
    return "retry";
  } catch {
    await clearMobileSession();
    return "logout";
  }
}

export const apiClient = createCleanHubApiClient({
  baseUrl: mobileReleaseConfig.apiBaseUrl,
  credentials: "omit",
  defaultHeaders: {
    "X-CleanHub-Auth-Client": "mobile",
  },
  tokenProvider: getAccessToken,
  onUnauthorized: async () => {
    refreshInFlight ??= refreshSessionOnce().finally(() => {
      refreshInFlight = null;
    });

    return refreshInFlight;
  },
});
