import {
  buildWebSocketUrl,
  createCleanHubApiClient,
  type ApiRequestOptions,
} from "@cleanhub/api-client";

import {
  invalidatePosTerminalSession,
  isPosTerminalSessionError,
  redirectToPosLogin,
} from "@/lib/pos-terminal-session";
import { POS_AUTH_CLIENT_HEADERS } from "@/lib/auth-client";

const DEFAULT_API_BASE_URL = "http://localhost:4000";
let refreshRequest: Promise<unknown> | null = null;

export function getPosApiBaseUrl(): string {
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
  baseUrl: getPosApiBaseUrl(),
  credentials: "include",
  defaultHeaders: POS_AUTH_CLIENT_HEADERS,
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

export function getPosRealtimeUrl(path = "/realtime/pos"): string {
  return buildWebSocketUrl(getPosApiBaseUrl(), path);
}

export async function apiClient<TResponse = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<TResponse> {
  return posApi.http.request<TResponse>(path, options);
}
