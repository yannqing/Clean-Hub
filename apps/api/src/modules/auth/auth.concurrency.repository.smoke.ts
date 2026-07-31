import assert from "node:assert/strict";

import "../../config/env.js";

import { and, eq, inArray, isNull } from "drizzle-orm";

import {
  auditLogs,
  authLoginLockouts,
  authRefreshTokens,
  branches,
  closeDbConnection,
  getDb,
  posTerminalSettings,
  roles,
  tenants,
  userRoles,
  users,
  type Database,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import type { AuthContext } from "./auth.types.js";
import { AuthError } from "./auth.errors.js";
import { lockPosPinAttempt } from "./auth.repository.js";
import {
  buildLoginLockKey,
  recordLoginFailure,
} from "./login-lockout.helper.js";
import { hashPin } from "./password.service.js";
import {
  buildPosPinLockKeys,
  generateTerminalCredential,
  hashTerminalCredential,
} from "./pos-terminal-credential.js";
import { AuthService } from "./auth.service.js";
import { hashOpaqueToken } from "./token.service.js";
import {
  bindPosDevice,
  revokePosDevice,
  rotatePosDeviceCredential,
  updatePosDevice,
} from "../pos/auth/auth.service.js";
import { resolveEffectiveSecurityPolicy } from "../saas/security/security-policy.js";

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
};

function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function databaseErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const directCode = (error as { code?: unknown }).code;
  if (typeof directCode === "string") return directCode;
  return databaseErrorCode((error as { cause?: unknown }).cause);
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function withTimeout<T>(
  promise: Promise<T>,
  milliseconds: number,
  message: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), milliseconds);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

async function waitForTerminalLock(
  db: Database,
  terminalId: string,
): Promise<void> {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    try {
      await db.transaction(async (tx) => {
        await tx
          .select({ id: posTerminalSettings.id })
          .from(posTerminalSettings)
          .where(eq(posTerminalSettings.id, terminalId))
          .for("update", { noWait: true })
          .limit(1);
      });
    } catch (error) {
      if (databaseErrorCode(error) === "55P03") return;
      throw error;
    }

    await delay(10);
  }

  throw new Error(`Timed out waiting for terminal lock ${terminalId}.`);
}

function holdRefreshTokenLock(
  db: Database,
  tokenHash: string,
): {
  acquired: Promise<void>;
  release: () => void;
  done: Promise<void>;
} {
  const acquired = deferred();
  const released = deferred();
  const done = db.transaction(async (tx) => {
    await tx
      .select({ id: authRefreshTokens.id })
      .from(authRefreshTokens)
      .where(eq(authRefreshTokens.tokenHash, tokenHash))
      .for("update")
      .limit(1);
    acquired.resolve();
    await released.promise;
  });

  return {
    acquired: acquired.promise,
    release: released.resolve,
    done,
  };
}

function holdPosPinAdvisoryLock(
  db: Database,
  terminalId: string,
): {
  acquired: Promise<void>;
  release: () => void;
  done: Promise<void>;
} {
  const acquired = deferred();
  const released = deferred();
  const done = db.transaction(async (tx) => {
    await lockPosPinAttempt(tx, terminalId);
    acquired.resolve();
    await released.promise;
  });

  return {
    acquired: acquired.promise,
    release: released.resolve,
    done,
  };
}

function holdUserLock(
  db: Database,
  userId: string,
): {
  acquired: Promise<void>;
  release: () => void;
  done: Promise<void>;
} {
  const acquired = deferred();
  const released = deferred();
  const done = db.transaction(async (tx) => {
    await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .for("update")
      .limit(1);
    acquired.resolve();
    await released.promise;
  });

  return {
    acquired: acquired.promise,
    release: released.resolve,
    done,
  };
}

async function insertTerminalRefreshToken(input: {
  db: Database;
  userId: string;
  tenantId: string;
  terminalId: string;
  deviceId: string;
}): Promise<{ familyId: string; rawToken: string; tokenId: string }> {
  const rawToken = `refresh-smoke-${createId()}-${createId()}`;
  const tokenId = createId();
  const familyId = createId();

  await input.db.insert(authRefreshTokens).values({
    id: tokenId,
    userId: input.userId,
    tenantId: input.tenantId,
    terminalId: input.terminalId,
    deviceId: input.deviceId,
    tokenHash: hashOpaqueToken(rawToken),
    familyId,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });

  return { familyId, rawToken, tokenId };
}

async function assertFamilyHasNoActiveTokens(
  db: Database,
  familyId: string,
  minimumRows = 1,
): Promise<void> {
  const rows = await db
    .select({
      id: authRefreshTokens.id,
      revokedAt: authRefreshTokens.revokedAt,
    })
    .from(authRefreshTokens)
    .where(eq(authRefreshTokens.familyId, familyId));

  assert.ok(rows.length >= minimumRows);
  assert.equal(
    rows.filter((row) => !row.revokedAt).length,
    0,
    "the completed lifecycle/logout operation must leave no active family token",
  );
}

async function runRefreshAheadOfMutation<T>(input: {
  db: Database;
  authService: AuthService;
  tenantId: string;
  userId: string;
  terminalId: string;
  deviceId: string;
  terminalCredential: string;
  mutate: (seeded: {
    familyId: string;
    rawToken: string;
    tokenId: string;
  }) => Promise<T>;
}): Promise<T> {
  const seeded = await insertTerminalRefreshToken(input);
  const tokenHash = hashOpaqueToken(seeded.rawToken);
  const blocker = holdRefreshTokenLock(input.db, tokenHash);
  await blocker.acquired;

  const refreshPromise = input.authService.refresh({
    refreshToken: seeded.rawToken,
    terminalCredential: input.terminalCredential,
    deviceId: input.deviceId,
  });
  let mutationPromise: Promise<T> | undefined;

  try {
    await waitForTerminalLock(input.db, input.terminalId);
    mutationPromise = input.mutate(seeded);
    blocker.release();
    await blocker.done;

    await refreshPromise;
    const mutationResult = await mutationPromise;
    await assertFamilyHasNoActiveTokens(input.db, seeded.familyId, 2);
    return mutationResult;
  } finally {
    blocker.release();
    await blocker.done.catch(() => undefined);
    await refreshPromise.catch(() => undefined);
    await mutationPromise?.catch(() => undefined);
  }
}

async function runPinAheadOfMutation<T>(input: {
  db: Database;
  authService: AuthService;
  userId: string;
  terminalId: string;
  deviceId: string;
  pin: string;
  terminalCredential: string;
  ipAddress: string;
  mutate: () => Promise<T>;
}): Promise<{ mutationResult: T; refreshFamilyId: string }> {
  const blocker = holdUserLock(input.db, input.userId);
  await blocker.acquired;

  const loginPromise = input.authService.loginWithPosPin({
    pin: input.pin,
    deviceId: input.deviceId,
    terminalCredential: input.terminalCredential,
    ipAddress: input.ipAddress,
  });
  let mutationPromise: Promise<T> | undefined;

  try {
    await waitForTerminalLock(input.db, input.terminalId);
    mutationPromise = input.mutate();
    blocker.release();
    await blocker.done;

    const loginResult = await loginPromise;
    const mutationResult = await mutationPromise;
    await assertFamilyHasNoActiveTokens(
      input.db,
      loginResult.tokens.refreshTokenFamilyId,
    );
    return {
      mutationResult,
      refreshFamilyId: loginResult.tokens.refreshTokenFamilyId,
    };
  } finally {
    blocker.release();
    await blocker.done.catch(() => undefined);
    await loginPromise.catch(() => undefined);
    await mutationPromise?.catch(() => undefined);
  }
}

async function runLifecycleAheadOfQueuedPin<T>(input: {
  db: Database;
  authService: AuthService;
  terminalId: string;
  deviceId: string;
  pin: string;
  terminalCredential: string;
  ipAddress: string;
  mutate: () => Promise<T>;
}): Promise<T> {
  const blocker = holdPosPinAdvisoryLock(input.db, input.terminalId);
  await blocker.acquired;

  let loginSettled = false;
  const loginOutcome = input.authService
    .loginWithPosPin({
      pin: input.pin,
      deviceId: input.deviceId,
      terminalCredential: input.terminalCredential,
      ipAddress: input.ipAddress,
    })
    .then(
      () => {
        loginSettled = true;
        return null;
      },
      (error: unknown) => {
        loginSettled = true;
        return error;
      },
    );
  let mutationPromise: Promise<T> | undefined;

  try {
    await delay(75);
    assert.equal(
      loginSettled,
      false,
      "the PIN attempt must be queued behind the advisory lock",
    );
    mutationPromise = input.mutate();
    const mutationResult = await withTimeout(
      mutationPromise,
      2_000,
      "terminal lifecycle was blocked by the PIN advisory lock",
    );

    const preReleaseRefreshRows = await input.db
      .select({ id: authRefreshTokens.id })
      .from(authRefreshTokens)
      .where(eq(authRefreshTokens.terminalId, input.terminalId));
    assert.equal(preReleaseRefreshRows.length, 0);

    blocker.release();
    await blocker.done;

    const loginError = await loginOutcome;
    assert.ok(
      loginError instanceof AuthError &&
        [
          "POS_TERMINAL_CREDENTIAL_INVALID",
          "POS_TERMINAL_DISABLED",
          "POS_TERMINAL_ENROLLMENT_REQUIRED",
        ].includes(loginError.code),
      "the overtaken PIN attempt must fail after terminal revalidation",
    );
    const refreshRows = await input.db
      .select({ id: authRefreshTokens.id })
      .from(authRefreshTokens)
      .where(eq(authRefreshTokens.terminalId, input.terminalId));
    assert.equal(
      refreshRows.length,
      0,
      "an overtaken PIN attempt must not mint a refresh token",
    );

    return mutationResult;
  } finally {
    blocker.release();
    await blocker.done.catch(() => undefined);
    await loginOutcome.catch(() => undefined);
    await mutationPromise?.catch(() => undefined);
  }
}

function readCookieValue(setCookieHeader: string): string {
  const pair = setCookieHeader.split(";", 1)[0] ?? "";
  const separator = pair.indexOf("=");
  assert.ok(separator > 0, "expected a Set-Cookie name/value pair");
  return decodeURIComponent(pair.slice(separator + 1));
}

export async function runAuthConcurrencyRepositorySmoke(): Promise<void> {
  const db = getDb();
  const tenantRows = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(and(eq(tenants.status, "active"), isNull(tenants.deletedAt)))
    .limit(1);
  const tenantId = tenantRows[0]?.id;
  assert.ok(tenantId, "auth concurrency smoke requires an active tenant");

  const userId = createId();
  const branchAId = createId();
  const branchBId = createId();
  const refreshTerminalId = createId();
  const pinTerminalId = createId();
  const budgetTerminalId = createId();
  const interruptTerminalId = createId();
  const takeoverTerminalId = createId();
  const refreshDeviceId = `refresh-race-${createId()}`;
  const pinDeviceId = `pin-race-${createId()}`;
  const budgetDeviceId = `pin-budget-${createId()}`;
  const interruptDeviceId = `pin-interrupt-${createId()}`;
  const takeoverDeviceId = `takeover-race-${createId()}`;
  const pinIpAddress = `pin-ip-${createId()}`;
  const budgetIpAddress = `budget-ip-${createId()}`;
  const interruptIpAddress = `interrupt-ip-${createId()}`;
  const legacyIpAddress = `legacy-ip-${createId()}`;
  const pin = createId().slice(-10);
  const pinHash = await hashPin(pin);
  const refreshCredential = generateTerminalCredential();
  let pinCredential = generateTerminalCredential();
  const budgetCredential = generateTerminalCredential();
  const interruptCredential = generateTerminalCredential();
  const budgetLockKeys = buildPosPinLockKeys({
    tenantId,
    terminalId: budgetTerminalId,
    ipAddress: budgetIpAddress,
  });
  const pinLockKeys = buildPosPinLockKeys({
    tenantId,
    terminalId: pinTerminalId,
    ipAddress: pinIpAddress,
  });
  const interruptLockKeys = buildPosPinLockKeys({
    tenantId,
    terminalId: interruptTerminalId,
    ipAddress: interruptIpAddress,
  });
  const legacyLockKeys = buildPosPinLockKeys({
    tenantId: "unresolved",
    ipAddress: legacyIpAddress,
  });
  const lockoutKeys = [
    buildLoginLockKey(`auth-race-${createId()}@example.test`),
    ...pinLockKeys,
    ...budgetLockKeys,
    ...interruptLockKeys,
    ...legacyLockKeys,
  ];
  const createdRoleIds: string[] = [];
  const authService = new AuthService({
    db,
    accessTokenSecret:
      "auth-concurrency-smoke-secret-must-be-at-least-thirty-two-characters",
    cookieSecure: false,
    accessTokenTtlSeconds: 60,
    refreshTokenTtlSeconds: 3600,
  });
  const ownerContext: AuthContext = {
    userId,
    displayName: "Auth concurrency smoke",
    tenantId,
    branchIds: [branchAId, branchBId],
    role: "owner",
    roles: ["owner"],
    permissions: [],
    accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  };

  try {
    let cashierRoleRows = await db
      .select({ id: roles.id })
      .from(roles)
      .where(
        and(
          eq(roles.tenantId, tenantId),
          eq(roles.scope, "pos"),
          eq(roles.code, "cashier"),
          eq(roles.status, "active"),
          isNull(roles.deletedAt),
        ),
      )
      .limit(1);

    if (!cashierRoleRows[0]) {
      const roleId = createId();
      await db.insert(roles).values({
        id: roleId,
        tenantId,
        scope: "pos",
        code: "cashier",
        name: "Cashier",
        status: "active",
      });
      createdRoleIds.push(roleId);
      cashierRoleRows = [{ id: roleId }];
    }
    const cashierRoleId = cashierRoleRows[0]!.id;

    await db.insert(users).values({
      id: userId,
      tenantId,
      userType: "tenant",
      passwordHash: pinHash,
      pinHash,
      status: "active",
    });
    await db.insert(branches).values([
      {
        id: branchAId,
        tenantId,
        name: "Auth race branch A",
        status: "active",
        createdBy: userId,
        updatedBy: userId,
      },
      {
        id: branchBId,
        tenantId,
        name: "Auth race branch B",
        status: "active",
        createdBy: userId,
        updatedBy: userId,
      },
    ]);
    await db.insert(userRoles).values([
      {
        id: createId(),
        userId,
        roleId: cashierRoleId,
        tenantId,
        branchId: branchAId,
      },
      {
        id: createId(),
        userId,
        roleId: cashierRoleId,
        tenantId,
        branchId: branchBId,
      },
    ]);
    await db.insert(posTerminalSettings).values([
      {
        id: refreshTerminalId,
        tenantId,
        branchId: branchAId,
        deviceId: refreshDeviceId,
        label: "Refresh concurrency terminal",
        status: "active",
        credentialDigest: hashTerminalCredential(refreshCredential),
        credentialVersion: 1,
        credentialIssuedAt: new Date(),
        createdBy: userId,
        updatedBy: userId,
      },
      {
        id: pinTerminalId,
        tenantId,
        branchId: branchAId,
        deviceId: pinDeviceId,
        label: "PIN concurrency terminal",
        status: "active",
        credentialDigest: hashTerminalCredential(pinCredential),
        credentialVersion: 1,
        credentialIssuedAt: new Date(),
        createdBy: userId,
        updatedBy: userId,
      },
      {
        id: budgetTerminalId,
        tenantId,
        branchId: branchAId,
        deviceId: budgetDeviceId,
        label: "PIN budget concurrency terminal",
        status: "active",
        credentialDigest: hashTerminalCredential(budgetCredential),
        credentialVersion: 1,
        credentialIssuedAt: new Date(),
        createdBy: userId,
        updatedBy: userId,
      },
      {
        id: interruptTerminalId,
        tenantId,
        branchId: branchAId,
        deviceId: interruptDeviceId,
        label: "PIN emergency lifecycle terminal",
        status: "active",
        credentialDigest: hashTerminalCredential(interruptCredential),
        credentialVersion: 1,
        credentialIssuedAt: new Date(),
        createdBy: userId,
        updatedBy: userId,
      },
      {
        id: takeoverTerminalId,
        tenantId,
        branchId: branchAId,
        deviceId: takeoverDeviceId,
        label: "Manager takeover terminal",
        status: "inactive",
        credentialDigest: null,
        credentialVersion: 1,
        createdBy: userId,
        updatedBy: userId,
      },
    ]);

    const legacyPinInput = {
      pin,
      deviceId: pinDeviceId,
      tenantCode: "LEGACY-TENANT-CODE-MUST-BE-IGNORED",
      ipAddress: legacyIpAddress,
    };
    await assert.rejects(
      () => authService.loginWithPosPin(legacyPinInput),
      (error: unknown) =>
        error instanceof AuthError &&
        error.code === "POS_TERMINAL_ENROLLMENT_REQUIRED",
    );
    const legacyRefreshRows = await db
      .select({ id: authRefreshTokens.id })
      .from(authRefreshTokens)
      .where(eq(authRefreshTokens.terminalId, pinTerminalId));
    assert.equal(
      legacyRefreshRows.length,
      0,
      "tenantCode and deviceId must not replace the terminal credential",
    );

    await assert.rejects(
      () =>
        bindPosDevice(
          {
            authContext: {
              ...ownerContext,
              role: "manager",
              roles: ["manager"],
              branchIds: [branchBId],
            },
            cookieSecure: false,
            data: {
              deviceId: takeoverDeviceId,
              branchId: branchBId,
              label: "Manager must not take over branch A",
            },
          },
          db,
        ),
      (error: unknown) =>
        error instanceof AuthError && error.code === "FORBIDDEN",
    );
    const takeoverRows = await db
      .select({
        branchId: posTerminalSettings.branchId,
        credentialDigest: posTerminalSettings.credentialDigest,
      })
      .from(posTerminalSettings)
      .where(eq(posTerminalSettings.id, takeoverTerminalId))
      .limit(1);
    assert.deepEqual(takeoverRows[0], {
      branchId: branchAId,
      credentialDigest: null,
    });

    const lockoutPolicy = {
      passwordMinLength: 8,
      passwordRequiresNumber: true,
      passwordRequiresSymbol: false,
      loginMaxAttempts: 100,
      lockoutMinutes: 15,
      refreshTokenDays: 30,
    };
    const atomicLockKey = lockoutKeys[0]!;
    await Promise.all(
      Array.from({ length: 25 }, () =>
        recordLoginFailure(db, atomicLockKey, lockoutPolicy),
      ),
    );
    let lockoutRows = await db
      .select({
        failedAttempts: authLoginLockouts.failedAttempts,
      })
      .from(authLoginLockouts)
      .where(eq(authLoginLockouts.lockKey, atomicLockKey));
    assert.deepEqual(lockoutRows, [{ failedAttempts: 25 }]);

    await db
      .update(authLoginLockouts)
      .set({
        failedAttempts: 25,
        lockedUntil: null,
        updatedAt: new Date(Date.now() - 16 * 60 * 1000),
      })
      .where(eq(authLoginLockouts.lockKey, atomicLockKey));
    await recordLoginFailure(db, atomicLockKey, lockoutPolicy);
    lockoutRows = await db
      .select({
        failedAttempts: authLoginLockouts.failedAttempts,
      })
      .from(authLoginLockouts)
      .where(eq(authLoginLockouts.lockKey, atomicLockKey));
    assert.deepEqual(
      lockoutRows,
      [{ failedAttempts: 1 }],
      "the shared failure budget naturally decays after its sliding window",
    );

    const idempotentSeed = await insertTerminalRefreshToken({
      db,
      userId,
      tenantId,
      terminalId: refreshTerminalId,
      deviceId: refreshDeviceId,
    });
    const concurrentRefreshResults = await Promise.all([
      authService.refresh({
        refreshToken: idempotentSeed.rawToken,
        terminalCredential: refreshCredential,
      }),
      authService.refresh({
        refreshToken: idempotentSeed.rawToken,
        terminalCredential: refreshCredential,
      }),
    ]);
    assert.equal(
      concurrentRefreshResults[0].tokens.refreshToken,
      concurrentRefreshResults[1].tokens.refreshToken,
      "legitimate concurrent refreshes must receive the same successor",
    );
    const familyRows = await db
      .select({
        id: authRefreshTokens.id,
        revokedAt: authRefreshTokens.revokedAt,
      })
      .from(authRefreshTokens)
      .where(eq(authRefreshTokens.familyId, idempotentSeed.familyId));
    assert.equal(familyRows.length, 2);
    assert.equal(familyRows.filter((row) => !row.revokedAt).length, 1);

    await db
      .update(authRefreshTokens)
      .set({ revokedAt: new Date(Date.now() - 60_000) })
      .where(eq(authRefreshTokens.id, idempotentSeed.tokenId));
    await assert.rejects(
      () =>
        authService.refresh({
          refreshToken: idempotentSeed.rawToken,
          terminalCredential: refreshCredential,
        }),
      (error: unknown) =>
        error instanceof AuthError && error.code === "TOKEN_REUSE_DETECTED",
    );
    await assertFamilyHasNoActiveTokens(db, idempotentSeed.familyId, 2);

    await runRefreshAheadOfMutation({
      db,
      authService,
      tenantId,
      userId,
      terminalId: refreshTerminalId,
      deviceId: refreshDeviceId,
      terminalCredential: refreshCredential,
      mutate: (seeded) =>
        authService.logout({
          refreshToken: seeded.rawToken,
          deviceId: refreshDeviceId,
        }),
    });

    const disabled = await runRefreshAheadOfMutation({
      db,
      authService,
      tenantId,
      userId,
      terminalId: refreshTerminalId,
      deviceId: refreshDeviceId,
      terminalCredential: refreshCredential,
      mutate: () =>
        updatePosDevice(
          {
            authContext: ownerContext,
            deviceId: refreshDeviceId,
            data: { status: "inactive", reason: "Refresh race disable" },
          },
          db,
        ),
    });
    assert.equal(disabled.status, "inactive");
    await updatePosDevice(
      {
        authContext: ownerContext,
        deviceId: refreshDeviceId,
        data: { status: "active", reason: "Refresh race re-enable" },
      },
      db,
    );

    const rebound = await runRefreshAheadOfMutation({
      db,
      authService,
      tenantId,
      userId,
      terminalId: refreshTerminalId,
      deviceId: refreshDeviceId,
      terminalCredential: refreshCredential,
      mutate: () =>
        updatePosDevice(
          {
            authContext: ownerContext,
            deviceId: refreshDeviceId,
            data: { branchId: branchBId, reason: "Refresh race rebind" },
          },
          db,
        ),
    });
    assert.equal(rebound.branchId, branchBId);

    const refreshRevoked = await runRefreshAheadOfMutation({
      db,
      authService,
      tenantId,
      userId,
      terminalId: refreshTerminalId,
      deviceId: refreshDeviceId,
      terminalCredential: refreshCredential,
      mutate: () =>
        revokePosDevice(
          {
            authContext: ownerContext,
            deviceId: refreshDeviceId,
            cookieSecure: false,
            data: { reason: "Refresh race revoke" },
          },
          db,
        ),
    });
    assert.equal(refreshRevoked.device.status, "inactive");

    const interruptDisabled = await runLifecycleAheadOfQueuedPin({
      db,
      authService,
      terminalId: interruptTerminalId,
      deviceId: interruptDeviceId,
      pin,
      terminalCredential: interruptCredential,
      ipAddress: interruptIpAddress,
      mutate: () =>
        updatePosDevice(
          {
            authContext: ownerContext,
            deviceId: interruptDeviceId,
            data: {
              status: "inactive",
              reason: "Emergency disable must overtake PIN hashing",
            },
          },
          db,
        ),
    });
    assert.equal(interruptDisabled.status, "inactive");
    await updatePosDevice(
      {
        authContext: ownerContext,
        deviceId: interruptDeviceId,
        data: {
          status: "active",
          reason: "Restore emergency smoke terminal",
        },
      },
      db,
    );

    const interruptRevoked = await runLifecycleAheadOfQueuedPin({
      db,
      authService,
      terminalId: interruptTerminalId,
      deviceId: interruptDeviceId,
      pin,
      terminalCredential: interruptCredential,
      ipAddress: interruptIpAddress,
      mutate: () =>
        revokePosDevice(
          {
            authContext: ownerContext,
            deviceId: interruptDeviceId,
            cookieSecure: false,
            data: {
              reason: "Emergency revoke must overtake PIN hashing",
            },
          },
          db,
        ),
    });
    assert.equal(interruptRevoked.device.status, "inactive");

    const posLockKeys = pinLockKeys;
    await db.insert(authLoginLockouts).values(
      posLockKeys.map((lockKey) => ({
        id: createId(),
        lockKey,
        failedAttempts: 2,
        lockedUntil: null,
        updatedAt: new Date(),
      })),
    );
    await authService.loginWithPosPin({
      pin,
      deviceId: pinDeviceId,
      terminalCredential: pinCredential,
      ipAddress: pinIpAddress,
    });
    const sharedBudgetRows = await db
      .select({
        lockKey: authLoginLockouts.lockKey,
        failedAttempts: authLoginLockouts.failedAttempts,
      })
      .from(authLoginLockouts)
      .where(inArray(authLoginLockouts.lockKey, posLockKeys));
    assert.equal(sharedBudgetRows.length, 2);
    assert.ok(
      sharedBudgetRows.every((row) => row.failedAttempts === 2),
      "a cashier's successful PIN must not reset shared terminal/network budgets",
    );

    const effectivePolicy = await resolveEffectiveSecurityPolicy(db);
    const wrongPinAttemptCount = effectivePolicy.loginMaxAttempts + 3;
    const wrongPin = `wrong-${createId()}`;
    const budgetTerminalBlocker = holdPosPinAdvisoryLock(db, budgetTerminalId);
    await budgetTerminalBlocker.acquired;
    const wrongAttemptPromises = Array.from(
      { length: wrongPinAttemptCount },
      () =>
        authService
          .loginWithPosPin({
            pin: wrongPin,
            deviceId: budgetDeviceId,
            terminalCredential: budgetCredential,
            ipAddress: budgetIpAddress,
          })
          .then(
            () => {
              throw new Error("an incorrect PIN unexpectedly signed in");
            },
            (error: unknown) => error,
          ),
    );

    // All requests can pass the optimistic budget read while this external
    // transaction holds the PIN advisory lock. Incorrect attempts are queued
    // first; the delayed correct PIN must re-check the committed budget when
    // it eventually enters the serialized attempt boundary.
    await delay(75);
    const delayedCorrectAttempt = authService
      .loginWithPosPin({
        pin,
        deviceId: budgetDeviceId,
        terminalCredential: budgetCredential,
        ipAddress: budgetIpAddress,
      })
      .then(
        () => null,
        (error: unknown) => error,
      );
    await delay(75);
    budgetTerminalBlocker.release();
    await budgetTerminalBlocker.done;
    const wrongAttemptErrors = await Promise.all(wrongAttemptPromises);
    assert.ok(
      wrongAttemptErrors.every(
        (error) =>
          error instanceof AuthError &&
          (error.code === "INVALID_CREDENTIALS" ||
            error.code === "ACCOUNT_LOCKED"),
      ),
      "concurrent incorrect PIN attempts must fail through the auth budget",
    );
    assert.ok(
      wrongAttemptErrors.some(
        (error) =>
          error instanceof AuthError && error.code === "ACCOUNT_LOCKED",
      ),
      "the serialized attempts must exhaust and enforce the terminal budget",
    );
    const delayedCorrectError = await delayedCorrectAttempt;
    assert.ok(
      delayedCorrectError instanceof AuthError &&
        delayedCorrectError.code === "ACCOUNT_LOCKED",
    );
    const budgetRefreshRows = await db
      .select({ id: authRefreshTokens.id })
      .from(authRefreshTokens)
      .where(eq(authRefreshTokens.terminalId, budgetTerminalId));
    assert.equal(
      budgetRefreshRows.length,
      0,
      "a correct PIN arriving after budget exhaustion must not mint a refresh token",
    );

    const rotated = await runPinAheadOfMutation({
      db,
      authService,
      userId,
      terminalId: pinTerminalId,
      deviceId: pinDeviceId,
      pin,
      terminalCredential: pinCredential,
      ipAddress: pinIpAddress,
      mutate: () =>
        rotatePosDeviceCredential(
          {
            authContext: ownerContext,
            deviceId: pinDeviceId,
            cookieSecure: false,
            data: { reason: "PIN race rotate" },
          },
          db,
        ),
    });
    pinCredential = readCookieValue(
      rotated.mutationResult.setCookieHeaders[0] ?? "",
    );

    const pinRebound = await runPinAheadOfMutation({
      db,
      authService,
      userId,
      terminalId: pinTerminalId,
      deviceId: pinDeviceId,
      pin,
      terminalCredential: pinCredential,
      ipAddress: pinIpAddress,
      mutate: () =>
        updatePosDevice(
          {
            authContext: ownerContext,
            deviceId: pinDeviceId,
            data: { branchId: branchBId, reason: "PIN race rebind" },
          },
          db,
        ),
    });
    assert.equal(pinRebound.mutationResult.branchId, branchBId);

    const pinRevoked = await runPinAheadOfMutation({
      db,
      authService,
      userId,
      terminalId: pinTerminalId,
      deviceId: pinDeviceId,
      pin,
      terminalCredential: pinCredential,
      ipAddress: pinIpAddress,
      mutate: () =>
        revokePosDevice(
          {
            authContext: ownerContext,
            deviceId: pinDeviceId,
            cookieSecure: false,
            data: { reason: "PIN race revoke" },
          },
          db,
        ),
    });
    assert.equal(pinRevoked.mutationResult.device.status, "inactive");
  } finally {
    await db.delete(auditLogs).where(eq(auditLogs.actorUserId, userId));
    await db
      .delete(authRefreshTokens)
      .where(eq(authRefreshTokens.userId, userId));
    await db
      .delete(authLoginLockouts)
      .where(inArray(authLoginLockouts.lockKey, lockoutKeys));
    await db
      .delete(posTerminalSettings)
      .where(
        inArray(posTerminalSettings.id, [
          refreshTerminalId,
          pinTerminalId,
          budgetTerminalId,
          interruptTerminalId,
          takeoverTerminalId,
        ]),
      );
    await db.delete(userRoles).where(eq(userRoles.userId, userId));
    await db
      .delete(branches)
      .where(inArray(branches.id, [branchAId, branchBId]));
    await db.delete(users).where(eq(users.id, userId));
    if (createdRoleIds.length > 0) {
      await db.delete(roles).where(inArray(roles.id, createdRoleIds));
    }
  }
}

if (process.argv[1]?.endsWith("auth.concurrency.repository.smoke.ts")) {
  try {
    await runAuthConcurrencyRepositorySmoke();
    console.log("Auth concurrency repository smoke passed.");
  } finally {
    await closeDbConnection();
  }
}
