import { createId } from "@cleanhub/id";
import { eq, sql } from "drizzle-orm";

import { authLoginLockouts, type Database } from "@cleanhub/db";

import { AuthError } from "./auth.errors.js";
import type { EffectiveSecurityPolicy } from "../saas/security/security-policy.js";

export function buildLoginLockKey(
  normalizedIdentifier: string,
  tenantCode?: string,
): string {
  const scope = tenantCode?.trim().toLowerCase() || "global";

  return `${scope}:${normalizedIdentifier}`;
}

function accountLockedError(lockedUntil: Date): AuthError {
  return new AuthError(
    "ACCOUNT_LOCKED",
    "Too many failed login attempts. Try again later.",
    lockedUntil,
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
    throw accountLockedError(lockedUntil);
  }
}

export async function recordLoginFailure(
  db: Database,
  lockKey: string,
  policy: EffectiveSecurityPolicy,
): Promise<void> {
  const now = new Date();
  const lockedUntil = new Date(
    now.getTime() + policy.lockoutMinutes * 60 * 1000,
  );
  const failureWindowStart = new Date(
    now.getTime() - policy.lockoutMinutes * 60 * 1000,
  );
  const currentlyLocked = sql<boolean>`
    ${authLoginLockouts.lockedUntil} is not null
    and ${authLoginLockouts.lockedUntil} > ${now}
  `;
  const nextFailureCount = sql<number>`
    case
      when ${authLoginLockouts.lockedUntil} is not null
        or ${authLoginLockouts.updatedAt} <= ${failureWindowStart}
      then 1
      else ${authLoginLockouts.failedAttempts} + 1
    end
  `;
  const firstFailureLocks = policy.loginMaxAttempts <= 1;
  const rows = await db
    .insert(authLoginLockouts)
    .values({
      id: createId(),
      lockKey,
      failedAttempts: firstFailureLocks ? 0 : 1,
      lockedUntil: firstFailureLocks ? lockedUntil : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: authLoginLockouts.lockKey,
      set: {
        failedAttempts: sql<number>`
          case
            when ${currentlyLocked} then ${authLoginLockouts.failedAttempts}
            when ${nextFailureCount} >= ${policy.loginMaxAttempts} then 0
            else ${nextFailureCount}
          end
        `,
        lockedUntil: sql<Date | null>`
          case
            when ${currentlyLocked} then ${authLoginLockouts.lockedUntil}
            when ${nextFailureCount} >= ${policy.loginMaxAttempts}
              then ${lockedUntil}
            else null
          end
        `,
        updatedAt: sql<Date>`
          case
            when ${currentlyLocked} then ${authLoginLockouts.updatedAt}
            else ${now}
          end
        `,
      },
    })
    .returning({
      lockedUntil: authLoginLockouts.lockedUntil,
    });

  const effectiveLockedUntil = rows[0]?.lockedUntil;
  if (effectiveLockedUntil && effectiveLockedUntil.getTime() > now.getTime()) {
    throw accountLockedError(effectiveLockedUntil);
  }
}

export async function clearLoginLockout(
  db: Database,
  lockKey: string,
): Promise<void> {
  /* tenant-scope: system authentication lockout */ await db
    .delete(authLoginLockouts)
    .where(eq(authLoginLockouts.lockKey, lockKey));
}
