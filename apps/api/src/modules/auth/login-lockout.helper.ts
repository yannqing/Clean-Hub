import { createId } from "@cleanhub/id";
import { eq } from "drizzle-orm";

import { authLoginLockouts, type Database } from "@cleanhub/db";

import { AuthError } from "./auth.errors.js";
import type { EffectiveSecurityPolicy } from "../saas-security/security-policy.js";

export function buildLoginLockKey(
  normalizedIdentifier: string,
  tenantCode?: string,
): string {
  const scope = tenantCode?.trim().toLowerCase() || "saas";

  return `${scope}:${normalizedIdentifier}`;
}

function accountLockedError(): AuthError {
  return new AuthError(
    "ACCOUNT_LOCKED",
    "Too many failed login attempts. Try again later.",
  );
}

export async function assertLoginNotLocked(
  db: Database,
  lockKey: string,
): Promise<void> {
  const rows = await db
    .select({
      lockedUntil: authLoginLockouts.lockedUntil,
    })
    .from(authLoginLockouts)
    .where(eq(authLoginLockouts.lockKey, lockKey))
    .limit(1);

  const lockedUntil = rows[0]?.lockedUntil;

  if (lockedUntil && lockedUntil.getTime() > Date.now()) {
    throw accountLockedError();
  }
}

export async function recordLoginFailure(
  db: Database,
  lockKey: string,
  policy: EffectiveSecurityPolicy,
): Promise<void> {
  const rows = await db
    .select({
      id: authLoginLockouts.id,
      failedAttempts: authLoginLockouts.failedAttempts,
      lockedUntil: authLoginLockouts.lockedUntil,
    })
    .from(authLoginLockouts)
    .where(eq(authLoginLockouts.lockKey, lockKey))
    .limit(1);

  const existing = rows[0];
  const now = new Date();

  if (existing?.lockedUntil && existing.lockedUntil.getTime() > now.getTime()) {
    throw accountLockedError();
  }

  const lockExpired =
    existing?.lockedUntil !== null &&
    existing?.lockedUntil !== undefined &&
    existing.lockedUntil.getTime() <= now.getTime();
  const failedAttempts = (lockExpired ? 0 : (existing?.failedAttempts ?? 0)) + 1;

  if (failedAttempts >= policy.loginMaxAttempts) {
    const lockedUntil = new Date(
      now.getTime() + policy.lockoutMinutes * 60 * 1000,
    );

    if (existing) {
      await db
        .update(authLoginLockouts)
        .set({
          failedAttempts: 0,
          lockedUntil,
          updatedAt: now,
        })
        .where(eq(authLoginLockouts.id, existing.id));
    } else {
      await db.insert(authLoginLockouts).values({
        id: createId(),
        lockKey,
        failedAttempts: 0,
        lockedUntil,
        updatedAt: now,
      });
    }

    throw accountLockedError();
  }

  if (existing) {
    await db
      .update(authLoginLockouts)
      .set({
        failedAttempts,
        lockedUntil: null,
        updatedAt: now,
      })
      .where(eq(authLoginLockouts.id, existing.id));
  } else {
    await db.insert(authLoginLockouts).values({
      id: createId(),
      lockKey,
      failedAttempts,
      lockedUntil: null,
      updatedAt: now,
    });
  }
}

export async function clearLoginLockout(
  db: Database,
  lockKey: string,
): Promise<void> {
  await db
    .delete(authLoginLockouts)
    .where(eq(authLoginLockouts.lockKey, lockKey));
}
