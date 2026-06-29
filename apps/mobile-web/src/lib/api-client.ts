import { createCleanHubApiClient } from "@cleanhub/api-client";

import { clearMobileSession, getAccessToken, getOrCreateDeviceId, getRefreshToken, saveMobileSession } from "./token-storage";
import { mobileReleaseConfig } from "./mobile-release-config";

export const apiClient = createCleanHubApiClient({
  baseUrl: mobileReleaseConfig.apiBaseUrl,
  credentials: "omit",
  tokenProvider: getAccessToken,
  onUnauthorized: async () => {
    const refreshToken = await getRefreshToken();

    if (!refreshToken) {
      await clearMobileSession();
      return "logout";
    }

    try {
      const nextSession = await apiClient.mobile.auth.refresh({
        refreshToken,
        deviceId: await getOrCreateDeviceId(),
      });
      await saveMobileSession(nextSession);
      return "retry";
    } catch {
      await clearMobileSession();
      return "logout";
    }
  },
});
