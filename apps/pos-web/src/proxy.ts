import { NextResponse, type NextRequest } from "next/server";

import type { AdminRole, AuthContext } from "@cleanhub/api-client";

const ACCESS_COOKIE_NAME = "cleanhub_access_token";
const REFRESH_COOKIE_NAME = "cleanhub_refresh_token";
const DEFAULT_API_BASE_URL = "http://localhost:4000";
const API_BASE_URL =
  process.env.CLEANHUB_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  DEFAULT_API_BASE_URL;

const LOGIN_PATH = "/login";

const POS_ALLOWED_ROLES: ReadonlySet<AdminRole> = new Set([
  "owner",
  "manager",
  "cashier",
]);

function isPosAllowedRole(role: AdminRole | string): boolean {
  return POS_ALLOWED_ROLES.has(role as AdminRole);
}

type AuthResolution = {
  authContext: AuthContext;
  setCookieHeaders: string[];
};

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

function parseCookieHeader(cookieHeader: string | null): Map<string, string> {
  const cookies = new Map<string, string>();

  if (!cookieHeader) {
    return cookies;
  }

  for (const pair of cookieHeader.split(";")) {
    const trimmed = pair.trim();
    const equalsIndex = trimmed.indexOf("=");

    if (equalsIndex <= 0) {
      continue;
    }

    cookies.set(trimmed.slice(0, equalsIndex), trimmed.slice(equalsIndex + 1));
  }

  return cookies;
}

function mergeSetCookieIntoCookieHeader(
  cookieHeader: string | null,
  setCookieHeaders: string[],
): string {
  const cookies = parseCookieHeader(cookieHeader);

  for (const setCookie of setCookieHeaders) {
    const [nameValue, ...attributes] = setCookie.split(";");
    const equalsIndex = nameValue.indexOf("=");

    if (equalsIndex <= 0) {
      continue;
    }

    const name = nameValue.slice(0, equalsIndex).trim();
    const value = nameValue.slice(equalsIndex + 1);
    const removesCookie =
      value === "" ||
      attributes.some((attribute) => /^max-age=0$/i.test(attribute.trim()));

    if (removesCookie) {
      cookies.delete(name);
    } else {
      cookies.set(name, value);
    }
  }

  return Array.from(cookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function createNextResponse(
  request: NextRequest,
  setCookieHeaders: string[] = [],
): NextResponse {
  if (setCookieHeaders.length === 0) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  const cookieHeader = mergeSetCookieIntoCookieHeader(
    request.headers.get("cookie"),
    setCookieHeaders,
  );

  if (cookieHeader) {
    requestHeaders.set("cookie", cookieHeader);
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

function redirectToLogin(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = LOGIN_PATH;
  url.searchParams.set("next", request.nextUrl.pathname);

  return NextResponse.redirect(url);
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

  if (pathname === LOGIN_PATH) {
    if (!auth || !isPosAllowedRole(auth.authContext.role)) {
      return createNextResponse(request);
    }

    return createRedirect(request, "/", auth.setCookieHeaders);
  }

  if (!auth) {
    return redirectToLogin(request);
  }

  // POS terminals are tenant-scoped; reject SaaS platform roles.
  if (!isPosAllowedRole(auth.authContext.role)) {
    return redirectToLogin(request);
  }

  return createNextResponse(request, auth.setCookieHeaders);
}

export const config = {
  /**
   * Guard every navigable route plus /login. Static assets, Next internals
   * and the public logo are skipped automatically by the negative-lookahead.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|cleanhub-logo-mark.jpg).*)"],
};
