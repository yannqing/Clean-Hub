import { getDb, type Database } from "@cleanhub/db";

import { AuthError } from "./auth.errors.js";
import { AuthService } from "./auth.service.js";
import { resolveAuthCookieSecure } from "./cookie.service.js";

export type CreateAuthServiceFromEnvOptions = {
  db?: Database;
  env?: NodeJS.ProcessEnv;
};

function readOptionalPositiveInteger(
  value: string | undefined,
): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function createAuthServiceFromEnv({
  db = getDb(),
  env = process.env,
}: CreateAuthServiceFromEnvOptions = {}): AuthService {
  const accessTokenSecret = env.AUTH_TOKEN_SECRET;

  if (!accessTokenSecret) {
    throw new AuthError(
      "AUTH_CONFIG_INVALID",
      "AUTH_TOKEN_SECRET is required to initialize AuthService.",
    );
  }

  return new AuthService({
    db,
    accessTokenSecret,
    cookieSecure: resolveAuthCookieSecure(env),
    accessTokenTtlSeconds: readOptionalPositiveInteger(
      env.AUTH_ACCESS_TOKEN_TTL_SECONDS,
    ),
    refreshTokenTtlSeconds: readOptionalPositiveInteger(
      env.AUTH_REFRESH_TOKEN_TTL_SECONDS,
    ),
  });
}
