import { NextResponse, type NextRequest } from "next/server";

import type { AdminRole, AuthContext } from "@cleanhub/api-client";

import {
  POS_ACCESS_COOKIE_NAME,
  POS_AUTH_CLIENT_HEADER_NAME,
  POS_AUTH_CLIENT_HEADER_VALUE,
  POS_REFRESH_COOKIE_NAME,
} from "./lib/auth-client";
import { resolvePosReturnPath } from "./lib/pos-return-path";

const DEFAULT_API_BASE_URL = "http://localhost:4000";
const API_BASE_URL =
  process.env.CLEANHUB_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  DEFAULT_API_BASE_URL;

const LOGIN_PATH = "/login";
const SETUP_PATH = "/setup";

const POS_ALLOWED_ROLES: ReadonlySet<AdminRole> = new Set([
  "owner",
  "manager",
  "cashier",
]);

function isPosAllowedRole(role: AdminRole | string): boolean {
  return POS_ALLOWED_ROLES.has(role as AdminRole);
}

function isSetupAdministrator(role: AdminRole | string): boolean {
  return role === "owner" || role === "manager";
}

function isTerminalSession(authContext: AuthContext): boolean {
  return Boolean(
    authContext.terminalId &&
    authContext.terminalBranchId &&
    authContext.terminalDeviceId &&
    typeof authContext.terminalCredentialVersion === "number",
  );
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
  const returnPath = resolvePosReturnPath(
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  url.pathname = LOGIN_PATH;
  url.search = "";
  url.searchParams.set("next", returnPath);

  return NextResponse.redirect(url);
}

/**
 * "unavailable" means the auth backend could not answer (5xx or network
 * failure). Session cookies must be kept in that case: bouncing the user to
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
        [POS_AUTH_CLIENT_HEADER_NAME]: POS_AUTH_CLIENT_HEADER_VALUE,
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
  const accessToken = request.cookies.get(POS_ACCESS_COOKIE_NAME)?.value;
  const refreshToken = request.cookies.get(POS_REFRESH_COOKIE_NAME)?.value;

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

  if (
    resolution === "unavailable" &&
    pathname !== LOGIN_PATH &&
    pathname !== SETUP_PATH &&
    !pathname.startsWith(`${SETUP_PATH}/`)
  ) {
    // Auth backend is temporarily unreachable. Keep the session cookies and
    // let the page-level error boundary surface the failure with a retry.
    return createNextResponse(request);
  }

  const auth = resolution === "unavailable" ? null : resolution;
  const authContext = auth?.authContext;
  const terminalSession = authContext ? isTerminalSession(authContext) : false;

  if (pathname === LOGIN_PATH) {
    if (!authContext || !isPosAllowedRole(authContext.role)) {
      return createNextResponse(request);
    }

    if (terminalSession) {
      return createRedirect(request, "/", auth.setCookieHeaders);
    }

    if (isSetupAdministrator(authContext.role)) {
      return createRedirect(request, SETUP_PATH, auth.setCookieHeaders);
    }

    // A password-authenticated cashier must not enter the operating shell.
    // Keep the login route available so the client bootstrap can direct the
    // device into administrator setup.
    return createNextResponse(request, auth.setCookieHeaders);
  }

  if (pathname === SETUP_PATH || pathname.startsWith(`${SETUP_PATH}/`)) {
    if (terminalSession && auth) {
      return createRedirect(request, "/", auth.setCookieHeaders);
    }

    // Setup is intentionally available before authentication. The setup
    // wizard narrows full-account authentication to Owner/Manager and only
    // then enables terminal enrollment.
    return createNextResponse(request, auth?.setCookieHeaders);
  }

  if (!auth) {
    return redirectToLogin(request);
  }

  // POS terminals are tenant-scoped; reject SaaS platform roles.
  if (!isPosAllowedRole(auth.authContext.role)) {
    return redirectToLogin(request);
  }

  if (!terminalSession) {
    if (isSetupAdministrator(auth.authContext.role)) {
      return createRedirect(request, SETUP_PATH, auth.setCookieHeaders);
    }

    return createRedirect(request, LOGIN_PATH, auth.setCookieHeaders);
  }

  return createNextResponse(request, auth.setCookieHeaders);
}

export const config = {
  /**
   * Guard every navigable route plus /login. Static assets, Next internals
   * plus install metadata and the public logo are skipped by the
   * negative-lookahead.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|cleanhub-logo-mark.jpg).*)",
  ],
};
