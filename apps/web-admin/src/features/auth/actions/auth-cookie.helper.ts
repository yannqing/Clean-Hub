import "server-only";

import { cookies } from "next/headers";
import {
  parseString,
  splitCookiesString,
  type Cookie,
} from "set-cookie-parser";

const AUTH_COOKIE_NAMES = new Set([
  "cleanhub_access_token",
  "cleanhub_refresh_token",
]);

type SameSite = "lax" | "strict" | "none";

function getSetCookieHeaders(headers: Headers): string[] {
  const headersWithSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof headersWithSetCookie.getSetCookie === "function") {
    return headersWithSetCookie.getSetCookie();
  }

  const combinedHeader = headers.get("set-cookie");
  return combinedHeader ? splitCookiesString(combinedHeader) : [];
}

function normalizeSameSite(value: Cookie["sameSite"]): SameSite | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.toLowerCase();
  return normalized === "lax" ||
    normalized === "strict" ||
    normalized === "none"
    ? normalized
    : undefined;
}

export async function applyAuthCookies(
  response: Response,
): Promise<Set<string>> {
  const cookieStore = await cookies();
  const appliedCookieNames = new Set<string>();

  for (const header of getSetCookieHeaders(response.headers)) {
    const parsed = parseString(header, { decodeValues: false });

    if (!parsed || !AUTH_COOKIE_NAMES.has(parsed.name)) {
      continue;
    }

    cookieStore.set({
      name: parsed.name,
      value: parsed.value,
      expires: parsed.expires,
      httpOnly: parsed.httpOnly,
      maxAge: parsed.maxAge,
      path: parsed.path ?? "/",
      sameSite: normalizeSameSite(parsed.sameSite),
      secure: parsed.secure,
    });
    appliedCookieNames.add(parsed.name);
  }

  return appliedCookieNames;
}

export async function getForwardedCookieHeader(): Promise<string> {
  return (await cookies()).toString();
}
