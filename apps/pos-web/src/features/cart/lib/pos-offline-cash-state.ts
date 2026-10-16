"use client";

import type {
  PosCashDrawerSession,
  PosRegisterSession,
  PosRegisterState,
  ShiftRecord,
} from "@cleanhub/api-client";
import type { AsyncKeyValueStorage } from "@cleanhub/offline";
import { useEffect, useMemo, useState } from "react";

import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";
import { getPosOfflineStorage } from "@/features/hardware/lib/desktop-bridge";

const POS_OFFLINE_CASH_STATE_NAMESPACE = "cleanhub:pos-cash-state:v1";
const POS_OFFLINE_CASH_STATE_VERSION = 1;
const MAX_CASH_STATE_AGE_MS = 2 * 60 * 60 * 1_000;

export const EMPTY_POS_REGISTER_STATE: PosRegisterState = {
  registerSession: null,
  cashSession: null,
  cashHandlingMode: "none",
  cashTrackingEnabled: false,
  requireOpeningFloat: false,
  requireClosingCount: false,
};

export type PosOfflineCashStateScope = {
  tenantId: string;
  branchId: string;
  terminalId: string;
  userId: string;
  terminalCredentialVersion: number;
};

export type PosOfflineCashStateSnapshot = {
  version: typeof POS_OFFLINE_CASH_STATE_VERSION;
  updatedAt: string;
  currentShift: ShiftRecord | null;
  register: PosRegisterState;
};

type CachedCashState = {
  scopeKey: string;
  snapshot: PosOfflineCashStateSnapshot | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isKnownCashHandlingMode(value: unknown): boolean {
  return (
    value === "none" ||
    value === "untracked" ||
    value === "shared_drawer" ||
    value === "cash_in_hand"
  );
}

function isShift(
  value: unknown,
  scope: PosOfflineCashStateScope,
): value is ShiftRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.tenantId === scope.tenantId &&
    value.branchId === scope.branchId &&
    value.staffId === scope.userId &&
    typeof value.currency === "string" &&
    value.status === "open"
  );
}

function isOpenRegisterSession(
  value: unknown,
  scope: PosOfflineCashStateScope,
): value is PosRegisterSession {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.status === "open" &&
    value.tenantId === scope.tenantId &&
    value.branchId === scope.branchId &&
    value.terminalId === scope.terminalId &&
    typeof value.currency === "string"
  );
}

function isOpenCashSession(
  value: unknown,
  registerSessionId: string,
): value is PosCashDrawerSession {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.registerSessionId === registerSessionId &&
    value.status === "open" &&
    typeof value.currency === "string"
  );
}

function isRegisterState(
  value: unknown,
  scope: PosOfflineCashStateScope,
): value is PosRegisterState {
  if (!isRecord(value) || !isKnownCashHandlingMode(value.cashHandlingMode)) {
    return false;
  }
  if (
    typeof value.cashTrackingEnabled !== "boolean" ||
    typeof value.requireOpeningFloat !== "boolean" ||
    typeof value.requireClosingCount !== "boolean"
  ) {
    return false;
  }
  if (
    value.registerSession !== null &&
    !isOpenRegisterSession(value.registerSession, scope)
  ) {
    return false;
  }
  if (value.cashSession !== null) {
    if (
      !value.registerSession ||
      !isOpenCashSession(value.cashSession, value.registerSession.id)
    ) {
      return false;
    }
    if (
      value.cashHandlingMode !== "shared_drawer" &&
      value.cashHandlingMode !== "cash_in_hand"
    ) {
      return false;
    }
  }
  if (value.cashHandlingMode === "none") {
    return value.registerSession === null && value.cashSession === null;
  }
  if (value.cashHandlingMode === "untracked") {
    return value.cashSession === null;
  }
  return true;
}

function buildScopeKey(scope: PosOfflineCashStateScope): string {
  return [
    scope.tenantId,
    scope.branchId,
    scope.terminalId,
    scope.userId,
    scope.terminalCredentialVersion,
  ].join(":");
}

export function buildPosOfflineCashStateStorageKey(
  scope: PosOfflineCashStateScope,
): string {
  return `${POS_OFFLINE_CASH_STATE_NAMESPACE}:${buildScopeKey(scope)}`;
}

export async function readPosOfflineCashState(
  storage: AsyncKeyValueStorage,
  scope: PosOfflineCashStateScope,
  options: { now?: number } = {},
): Promise<PosOfflineCashStateSnapshot | null> {
  const stored = await storage.getItem(buildPosOfflineCashStateStorageKey(scope));
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored) as Partial<PosOfflineCashStateSnapshot>;
    if (
      parsed.version !== POS_OFFLINE_CASH_STATE_VERSION ||
      typeof parsed.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(parsed.updatedAt)) ||
      !isRegisterState(parsed.register, scope) ||
      !(parsed.currentShift === null || isShift(parsed.currentShift, scope))
    ) {
      return null;
    }
    const age = (options.now ?? Date.now()) - Date.parse(parsed.updatedAt);
    if (age < -5 * 60 * 1_000 || age > MAX_CASH_STATE_AGE_MS) return null;
    return parsed as PosOfflineCashStateSnapshot;
  } catch {
    return null;
  }
}

export async function writePosOfflineCashState(
  storage: AsyncKeyValueStorage,
  scope: PosOfflineCashStateScope,
  register: PosRegisterState,
  currentShift: ShiftRecord | null,
  options: { updatedAt?: string } = {},
): Promise<void> {
  const snapshot: PosOfflineCashStateSnapshot = {
    version: POS_OFFLINE_CASH_STATE_VERSION,
    updatedAt: options.updatedAt ?? new Date().toISOString(),
    register,
    currentShift,
  };
  await storage.setItem(
    buildPosOfflineCashStateStorageKey(scope),
    JSON.stringify(snapshot),
  );
}

export function usePosOfflineCashState({
  currentShift,
  register,
  registerAvailable,
  shiftAvailable,
}: {
  currentShift: ShiftRecord | null;
  register: PosRegisterState | null;
  registerAvailable: boolean;
  shiftAvailable: boolean;
}): { currentShift: ShiftRecord | null; register: PosRegisterState } {
  const { tenantId, branchId, terminalId, userId, terminalCredentialVersion } =
    usePosRuntimeConfig();
  const scope = useMemo<PosOfflineCashStateScope | null>(
    () =>
      tenantId &&
      branchId &&
      terminalId &&
      userId &&
      terminalCredentialVersion
        ? { tenantId, branchId, terminalId, userId, terminalCredentialVersion }
        : null,
    [branchId, tenantId, terminalCredentialVersion, terminalId, userId],
  );
  const scopeKey = scope ? buildScopeKey(scope) : null;
  const [cachedState, setCachedState] = useState<CachedCashState | null>(null);

  useEffect(() => {
    let active = true;
    if (scope && registerAvailable && register && shiftAvailable) {
      void writePosOfflineCashState(
        getPosOfflineStorage(),
        scope,
        register,
        currentShift,
      ).catch(() => undefined);
    } else if (scope && scopeKey && (!registerAvailable || !shiftAvailable)) {
      void readPosOfflineCashState(getPosOfflineStorage(), scope)
        .then((snapshot) => {
          if (active) setCachedState({ scopeKey, snapshot });
        })
        .catch(() => {
          if (active) setCachedState({ scopeKey, snapshot: null });
        });
    }
    return () => {
      active = false;
    };
  }, [
    currentShift,
    register,
    registerAvailable,
    scope,
    scopeKey,
    shiftAvailable,
  ]);

  if (registerAvailable && register && shiftAvailable) {
    return { currentShift, register };
  }
  if (cachedState?.scopeKey === scopeKey && cachedState.snapshot) {
    return {
      currentShift: cachedState.snapshot.currentShift,
      register: cachedState.snapshot.register,
    };
  }
  return { currentShift: null, register: EMPTY_POS_REGISTER_STATE };
}
