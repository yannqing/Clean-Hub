import type { AdminRole } from "@cleanhub/domain";
import { NextResponse, type NextRequest } from "next/server";

import {
  AUTH_REDIRECT_REASONS,
  AUTH_REDIRECT_REASON_PARAM,
  getWebAdminHomePath,
  type AuthRedirectReason,
} from "@/config/auth-routing";

const ACCESS_COOKIE_NAME = "cleanhub_access_token";
const REFRESH_COOKIE_NAME = "cleanhub_refresh_token";
const DEFAULT_API_BASE_URL = "http://localhost:4000";
const API_BASE_URL =
  process.env.CLEANHUB_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  DEFAULT_API_BASE_URL;

type AuthContext = {
  userId: string;
  tenantId: string | null;
  branchIds: string[];
  role: AdminRole;
  roles: string[];
  permissions: string[];
  accessTokenExpiresAt: string;
};

type AuthResolution = {
  authContext: AuthContext;
  setCookieHeaders: string[];
};

function isSaasPath(pathname: string): boolean {
  return pathname === "/saas" || pathname.startsWith("/saas/");
}

function isTenantPath(pathname: string): boolean {
  return pathname === "/tenant" || pathname.startsWith("/tenant/");
}

function splitSetCookieHeader(value: string): string[] {
  return value.split(/,(?=\s*[^;,=]+=)/).map((cookie) => cookie.trim());
}

function getSetCookieHeaders(headers: Headers): string[] {
  const headersWithSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof headersWithSetCookie.getSetCookie === "function") {
    return headersWithSetCookie.getSetCookie();
  }

  const setCookie = headers.get("set-cookie");
  return setCookie ? splitSetCookieHeader(setCookie) : [];
}

function appendSetCookieHeaders(
  response: NextResponse,
  setCookieHeaders: string[],
): NextResponse {
  for (const setCookie of setCookieHeaders) {
    response.headers.append("set-cookie", setCookie);
  }

  return response;
}

function createNextResponse(
  request: NextRequest,
  setCookieHeaders: string[] = [],
): NextResponse {
  if (setCookieHeaders.length === 0) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  const cookieValues = new Map<string, string>();

  for (const cookie of request.headers.get("cookie")?.split(";") ?? []) {
    const separatorIndex = cookie.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    cookieValues.set(
      cookie.slice(0, separatorIndex).trim(),
      cookie.slice(separatorIndex + 1).trim(),
    );
  }

  for (const setCookie of setCookieHeaders) {
    const cookie = setCookie.split(";", 1)[0];
    const separatorIndex = cookie?.indexOf("=") ?? -1;

    if (!cookie || separatorIndex <= 0) {
      continue;
    }

    const name = cookie.slice(0, separatorIndex).trim();
    const value = cookie.slice(separatorIndex + 1).trim();

    if (value) {
      cookieValues.set(name, value);
    } else {
      cookieValues.delete(name);
    }
  }

  if (cookieValues.size > 0) {
    requestHeaders.set(
      "cookie",
      [...cookieValues].map(([name, value]) => `${name}=${value}`).join("; "),
    );
  } else {
    requestHeaders.delete("cookie");
  }

  return appendSetCookieHeaders(
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    }),
    setCookieHeaders,
  );
}

function createRedirect(
  request: NextRequest,
  path: string,
  setCookieHeaders: string[] = [],
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = "";

  return appendSetCookieHeaders(NextResponse.redirect(url), setCookieHeaders);
}

function redirectToLogin(
  request: NextRequest,
  setCookieHeaders: string[] = [],
  reason?: AuthRedirectReason,
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", request.nextUrl.pathname);
  if (reason) {
    url.searchParams.set(AUTH_REDIRECT_REASON_PARAM, reason);
  }

  return appendSetCookieHeaders(NextResponse.redirect(url), setCookieHeaders);
}

/**
 * "unavailable" means the auth backend could not answer (5xx or network
 * failure). Session cookies must be kept in that case: bouncing an admin to
 * /login on an infrastructure hiccup would wrongly discard a valid session.
 */
type AuthOutcome = AuthResolution | null | "unavailable";

async function requestAuthContext(
  path: "/auth/me" | "/auth/refresh",
  request: NextRequest,
): Promise<AuthOutcome> {
  const cookie = request.headers.get("cookie");

  if (!cookie) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: path === "/auth/refresh" ? "POST" : "GET",
      headers: {
        accept: "application/json",
        cookie,
        "x-request-id": request.headers.get("x-request-id") ?? "",
      },
      cache: "no-store",
    });

    if (response.status >= 500) {
      return "unavailable";
    }

    if (!response.ok) {
      return null;
    }

    return {
      authContext: (await response.json()) as AuthContext,
      setCookieHeaders: getSetCookieHeaders(response.headers),
    };
  } catch {
    return "unavailable";
  }
}

async function resolveAuth(request: NextRequest): Promise<AuthOutcome> {
  const accessToken = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;

  if (accessToken) {
    const outcome = await requestAuthContext("/auth/me", request);

    if (outcome === "unavailable") {
      return "unavailable";
    }

    if (outcome) {
      return outcome;
    }
  }

  if (!refreshToken) {
    return null;
  }

  return requestAuthContext("/auth/refresh", request);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const resolution = await resolveAuth(request);

  if (resolution === "unavailable" && pathname !== "/login") {
    // Auth backend is temporarily unreachable. Keep the session cookies and
    // let the page-level error boundary surface the failure with a retry,
    // rather than signing every admin out over one bad response.
    return createNextResponse(request);
  }

  const auth = resolution === "unavailable" ? null : resolution;

  if (pathname === "/login") {
    if (!auth) {
      return NextResponse.next();
    }

    const defaultPath = getWebAdminHomePath(auth.authContext);
    if (!defaultPath) {
      return createNextResponse(request, auth.setCookieHeaders);
    }

    return createRedirect(request, defaultPath, auth.setCookieHeaders);
  }

  if (!auth) {
    return redirectToLogin(request);
  }

  const defaultPath = getWebAdminHomePath(auth.authContext);

  if (!defaultPath) {
    return redirectToLogin(
      request,
      auth.setCookieHeaders,
      AUTH_REDIRECT_REASONS.tenantAccessDenied,
    );
  }

  if (pathname === "/") {
    return createRedirect(request, defaultPath, auth.setCookieHeaders);
  }

  if (isSaasPath(pathname) && defaultPath !== "/saas") {
    return createRedirect(request, defaultPath, auth.setCookieHeaders);
  }

  if (isTenantPath(pathname) && defaultPath !== "/tenant") {
    return createRedirect(request, defaultPath, auth.setCookieHeaders);
  }

  return createNextResponse(request, auth.setCookieHeaders);
}

export const config = {
  matcher: ["/", "/login", "/api-health", "/saas/:path*", "/tenant/:path*"],
};
