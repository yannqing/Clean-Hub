import type { AuthTokenPair } from "./auth.types.js";

export type AuthCookieOptions = {
  secure?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  path?: string;
};

export const ACCESS_COOKIE_NAME = "cleanhub_access_token";
export const REFRESH_COOKIE_NAME = "cleanhub_refresh_token";

function serializeCookie(
  name: string,
  value: string,
  options: AuthCookieOptions & {
    maxAge?: number;
    expires?: Date;
  } = {},
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "HttpOnly",
    `Path=${options.path ?? "/"}`,
    `SameSite=${options.sameSite ?? "Lax"}`,
  ];

  if (options.secure ?? true) {
    parts.push("Secure");
  }

  if (typeof options.maxAge === "number") {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }

  return parts.join("; ");
}

export function createAuthCookieHeaders(
  tokens: AuthTokenPair,
  options: AuthCookieOptions = {},
): string[] {
  const now = Date.now();

  return [
    serializeCookie(ACCESS_COOKIE_NAME, tokens.accessToken, {
      ...options,
      path: "/",
      maxAge: Math.max(
        0,
        Math.floor((tokens.accessTokenExpiresAt.getTime() - now) / 1000),
      ),
      expires: tokens.accessTokenExpiresAt,
    }),
    serializeCookie(REFRESH_COOKIE_NAME, tokens.refreshToken, {
      ...options,
      path: "/",
      maxAge: Math.max(
        0,
        Math.floor((tokens.refreshTokenExpiresAt.getTime() - now) / 1000),
      ),
      expires: tokens.refreshTokenExpiresAt,
    }),
  ];
}

export function createClearAuthCookieHeaders(
  options: AuthCookieOptions = {},
): string[] {
  const expiredAt = new Date(0);

  return [
    serializeCookie(ACCESS_COOKIE_NAME, "", {
      ...options,
      path: "/",
      maxAge: 0,
      expires: expiredAt,
    }),
    serializeCookie(REFRESH_COOKIE_NAME, "", {
      ...options,
      path: "/",
      maxAge: 0,
      expires: expiredAt,
    }),
    serializeCookie(REFRESH_COOKIE_NAME, "", {
      ...options,
      path: "/auth",
      maxAge: 0,
      expires: expiredAt,
    }),
  ];
}
