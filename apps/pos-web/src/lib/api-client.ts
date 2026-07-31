import {
  createCleanHubApiClient,
  type ApiRequestOptions,
} from "@cleanhub/api-client";

import {
  invalidatePosTerminalSession,
  isPosTerminalSessionError,
  redirectToPosLogin,
} from "@/lib/pos-terminal-session";

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

export const posApi = createCleanHubApiClient({
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
      refreshRequest ??= posApi.auth.refresh().finally(() => {
        refreshRequest = null;
      });

      await refreshRequest;
      return "retry";
    } catch {
      await posApi.auth.logout().catch(() => undefined);
      redirectToPosLogin();
      return "logout";
    }
  },
  onError: (error) => {
    if (isPosTerminalSessionError(error)) {
      invalidatePosTerminalSession();
    }
  },
});

export async function apiClient<TResponse = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<TResponse> {
  return posApi.http.request<TResponse>(path, options);
}
