import type { AuthTokenPair } from "./auth.types.js";

export type AuthCookieOptions = {
  secure?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  path?: string;
};

export const ACCESS_COOKIE_NAME = "cleanhub_access_token";
export const REFRESH_COOKIE_NAME = "cleanhub_refresh_token";
export const POS_ACCESS_COOKIE_NAME = "cleanhub_pos_access_token";
export const POS_REFRESH_COOKIE_NAME = "cleanhub_pos_refresh_token";
export const AUTH_CLIENT_HEADER_NAME = "x-cleanhub-auth-client";
export const POS_AUTH_CLIENT = "pos";

export type AuthCookieNames = {
  access: string;
  refresh: string;
};

export function resolveAuthCookieNames(
  authClient: string | undefined,
): AuthCookieNames {
  return authClient?.trim().toLowerCase() === POS_AUTH_CLIENT
    ? {
        access: POS_ACCESS_COOKIE_NAME,
        refresh: POS_REFRESH_COOKIE_NAME,
      }
    : {
        access: ACCESS_COOKIE_NAME,
        refresh: REFRESH_COOKIE_NAME,
      };
}

/**
 * Auth services produce the canonical web cookie names. Rewrite only the
 * cookie-name segment for POS responses so both apps can stay signed in on
 * the same host. Browser cookies are not isolated by port.
 */
export function scopeAuthCookieHeaders(
  headers: string[],
  authClient: string | undefined,
): string[] {
  const names = resolveAuthCookieNames(authClient);

  if (names.access === ACCESS_COOKIE_NAME) {
    return headers;
  }

  return headers.map((header) => {
    const separatorIndex = header.indexOf("=");
    if (separatorIndex <= 0) {
      return header;
    }

    const name = header.slice(0, separatorIndex);
    const scopedName =
      name === ACCESS_COOKIE_NAME
        ? names.access
        : name === REFRESH_COOKIE_NAME
          ? names.refresh
          : name;

    return `${scopedName}${header.slice(separatorIndex)}`;
  });
}

/**
 * Resolve the single Secure-cookie policy used by every browser credential.
 *
 * `AUTH_COOKIE_SECURE` is intentionally authoritative when configured so a
 * deployment does not silently weaken one cookie type when `NODE_ENV` differs
 * from the process manager's production label.
 */
export function resolveAuthCookieSecure(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const configured = env.AUTH_COOKIE_SECURE?.trim().toLowerCase();

  if (["1", "true", "yes"].includes(configured ?? "")) {
    return true;
  }

  if (["0", "false", "no"].includes(configured ?? "")) {
    return false;
  }

  return env.NODE_ENV === "production";
}

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
