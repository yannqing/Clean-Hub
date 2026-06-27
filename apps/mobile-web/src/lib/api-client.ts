import { createCleanHubApiClient } from "@cleanhub/api-client";

import { clearMobileSession, getAccessToken, getOrCreateDeviceId, getRefreshToken, saveMobileSession } from "./token-storage";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export const apiClient = createCleanHubApiClient({
  baseUrl: API_BASE_URL,
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
