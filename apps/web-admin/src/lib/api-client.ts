import {
  createCleanHubApiClient,
  isApiHttpError,
  type ApiRequestOptions,
} from "@cleanhub/api-client";

import { webAdminRoutes } from "@/config/routes";
import {
  AUTH_REDIRECT_REASONS,
  AUTH_REDIRECT_REASON_PARAM,
  type AuthRedirectReason,
} from "@/config/auth-routing";

const DEFAULT_API_BASE_URL = "http://localhost:4000";
let refreshRequest: Promise<unknown> | null = null;
let loginRedirectPending = false;

const TENANT_ACCESS_DENIED_MESSAGE =
  "User cannot access tenant resources.";

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

function redirectToLogin(reason: AuthRedirectReason): void {
  if (typeof window === "undefined") {
    return;
  }

  if (
    window.location.pathname === webAdminRoutes.login ||
    loginRedirectPending
  ) {
    return;
  }

  loginRedirectPending = true;
  const url = new URL(webAdminRoutes.login, window.location.origin);
  url.searchParams.set(
    "next",
    `${window.location.pathname}${window.location.search}`,
  );
  url.searchParams.set(AUTH_REDIRECT_REASON_PARAM, reason);
  window.location.replace(url.toString());
}

function isTenantAccessDeniedError(error: unknown): boolean {
  return (
    isApiHttpError(error) &&
    error.status === 403 &&
    error.code === "FORBIDDEN" &&
    error.message === TENANT_ACCESS_DENIED_MESSAGE
  );
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
      redirectToLogin(AUTH_REDIRECT_REASONS.sessionExpired);
      return "logout";
    }
  },
  onError: (error) => {
    if (isTenantAccessDeniedError(error)) {
      redirectToLogin(AUTH_REDIRECT_REASONS.tenantAccessDenied);
    }
  },
});

export async function apiClient<TResponse = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<TResponse> {
  return webAdminApi.http.request<TResponse>(path, options);
}
