import {
  createCleanHubApiClient,
  type ApiRequestOptions,
} from "@cleanhub/api-client";

import { webAdminRoutes } from "@/config/routes";

const DEFAULT_API_BASE_URL = "http://localhost:4000";
let refreshRequest: Promise<unknown> | null = null;

function getApiBaseUrl(): string {
  if (typeof window === "undefined") {
    return (
      process.env.CLEANHUB_API_BASE_URL ??
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      DEFAULT_API_BASE_URL
    );
  }

  return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

function redirectToLogin(): void {
  if (typeof window === "undefined") {
    return;
  }

  if (window.location.pathname !== webAdminRoutes.login) {
    window.location.assign(webAdminRoutes.login);
  }
}

export const webAdminApi = createCleanHubApiClient({
  baseUrl: getApiBaseUrl(),
  credentials: "include",
  timeoutMs: 30_000,
  retry: {
    retries: 1,
  },
  onUnauthorized: async (_error, context) => {
    if (context.path === "/auth/refresh") {
      return "logout";
    }

    try {
      refreshRequest ??= webAdminApi.auth.refresh().finally(() => {
        refreshRequest = null;
      });

      await refreshRequest;
      return "retry";
    } catch {
      await webAdminApi.auth.logout().catch(() => undefined);
      redirectToLogin();
      return "logout";
    }
  },
});

export async function apiClient<TResponse = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<TResponse> {
  return webAdminApi.http.request<TResponse>(path, options);
}
