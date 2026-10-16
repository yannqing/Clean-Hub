import { createMemoryStorage } from "@cleanhub/offline";
import type { PosRegisterState, ShiftRecord } from "@cleanhub/api-client";

import {
  buildPosOfflineCashStateStorageKey,
  readPosOfflineCashState,
  writePosOfflineCashState,
} from "./pos-offline-cash-state";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const scope = {
  tenantId: "01J00000000000000000000000",
  branchId: "01J00000000000000000000001",
  terminalId: "01J00000000000000000000002",
  userId: "01J00000000000000000000003",
  terminalCredentialVersion: 1,
};

const currentShift: ShiftRecord = {
  id: "01J00000000000000000000004",
  tenantId: scope.tenantId,
  branchId: scope.branchId,
  terminalId: scope.terminalId,
  staffId: scope.userId,
  currency: "XOF",
  status: "open",
  startedAt: "2026-09-21T09:00:00.000Z",
  endedAt: null,
  openingFloat: "0.00",
  closingFloat: null,
  createdAt: "2026-09-21T09:00:00.000Z",
  updatedAt: "2026-09-21T09:00:00.000Z",
  version: 1,
};

const register: PosRegisterState = {
  registerSession: {
    id: "01J00000000000000000000005",
    tenantId: scope.tenantId,
    branchId: scope.branchId,
    terminalId: scope.terminalId,
    currency: "XOF",
    status: "open",
    openedAt: "2026-09-21T09:00:00.000Z",
    closedAt: null,
    openedBy: scope.userId,
    closedBy: null,
    closeNotes: null,
    version: 1,
  },
  cashSession: {
    id: "01J00000000000000000000006",
    registerSessionId: "01J00000000000000000000005",
    handlingMode: "cash_in_hand",
    assignedStaffId: scope.userId,
    currency: "XOF",
    status: "open",
    openingFloat: "0.00",
    expectedCash: null,
    countedCash: null,
    variance: null,
    openedAt: "2026-09-21T09:00:00.000Z",
    closedAt: null,
    version: 1,
  },
  cashHandlingMode: "cash_in_hand",
  cashTrackingEnabled: true,
  requireOpeningFloat: true,
  requireClosingCount: true,
};

async function main(): Promise<void> {
  const storage = createMemoryStorage();
  const updatedAt = "2026-09-21T10:00:00.000Z";
  await writePosOfflineCashState(storage, scope, register, currentShift, {
    updatedAt,
  });

  const key = buildPosOfflineCashStateStorageKey(scope);
  assert(
    key.includes(scope.terminalId) && key.includes(scope.userId),
    "Cash state must be scoped to the terminal and signed-in cashier",
  );
  const cached = await readPosOfflineCashState(storage, scope, {
    now: Date.parse(updatedAt) + 60_000,
  });
  assert(cached !== null, "Fresh cash state should be usable offline");
  assert(
    cached.currentShift?.id === currentShift.id &&
      cached.register.cashSession?.id === register.cashSession?.id,
    "Cash state must retain the active shift and drawer session",
  );
  const serialized = await storage.getItem(key);
  assert(serialized !== null, "Cash state should be present in storage");
  const mismatchedScope = JSON.parse(serialized) as {
    currentShift: ShiftRecord;
  };
  mismatchedScope.currentShift.staffId = "01J00000000000000000000099";
  await storage.setItem(key, JSON.stringify(mismatchedScope));
  assert(
    (await readPosOfflineCashState(storage, scope, {
      now: Date.parse(updatedAt) + 60_000,
    })) === null,
    "A shift from another cashier must not be reused offline",
  );
  await writePosOfflineCashState(storage, scope, register, currentShift, {
    updatedAt,
  });
  assert(
    (await readPosOfflineCashState(storage, scope, {
      now: Date.parse(updatedAt) + 2 * 60 * 60 * 1_000 + 1,
    })) === null,
    "An expired cash state must not permit offline cash collection",
  );

  console.log("POS offline cash-state smoke ok");
}

void main();
