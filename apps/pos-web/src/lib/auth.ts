import { cookies, headers } from "next/headers";

import type { AuthContext } from "@cleanhub/api-client";

import {
  POS_ACCESS_COOKIE_NAME,
  POS_AUTH_CLIENT_HEADER_NAME,
  POS_AUTH_CLIENT_HEADER_VALUE,
  POS_REFRESH_COOKIE_NAME,
} from "./auth-client";
import { isPosAllowedRole, type PosSessionUser } from "./session";

const DEFAULT_API_BASE_URL = "http://localhost:4000";

function getApiBaseUrl(): string {
  return (
    process.env.CLEANHUB_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    DEFAULT_API_BASE_URL
  );
}

async function callAuth(
  path: "/auth/me" | "/auth/refresh",
  method: "GET" | "POST",
  cookieHeader: string,
  requestId: string,
): Promise<AuthContext | null> {
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers: {
        accept: "application/json",
        cookie: cookieHeader,
        [POS_AUTH_CLIENT_HEADER_NAME]: POS_AUTH_CLIENT_HEADER_VALUE,
        "x-request-id": requestId,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as AuthContext;
  } catch {
    return null;
  }
}

/**
 * Resolve the signed-in POS user on the server. Forwards the incoming request
 * cookies to /auth/me (falling back to /auth/refresh) and returns the session
 * when the user holds a POS-allowed tenant role. Returns null otherwise.
 */
export async function getCurrentUser(): Promise<PosSessionUser | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(POS_ACCESS_COOKIE_NAME)?.value;
  const refreshToken = cookieStore.get(POS_REFRESH_COOKIE_NAME)?.value;
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
    const authContext = await callAuth(path, method, cookieHeader, requestId);
    if (!authContext) {
      continue;
    }

    if (!isPosAllowedRole(authContext.role)) {
      return null;
    }

    return authContext;
  }

  return null;
}
