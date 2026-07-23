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

async function requestAuthContext(
  path: "/auth/me" | "/auth/refresh",
  request: NextRequest,
): Promise<AuthResolution | null> {
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

    if (!response.ok) {
      return null;
    }

    return {
      authContext: (await response.json()) as AuthContext,
      setCookieHeaders: getSetCookieHeaders(response.headers),
    };
  } catch {
    return null;
  }
}

async function resolveAuth(request: NextRequest): Promise<AuthResolution | null> {
  const accessToken = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;

  if (accessToken) {
    const authContext = await requestAuthContext("/auth/me", request);

    if (authContext) {
      return authContext;
    }
  }

  if (!refreshToken) {
    return null;
  }

  return requestAuthContext("/auth/refresh", request);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const auth = await resolveAuth(request);

  if (pathname === "/login") {
    if (!auth) {
      return NextResponse.next();
    }

    const defaultPath = getWebAdminHomePath(auth.authContext);
    if (!defaultPath) {
      return appendSetCookieHeaders(
        NextResponse.next(),
        auth.setCookieHeaders,
      );
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

  return appendSetCookieHeaders(NextResponse.next(), auth.setCookieHeaders);
}

export const config = {
  matcher: ["/", "/login", "/api-health", "/saas/:path*", "/tenant/:path*"],
};
