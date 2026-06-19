import { cookies, headers } from "next/headers";

import type { AuthContext } from "@cleanhub/api-client";

import { isPosAllowedRole, type PosSessionUser } from "./session";

const ACCESS_COOKIE_NAME = "cleanhub_access_token";
const REFRESH_COOKIE_NAME = "cleanhub_refresh_token";
const DEFAULT_API_BASE_URL = "http://localhost:4000";

function getApiBaseUrl(): string {
  return (
    process.env.CLEANHUB_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    DEFAULT_API_BASE_URL
  );
}

function getSetCookieHeaders(responseHeaders: Headers): string[] {
  const headersWithSetCookie = responseHeaders as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof headersWithSetCookie.getSetCookie === "function") {
    return headersWithSetCookie.getSetCookie();
  }

  const setCookie = responseHeaders.get("set-cookie");
  return setCookie ? [setCookie] : [];
}

async function callAuth(
  path: "/auth/me" | "/auth/refresh",
  method: "GET" | "POST",
  cookieHeader: string,
  requestId: string,
): Promise<{ authContext: AuthContext; setCookieHeaders: string[] } | null> {
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers: {
        accept: "application/json",
        cookie: cookieHeader,
        "x-request-id": requestId,
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

/**
 * Resolve the signed-in POS user on the server. Forwards the incoming request
 * cookies to /auth/me (falling back to /auth/refresh) and returns the session
 * when the user holds a POS-allowed tenant role. Returns null otherwise.
 *
 * The refreshed Set-Cookie headers are applied back to the response so token
 * rotation propagates to the browser.
 */
export async function getCurrentUser(): Promise<PosSessionUser | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value;
  if (!accessToken && !refreshToken) {
    return null;
  }

  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const requestId = (await headers()).get("x-request-id") ?? "";

  const attempts: Array<{
    path: "/auth/me" | "/auth/refresh";
    method: "GET" | "POST";
  }> = [];
  if (accessToken) {
    attempts.push({ path: "/auth/me", method: "GET" });
  }
  if (refreshToken) {
    attempts.push({ path: "/auth/refresh", method: "POST" });
  }

  for (const { path, method } of attempts) {
    const result = await callAuth(path, method, cookieHeader, requestId);
    if (!result) {
      continue;
    }

    for (const setCookie of result.setCookieHeaders) {
      const [nameValue] = setCookie.split(";");
      const equalsIndex = nameValue.indexOf("=");
      if (equalsIndex === -1) {
        continue;
      }

      const name = nameValue.slice(0, equalsIndex).trim();
      const value = nameValue.slice(equalsIndex + 1);
      cookieStore.set(name, value, { path: "/" });
    }

    if (!isPosAllowedRole(result.authContext.role)) {
      return null;
    }

    return result.authContext;
  }

  return null;
}
