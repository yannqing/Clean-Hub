import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  ne,
  notInArray,
  or,
  sql,
} from "drizzle-orm";

import { subtractAmounts } from "@cleanhub/domain/money";

import {
  branches,
  orders,
  paymentTransactions,
  posCashDrawerSessions,
  posPaymentAdjustments,
  posRegisterSessions,
  posShiftCashMovements,
  posShiftHandovers,
  posStaffShifts,
  posTerminalSettings,
  posZReports,
  roles,
  serviceTickets,
  userBranches,
  userProfiles,
  userRoles,
  users,
  type Database,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import type {
  HandoverRecord,
  PosStaffDetail,
  PosStaffListQuery,
  PosStaffRole,
  PosCashDrawerSession,
  PosRegisterSession,
  PosZReport,
  PosZReportPaymentBreakdown,
  PosShiftCashMovement,
  ShiftRecord,
} from "./staff.types.js";

const ROLE_PRIORITY: Record<PosStaffRole, number> = {
  owner: 3,
  manager: 2,
  cashier: 1,
};

function toShift(row: typeof posStaffShifts.$inferSelect): ShiftRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    branchId: row.branchId,
    terminalId: row.terminalId,
    staffId: row.staffId,
    currency: row.currency,
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    openingFloat: row.openingFloat,
    closingFloat: row.closingFloat,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

function toRegisterSession(
  row: typeof posRegisterSessions.$inferSelect,
): PosRegisterSession {
  return {
    id: row.id,
    tenantId: row.tenantId,
    branchId: row.branchId,
    terminalId: row.terminalId,
    currency: row.currency,
    status: row.status,
    openedAt: row.openedAt.toISOString(),
    closedAt: row.closedAt?.toISOString() ?? null,
    openedBy: row.openedBy,
    closedBy: row.closedBy,
    closeNotes: row.closeNotes,
    version: row.version,
  };
}

function toCashDrawerSession(
  row: typeof posCashDrawerSessions.$inferSelect,
): PosCashDrawerSession {
  if (row.handlingMode === "none" || row.handlingMode === "untracked") {
    throw new Error(
      `Invalid persisted cash drawer handling mode: ${row.handlingMode}`,
    );
  }
  return {
    id: row.id,
    registerSessionId: row.registerSessionId,
    handlingMode: row.handlingMode,
    assignedStaffId: row.assignedStaffId,
    currency: row.currency,
    status: row.status,
    openingFloat: row.openingFloat,
    expectedCash: row.expectedCash,
    countedCash: row.countedCash,
    variance: row.variance,
    openedAt: row.openedAt.toISOString(),
    closedAt: row.closedAt?.toISOString() ?? null,
    version: row.version,
  };
}

function toCashMovement(
  row: typeof posShiftCashMovements.$inferSelect,
): PosShiftCashMovement {
  return {
    id: row.id,
    shiftId: row.shiftId,
    registerSessionId: row.registerSessionId,
    cashDrawerSessionId: row.cashDrawerSessionId,
    movementType: row.movementType,
    amount: row.amount,
    currency: row.currency,
    reason: row.reason,
    idempotencyKey: row.idempotencyKey,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
  };
}

function toZReport(row: typeof posZReports.$inferSelect): PosZReport {
  return {
    id: row.id,
    tenantId: row.tenantId,
    branchId: row.branchId,
    terminalId: row.terminalId,
    shiftId: row.shiftId,
    handoverId: row.handoverId,
    registerSessionId: row.registerSessionId,
    currency: row.currency,
    cutoffAt: row.cutoffAt.toISOString(),
    orderCount: row.orderCount,
    grossSales: row.grossSales,
    discountAmount: row.discountAmount,
    refundAmount: row.refundAmount,
    correctionAmount: row.correctionAmount,
    unsettledPaymentCount: row.unsettledPaymentCount,
    unsettledPaymentAmount: row.unsettledPaymentAmount,
    unsettledRefundCount: row.unsettledRefundCount,
    unsettledRefundAmount: row.unsettledRefundAmount,
    netSales: row.netSales,
    expectedCash: row.expectedCash,
    countedCash: row.countedCash,
    variance: row.variance,
    outstandingOrders: row.outstandingOrders,
    paymentBreakdown: row.paymentBreakdown.map((item) => ({
      ...item,
      provider: item.provider ?? null,
    })),
    createdAt: row.createdAt.toISOString(),
  };
}

function money(value: number): string {
  return value.toFixed(2);
}

export type ReportAdjustment = {
  adjustmentType: "refund" | "correction";
  direction: "debit" | "credit";
  amount: string;
  method: string | null;
};

export function calculateAdjustmentTotals(adjustments: ReportAdjustment[]): {
  refundAmount: number;
  correctionAmount: number;
  cashAdjustment: number;
} {
  let refundAmount = 0;
  let correctionAmount = 0;
  let cashAdjustment = 0;

  for (const adjustment of adjustments) {
    const amount = Number(adjustment.amount);
    if (adjustment.adjustmentType === "refund") {
      const signedRefund = adjustment.direction === "debit" ? amount : -amount;
      refundAmount += signedRefund;
      if (adjustment.method === "cash") cashAdjustment -= signedRefund;
      continue;
    }

    const signedCorrection =
      adjustment.direction === "credit" ? amount : -amount;
    correctionAmount += signedCorrection;
    if (adjustment.method === "cash") cashAdjustment += signedCorrection;
  }

  return { refundAmount, correctionAmount, cashAdjustment };
}

export function calculateCashVariance(
  countedCash: string,
  expectedCash: string,
): string {
  // Exact: a float subtraction can report a one-cent drawer variance that does
  // not exist, which a manager then has to reconcile at shift close.
  return subtractAmounts(countedCash, expectedCash);
}

export function calculateNetSales(
  grossSales: string | number,
  discountAmount: string | number,
  refundAmount: string | number = 0,
  correctionAmount: string | number = 0,
): string {
  return money(
    Number(grossSales) -
      Number(discountAmount) -
      Number(refundAmount) +
      Number(correctionAmount),
  );
}

export async function findStaffForBranch(
  db: Database,
  input: {
    tenantId: string;
    branchId: string;
    query?: PosStaffListQuery;
    staffId?: string;
  },
): Promise<PosStaffDetail[]> {
  const roleRows = await db
    .select({
      id: users.id,
      email: users.email,
      phone: users.phone,
      displayName: userProfiles.displayName,
      role: roles.code,
    })
    .from(users)
    .innerJoin(
      userProfiles,
      and(
        eq(userProfiles.userId, users.id),
        eq(userProfiles.tenantId, input.tenantId),
      ),
    )
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(
      and(
        eq(users.tenantId, input.tenantId),
        eq(users.userType, "tenant"),
        eq(users.status, "active"),
        isNull(users.deletedAt),
        eq(userRoles.tenantId, input.tenantId),
        isNull(userRoles.revokedAt),
        inArray(roles.scope, ["tenant", "pos"]),
        inArray(roles.code, ["owner", "manager", "cashier"]),
        eq(roles.status, "active"),
        isNull(roles.deletedAt),
        input.staffId ? eq(users.id, input.staffId) : undefined,
        or(
          eq(roles.code, "owner"),
          eq(userRoles.branchId, input.branchId),
          sql`exists (
            select 1 from ${userBranches}
            where ${userBranches.userId} = ${users.id}
              and ${userBranches.tenantId} = ${input.tenantId}
              and ${userBranches.branchId} = ${input.branchId}
          )`,
        ),
      ),
    );

  const staffById = new Map<
    string,
    Omit<PosStaffDetail, "status" | "currentShiftId">
  >();
  for (const row of roleRows) {
    const role = row.role as PosStaffRole;
    const existing = staffById.get(row.id);
    if (!existing || ROLE_PRIORITY[role] > ROLE_PRIORITY[existing.role]) {
      staffById.set(row.id, {
        id: row.id,
        displayName: row.displayName,
        email: row.email,
        phone: row.phone,
        role,
        branchId: input.branchId,
      });
    }
  }

  const staffIds = [...staffById.keys()];
  const shiftRows =
    staffIds.length === 0
      ? []
      : await db
          .select()
          .from(posStaffShifts)
          .where(
            and(
              eq(posStaffShifts.tenantId, input.tenantId),
              eq(posStaffShifts.branchId, input.branchId),
              inArray(posStaffShifts.staffId, staffIds),
              ne(posStaffShifts.status, "closed"),
            ),
          );
  const shiftsByStaff = new Map(shiftRows.map((row) => [row.staffId, row]));
  const normalizedQuery = input.query?.q?.trim().toLowerCase();

  return [...staffById.values()]
    .map((staff): PosStaffDetail => {
      const shift = shiftsByStaff.get(staff.id);
      return {
        ...staff,
        currentShiftId: shift?.id ?? null,
        status:
          shift?.status === "on_break"
            ? "on_break"
            : shift
              ? "on_duty"
              : "off_duty",
      };
    })
    .filter((staff) => !input.query?.role || staff.role === input.query.role)
    .filter(
      (staff) => !input.query?.status || staff.status === input.query.status,
    )
    .filter(
      (staff) =>
        !normalizedQuery ||
        staff.displayName.toLowerCase().includes(normalizedQuery) ||
        staff.email?.toLowerCase().includes(normalizedQuery) ||
        staff.phone?.toLowerCase().includes(normalizedQuery),
    )
    .sort((left, right) => left.displayName.localeCompare(right.displayName))
    .slice(
      input.query?.offset ?? 0,
      (input.query?.offset ?? 0) + (input.query?.limit ?? 50),
    );
}

export async function findOpenShift(
  db: Database,
  input: { tenantId: string; staffId: string },
): Promise<ShiftRecord | null> {
  const rows = await db
    .select()
    .from(posStaffShifts)
    .where(
      and(
        eq(posStaffShifts.tenantId, input.tenantId),
        eq(posStaffShifts.staffId, input.staffId),
        ne(posStaffShifts.status, "closed"),
      ),
    )
    .limit(1);
  return rows[0] ? toShift(rows[0]) : null;
}

export async function findOpenRegisterSession(
  db: Database,
  input: { tenantId: string; terminalId: string; forUpdate?: boolean },
): Promise<PosRegisterSession | null> {
  const query = db
    .select()
    .from(posRegisterSessions)
    .where(
      and(
        eq(posRegisterSessions.tenantId, input.tenantId),
        eq(posRegisterSessions.terminalId, input.terminalId),
        eq(posRegisterSessions.status, "open"),
      ),
    )
    .limit(1);
  const rows = input.forUpdate ? await query.for("update") : await query;
  return rows[0] ? toRegisterSession(rows[0]) : null;
}

export async function findRegisterSessionByIdForUpdate(
  db: Database,
  input: { tenantId: string; registerSessionId: string },
): Promise<PosRegisterSession | null> {
  const [row] = await db
    .select()
    .from(posRegisterSessions)
    .where(
      and(
        eq(posRegisterSessions.tenantId, input.tenantId),
        eq(posRegisterSessions.id, input.registerSessionId),
      ),
    )
    .for("update")
    .limit(1);
  return row ? toRegisterSession(row) : null;
}

export async function insertRegisterSession(
  db: Database,
  input: {
    tenantId: string;
    branchId: string;
    terminalId: string;
    currency: string;
    actorUserId: string;
  },
): Promise<PosRegisterSession | null> {
  const [row] = await db
    .insert(posRegisterSessions)
    .values({
      id: createId(),
      tenantId: input.tenantId,
      branchId: input.branchId,
      terminalId: input.terminalId,
      currency: input.currency,
      openedBy: input.actorUserId,
    })
    .onConflictDoNothing()
    .returning();
  return row ? toRegisterSession(row) : null;
}

export async function findOpenCashDrawerSession(
  db: Database,
  input: {
    tenantId: string;
    registerSessionId: string;
    staffId: string;
    handlingMode: "shared_drawer" | "cash_in_hand";
    forUpdate?: boolean;
  },
): Promise<PosCashDrawerSession | null> {
  const query = db
    .select()
    .from(posCashDrawerSessions)
    .where(
      and(
        eq(posCashDrawerSessions.tenantId, input.tenantId),
        eq(posCashDrawerSessions.registerSessionId, input.registerSessionId),
        eq(posCashDrawerSessions.status, "open"),
        input.handlingMode === "cash_in_hand"
          ? and(
              eq(posCashDrawerSessions.handlingMode, "cash_in_hand"),
              eq(posCashDrawerSessions.assignedStaffId, input.staffId),
            )
          : eq(posCashDrawerSessions.handlingMode, "shared_drawer"),
      ),
    )
    .limit(1);
  const rows = input.forUpdate ? await query.for("update") : await query;
  return rows[0] ? toCashDrawerSession(rows[0]) : null;
}

export async function findCashDrawerSessionByIdForUpdate(
  db: Database,
  input: { tenantId: string; cashDrawerSessionId: string },
): Promise<PosCashDrawerSession | null> {
  const [row] = await db
    .select()
    .from(posCashDrawerSessions)
    .where(
      and(
        eq(posCashDrawerSessions.tenantId, input.tenantId),
        eq(posCashDrawerSessions.id, input.cashDrawerSessionId),
      ),
    )
    .for("update")
    .limit(1);
  return row ? toCashDrawerSession(row) : null;
}

export async function insertCashDrawerSession(
  db: Database,
  input: {
    tenantId: string;
    branchId: string;
    terminalId: string;
    registerSessionId: string;
    handlingMode: "shared_drawer" | "cash_in_hand";
    assignedStaffId: string | null;
    currency: string;
    openingFloat: string;
    actorUserId: string;
  },
): Promise<PosCashDrawerSession | null> {
  const [row] = await db
    .insert(posCashDrawerSessions)
    .values({
      id: createId(),
      tenantId: input.tenantId,
      branchId: input.branchId,
      terminalId: input.terminalId,
      registerSessionId: input.registerSessionId,
      handlingMode: input.handlingMode,
      assignedStaffId: input.assignedStaffId,
      currency: input.currency,
      openingFloat: input.openingFloat,
      openedBy: input.actorUserId,
    })
    .onConflictDoNothing()
    .returning();
  return row ? toCashDrawerSession(row) : null;
}

export async function closeCashDrawerSessionRecord(
  db: Database,
  input: {
    tenantId: string;
    cashDrawerSessionId: string;
    actorUserId: string;
    expectedCash: string;
    countedCash: string;
    variance: string;
  },
): Promise<PosCashDrawerSession | null> {
  const now = new Date();
  const [row] = await db
    .update(posCashDrawerSessions)
    .set({
      status: "closed",
      expectedCash: input.expectedCash,
      countedCash: input.countedCash,
      variance: input.variance,
      closedAt: now,
      closedBy: input.actorUserId,
      updatedAt: now,
      version: sql`${posCashDrawerSessions.version} + 1`,
    })
    .where(
      and(
        eq(posCashDrawerSessions.id, input.cashDrawerSessionId),
        eq(posCashDrawerSessions.tenantId, input.tenantId),
        eq(posCashDrawerSessions.status, "open"),
      ),
    )
    .returning();
  return row ? toCashDrawerSession(row) : null;
}

export async function findRegisterCashSessionTotals(
  db: Database,
  input: { tenantId: string; registerSessionId: string },
): Promise<{
  openCount: number;
  openingFloat: string;
  countedCash: string;
}> {
  const [row] = await db
    .select({
      openCount: sql<number>`count(*) filter (
        where ${posCashDrawerSessions.status} = 'open'
      )::int`,
      openingFloat: sql<string>`coalesce(sum(${posCashDrawerSessions.openingFloat}), 0)::text`,
      countedCash: sql<string>`coalesce(sum(
        case when ${posCashDrawerSessions.status} = 'closed'
          then ${posCashDrawerSessions.countedCash}
          else 0
        end
      ), 0)::text`,
    })
    .from(posCashDrawerSessions)
    .where(
      and(
        eq(posCashDrawerSessions.tenantId, input.tenantId),
        eq(
          posCashDrawerSessions.registerSessionId,
          input.registerSessionId,
        ),
      ),
    );
  return {
    openCount: row?.openCount ?? 0,
    openingFloat: row?.openingFloat ?? "0.00",
    countedCash: row?.countedCash ?? "0.00",
  };
}

export async function closeRegisterSessionRecords(
  db: Database,
  input: {
    tenantId: string;
    registerSessionId: string;
    cashDrawerSessionId?: string;
    actorUserId: string;
    expectedCash?: string;
    countedCash?: string;
    variance?: string;
    notes?: string;
  },
): Promise<{
  registerSession: PosRegisterSession;
  cashSession: PosCashDrawerSession | null;
} | null> {
  const now = new Date();
  let cashSession: PosCashDrawerSession | null = null;
  if (input.cashDrawerSessionId) {
    const [cashRow] = await db
      .update(posCashDrawerSessions)
      .set({
        status: "closed",
        expectedCash: input.expectedCash,
        countedCash: input.countedCash,
        variance: input.variance,
        closedAt: now,
        closedBy: input.actorUserId,
        updatedAt: now,
        version: sql`${posCashDrawerSessions.version} + 1`,
      })
      .where(
        and(
          eq(posCashDrawerSessions.id, input.cashDrawerSessionId),
          eq(posCashDrawerSessions.tenantId, input.tenantId),
          eq(posCashDrawerSessions.registerSessionId, input.registerSessionId),
          eq(posCashDrawerSessions.status, "open"),
        ),
      )
      .returning();
    if (!cashRow) return null;
    cashSession = toCashDrawerSession(cashRow);
  }
  const [registerRow] = await db
    .update(posRegisterSessions)
    .set({
      status: "closed",
      closedAt: now,
      closedBy: input.actorUserId,
      closeNotes: input.notes?.trim() || null,
      updatedAt: now,
      version: sql`${posRegisterSessions.version} + 1`,
    })
    .where(
      and(
        eq(posRegisterSessions.id, input.registerSessionId),
        eq(posRegisterSessions.tenantId, input.tenantId),
        eq(posRegisterSessions.status, "open"),
      ),
    )
    .returning();
  if (!registerRow) return null;
  return { registerSession: toRegisterSession(registerRow), cashSession };
}

export async function findPosTerminalForShiftUpdate(
  db: Database,
  input: { tenantId: string; terminalId: string },
): Promise<{
  id: string;
  branchId: string;
  status: "active" | "inactive";
  credentialDigest: string | null;
  credentialVersion: number;
} | null> {
  const rows = await db
    .select({
      id: posTerminalSettings.id,
      branchId: posTerminalSettings.branchId,
      status: posTerminalSettings.status,
      credentialDigest: posTerminalSettings.credentialDigest,
      credentialVersion: posTerminalSettings.credentialVersion,
    })
    .from(posTerminalSettings)
    .where(
      and(
        eq(posTerminalSettings.id, input.terminalId),
        eq(posTerminalSettings.tenantId, input.tenantId),
      ),
    )
    .for("update")
    .limit(1);

  return rows[0] ?? null;
}

export async function findOpenShiftForUpdate(
  db: Database,
  input: { tenantId: string; staffId: string },
): Promise<ShiftRecord | null> {
  const rows = await db
    .select()
    .from(posStaffShifts)
    .where(
      and(
        eq(posStaffShifts.tenantId, input.tenantId),
        eq(posStaffShifts.staffId, input.staffId),
        ne(posStaffShifts.status, "closed"),
      ),
    )
    .for("update")
    .limit(1);
  return rows[0] ? toShift(rows[0]) : null;
}

export async function findShiftCashMovementByIdempotencyKey(
  db: Database,
  input: { tenantId: string; idempotencyKey: string },
): Promise<PosShiftCashMovement | null> {
  const [row] = await db
    .select()
    .from(posShiftCashMovements)
    .where(
      and(
        eq(posShiftCashMovements.tenantId, input.tenantId),
        eq(posShiftCashMovements.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);
  return row ? toCashMovement(row) : null;
}

export async function insertShiftCashMovement(
  db: Database,
  input: {
    tenantId: string;
    branchId: string;
    terminalId: string;
    shiftId?: string;
    registerSessionId?: string;
    cashDrawerSessionId?: string;
    movementType: "pay_in" | "pay_out";
    amount: string;
    currency: string;
    reason: string;
    idempotencyKey: string;
    actorUserId: string;
  },
): Promise<PosShiftCashMovement | null> {
  const [row] = await db
    .insert(posShiftCashMovements)
    .values({
      id: createId(),
      tenantId: input.tenantId,
      branchId: input.branchId,
      terminalId: input.terminalId,
      shiftId: input.shiftId,
      registerSessionId: input.registerSessionId,
      cashDrawerSessionId: input.cashDrawerSessionId,
      movementType: input.movementType,
      amount: input.amount,
      currency: input.currency,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      createdBy: input.actorUserId,
    })
    .onConflictDoNothing()
    .returning();
  return row ? toCashMovement(row) : null;
}

export async function listShiftCashMovements(
  db: Database,
  input: { tenantId: string; shiftId: string },
): Promise<PosShiftCashMovement[]> {
  const rows = await db
    .select()
    .from(posShiftCashMovements)
    .where(
      and(
        eq(posShiftCashMovements.tenantId, input.tenantId),
        eq(posShiftCashMovements.shiftId, input.shiftId),
      ),
    )
    .orderBy(asc(posShiftCashMovements.createdAt));
  return rows.map(toCashMovement);
}

export async function listRegisterCashMovements(
  db: Database,
  input: {
    tenantId: string;
    registerSessionId: string;
    cashDrawerSessionId?: string;
  },
): Promise<PosShiftCashMovement[]> {
  const rows = await db
    .select()
    .from(posShiftCashMovements)
    .where(
      and(
        eq(posShiftCashMovements.tenantId, input.tenantId),
        eq(
          posShiftCashMovements.registerSessionId,
          input.registerSessionId,
        ),
        input.cashDrawerSessionId
          ? eq(
              posShiftCashMovements.cashDrawerSessionId,
              input.cashDrawerSessionId,
            )
          : undefined,
      ),
    )
    .orderBy(asc(posShiftCashMovements.createdAt));
  return rows.map(toCashMovement);
}

export async function findShiftByIdForUpdate(
  db: Database,
  input: { tenantId: string; shiftId: string },
): Promise<ShiftRecord | null> {
  const rows = await db
    .select()
    .from(posStaffShifts)
    .where(
      and(
        eq(posStaffShifts.tenantId, input.tenantId),
        eq(posStaffShifts.id, input.shiftId),
      ),
    )
    .for("update")
    .limit(1);
  return rows[0] ? toShift(rows[0]) : null;
}

export async function createShiftRecord(
  db: Database,
  input: {
    tenantId: string;
    branchId: string;
    terminalId: string | null;
    staffId: string;
    currency: string;
    openingFloat: string;
    actorUserId: string;
  },
): Promise<ShiftRecord | null> {
  const rows = await db
    .insert(posStaffShifts)
    .values({
      id: createId(),
      ...input,
      status: "open",
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
    })
    .onConflictDoNothing()
    .returning();
  return rows[0] ? toShift(rows[0]) : null;
}

export async function findActiveBranchCurrency(
  db: Database,
  input: { tenantId: string; branchId: string },
): Promise<string | null> {
  const rows = await db
    .select({ currency: branches.defaultCurrency })
    .from(branches)
    .where(
      and(
        eq(branches.id, input.branchId),
        eq(branches.tenantId, input.tenantId),
        eq(branches.status, "active"),
        isNull(branches.deletedAt),
      ),
    )
    .limit(1);

  return rows[0]?.currency ?? null;
}

export async function transitionShiftRecord(
  db: Database,
  input: {
    tenantId: string;
    shiftId: string;
    from: "open" | "on_break";
    to: "open" | "on_break" | "closed";
    actorUserId: string;
    closingFloat?: string;
  },
): Promise<ShiftRecord | null> {
  const now = new Date();
  const rows = await db
    .update(posStaffShifts)
    .set({
      status: input.to,
      endedAt: input.to === "closed" ? now : undefined,
      closingFloat: input.to === "closed" ? input.closingFloat : undefined,
      updatedAt: now,
      updatedBy: input.actorUserId,
      version: sql`${posStaffShifts.version} + 1`,
    })
    .where(
      and(
        eq(posStaffShifts.id, input.shiftId),
        eq(posStaffShifts.tenantId, input.tenantId),
        eq(posStaffShifts.status, input.from),
      ),
    )
    .returning();
  return rows[0] ? toShift(rows[0]) : null;
}

export type HandoverSnapshot = {
  currency: string;
  orderCount: number;
  grossSales: string;
  discountAmount: string;
  refundAmount: string;
  correctionAmount: string;
  unsettledPaymentCount: number;
  unsettledPaymentAmount: string;
  unsettledRefundCount: number;
  unsettledRefundAmount: string;
  netSales: string;
  expectedCash: string;
  outstandingOrders: number;
  outstandingTickets: number;
  paymentBreakdown: PosZReportPaymentBreakdown[];
};

export async function calculateHandoverSnapshot(
  db: Database,
  input: {
    tenantId: string;
    branchId: string;
    shiftId?: string;
    registerSessionId?: string;
    cashDrawerSessionId?: string;
    staffId?: string;
    currency: string;
    startedAt: Date;
    cutoffAt: Date;
    openingFloat: string;
  },
): Promise<HandoverSnapshot> {
  if (!input.shiftId && !input.registerSessionId) {
    throw new Error("A shift or register session is required for reconciliation.");
  }
  const paymentSessionFilter = input.cashDrawerSessionId
    ? eq(
        paymentTransactions.cashDrawerSessionId,
        input.cashDrawerSessionId,
      )
    : input.registerSessionId
      ? eq(paymentTransactions.registerSessionId, input.registerSessionId)
    : eq(paymentTransactions.shiftId, input.shiftId!);
  const cashMovementSessionFilter = input.cashDrawerSessionId
    ? eq(
        posShiftCashMovements.cashDrawerSessionId,
        input.cashDrawerSessionId,
      )
    : input.registerSessionId
      ? eq(posShiftCashMovements.registerSessionId, input.registerSessionId)
    : eq(posShiftCashMovements.shiftId, input.shiftId!);
  const [
    orderRows,
    unsettledPaymentRows,
    unsettledRefundRows,
    paymentRows,
    adjustmentRows,
    cashMovementRows,
    outstandingOrderRows,
    outstandingTicketRows,
  ] = await Promise.all([
    db
      .select({
        count: sql<number>`count(*)::int`,
        gross: sql<string>`coalesce(sum(${orders.subtotalAmount}), 0)`,
        discount: sql<string>`coalesce(sum(${orders.discountAmount}), 0)`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, input.tenantId),
          eq(orders.branchId, input.branchId),
          eq(orders.currency, input.currency),
          gte(orders.createdAt, input.startedAt),
          lte(orders.createdAt, input.cutoffAt),
          ne(orders.status, "cancelled"),
          isNull(orders.deletedAt),
        ),
      ),
    db
      .select({
        count: sql<number>`count(*)::int`,
        amount: sql<string>`coalesce(sum(${paymentTransactions.amount}), 0)`,
      })
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.tenantId, input.tenantId),
          eq(paymentTransactions.branchId, input.branchId),
          paymentSessionFilter,
          eq(paymentTransactions.currency, input.currency),
          eq(paymentTransactions.paymentStatus, "pending"),
          inArray(paymentTransactions.paymentMethod, ["card", "app"]),
          gte(paymentTransactions.createdAt, input.startedAt),
          lte(paymentTransactions.createdAt, input.cutoffAt),
          isNull(paymentTransactions.deletedAt),
        ),
      ),
    db
      .select({
        count: sql<number>`count(*)::int`,
        amount: sql<string>`coalesce(sum(${posPaymentAdjustments.amount}), 0)`,
      })
      .from(posPaymentAdjustments)
      .where(
        and(
          eq(posPaymentAdjustments.tenantId, input.tenantId),
          eq(posPaymentAdjustments.branchId, input.branchId),
          input.staffId
            ? eq(posPaymentAdjustments.createdBy, input.staffId)
            : sql`false`,
          eq(posPaymentAdjustments.currency, input.currency),
          eq(posPaymentAdjustments.adjustmentType, "refund"),
          eq(posPaymentAdjustments.status, "pending"),
          gte(posPaymentAdjustments.occurredAt, input.startedAt),
          lte(posPaymentAdjustments.occurredAt, input.cutoffAt),
        ),
      ),
    db
      .select({
        amount: paymentTransactions.amount,
        method: paymentTransactions.paymentMethod,
        provider: paymentTransactions.gateway,
      })
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.tenantId, input.tenantId),
          eq(paymentTransactions.branchId, input.branchId),
          paymentSessionFilter,
          eq(paymentTransactions.currency, input.currency),
          eq(paymentTransactions.paymentStatus, "paid"),
          gte(paymentTransactions.paidAt, input.startedAt),
          lte(paymentTransactions.paidAt, input.cutoffAt),
          isNull(paymentTransactions.deletedAt),
        ),
      ),
    db
      .select({
        amount: posPaymentAdjustments.amount,
        adjustmentType: posPaymentAdjustments.adjustmentType,
        direction: posPaymentAdjustments.direction,
        method: paymentTransactions.paymentMethod,
        provider: paymentTransactions.gateway,
      })
      .from(posPaymentAdjustments)
      .leftJoin(
        paymentTransactions,
        eq(paymentTransactions.id, posPaymentAdjustments.originalPaymentId),
      )
      .where(
        and(
          eq(posPaymentAdjustments.tenantId, input.tenantId),
          eq(posPaymentAdjustments.branchId, input.branchId),
          eq(posPaymentAdjustments.currency, input.currency),
          eq(posPaymentAdjustments.status, "succeeded"),
          or(
            paymentSessionFilter,
            and(
              isNull(posPaymentAdjustments.originalPaymentId),
              input.staffId
                ? eq(posPaymentAdjustments.createdBy, input.staffId)
                : sql`false`,
            ),
          ),
          gte(posPaymentAdjustments.occurredAt, input.startedAt),
          lte(posPaymentAdjustments.occurredAt, input.cutoffAt),
        ),
      ),
    db
      .select({
        amount: posShiftCashMovements.amount,
        movementType: posShiftCashMovements.movementType,
      })
      .from(posShiftCashMovements)
      .where(
        and(
          eq(posShiftCashMovements.tenantId, input.tenantId),
          cashMovementSessionFilter,
          eq(posShiftCashMovements.currency, input.currency),
          lte(posShiftCashMovements.createdAt, input.cutoffAt),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, input.tenantId),
          eq(orders.branchId, input.branchId),
          lte(orders.createdAt, input.cutoffAt),
          notInArray(orders.status, ["delivered", "cancelled"]),
          isNull(orders.deletedAt),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(serviceTickets)
      .where(
        and(
          eq(serviceTickets.tenantId, input.tenantId),
          eq(serviceTickets.branchId, input.branchId),
          inArray(serviceTickets.ticketType, ["laundry", "car_wash"]),
          lte(serviceTickets.createdAt, input.cutoffAt),
          notInArray(serviceTickets.ticketStatus, ["picked_up", "cancelled"]),
          isNull(serviceTickets.deletedAt),
        ),
      ),
  ]);

  const breakdown = new Map<string, PosZReportPaymentBreakdown>();
  for (const payment of paymentRows) {
    const provider = payment.provider || null;
    const key = `${payment.method}:${provider ?? "default"}`;
    const current = breakdown.get(key) ?? {
      method: payment.method,
      provider,
      grossAmount: "0.00",
      refundAmount: "0.00",
      netAmount: "0.00",
      transactionCount: 0,
    };
    current.grossAmount = money(
      Number(current.grossAmount) + Number(payment.amount),
    );
    current.netAmount = money(
      Number(current.netAmount) + Number(payment.amount),
    );
    current.transactionCount += 1;
    breakdown.set(key, current);
  }
  for (const adjustment of adjustmentRows) {
    const method = adjustment.method ?? "unknown";
    const provider = adjustment.provider || null;
    const key = `${method}:${provider ?? "default"}`;
    const current = breakdown.get(key) ?? {
      method,
      provider,
      grossAmount: "0.00",
      refundAmount: "0.00",
      netAmount: "0.00",
      transactionCount: 0,
    };
    const amount = Number(adjustment.amount);
    if (adjustment.adjustmentType === "refund") {
      const refundDelta = adjustment.direction === "debit" ? amount : -amount;
      current.refundAmount = money(Number(current.refundAmount) + refundDelta);
      current.netAmount = money(Number(current.netAmount) - refundDelta);
    } else {
      const correctionDelta =
        adjustment.direction === "credit" ? amount : -amount;
      current.netAmount = money(Number(current.netAmount) + correctionDelta);
    }
    breakdown.set(key, current);
  }

  const { refundAmount, correctionAmount, cashAdjustment } =
    calculateAdjustmentTotals(adjustmentRows);
  const cashPayments = paymentRows
    .filter((row) => row.method === "cash")
    .reduce((total, row) => total + Number(row.amount), 0);
  const grossSales = Number(orderRows[0]?.gross ?? 0);
  const discountAmount = Number(orderRows[0]?.discount ?? 0);
  const cashMovementNet = cashMovementRows.reduce(
    (total, movement) =>
      total +
      (movement.movementType === "pay_in"
        ? Number(movement.amount)
        : -Number(movement.amount)),
    0,
  );

  return {
    currency: input.currency,
    orderCount: orderRows[0]?.count ?? 0,
    grossSales: money(grossSales),
    discountAmount: money(discountAmount),
    refundAmount: money(refundAmount),
    correctionAmount: money(correctionAmount),
    unsettledPaymentCount: unsettledPaymentRows[0]?.count ?? 0,
    unsettledPaymentAmount: money(Number(unsettledPaymentRows[0]?.amount ?? 0)),
    unsettledRefundCount: unsettledRefundRows[0]?.count ?? 0,
    unsettledRefundAmount: money(Number(unsettledRefundRows[0]?.amount ?? 0)),
    netSales: calculateNetSales(
      grossSales,
      discountAmount,
      refundAmount,
      correctionAmount,
    ),
    expectedCash: money(
      Number(input.openingFloat) +
        cashPayments +
        cashAdjustment +
        cashMovementNet,
    ),
    outstandingOrders: outstandingOrderRows[0]?.count ?? 0,
    outstandingTickets: outstandingTicketRows[0]?.count ?? 0,
    paymentBreakdown: [...breakdown.values()],
  };
}

export async function createHandoverAndZReport(
  db: Database,
  input: {
    tenantId: string;
    branchId: string;
    terminalId: string;
    shift: ShiftRecord;
    incomingStaffId: string;
    countedCash: string;
    notes?: string;
    cutoffAt: Date;
    actorUserId: string;
    snapshot: HandoverSnapshot;
  },
): Promise<HandoverRecord | null> {
  const handoverId = createId();
  const zReportId = createId();
  const variance = calculateCashVariance(
    input.countedCash,
    input.snapshot.expectedCash,
  );
  const handoverRows = await db
    .insert(posShiftHandovers)
    .values({
      id: handoverId,
      tenantId: input.tenantId,
      branchId: input.branchId,
      terminalId: input.terminalId,
      outgoingShiftId: input.shift.id,
      outgoingStaffId: input.shift.staffId,
      incomingStaffId: input.incomingStaffId,
      expectedCash: input.snapshot.expectedCash,
      countedCash: input.countedCash,
      variance,
      outstandingOrders: input.snapshot.outstandingOrders,
      outstandingTickets: input.snapshot.outstandingTickets,
      notes: input.notes?.trim() || null,
      cutoffAt: input.cutoffAt,
      createdBy: input.actorUserId,
    })
    .onConflictDoNothing()
    .returning();
  if (!handoverRows[0]) return null;

  const reportRows = await db
    .insert(posZReports)
    .values({
      id: zReportId,
      tenantId: input.tenantId,
      branchId: input.branchId,
      terminalId: input.terminalId,
      shiftId: input.shift.id,
      handoverId,
      currency: input.snapshot.currency,
      cutoffAt: input.cutoffAt,
      orderCount: input.snapshot.orderCount,
      grossSales: input.snapshot.grossSales,
      discountAmount: input.snapshot.discountAmount,
      refundAmount: input.snapshot.refundAmount,
      correctionAmount: input.snapshot.correctionAmount,
      unsettledPaymentCount: input.snapshot.unsettledPaymentCount,
      unsettledPaymentAmount: input.snapshot.unsettledPaymentAmount,
      unsettledRefundCount: input.snapshot.unsettledRefundCount,
      unsettledRefundAmount: input.snapshot.unsettledRefundAmount,
      netSales: input.snapshot.netSales,
      expectedCash: input.snapshot.expectedCash,
      countedCash: input.countedCash,
      variance,
      outstandingOrders: input.snapshot.outstandingOrders,
      paymentBreakdown: input.snapshot.paymentBreakdown,
      createdBy: input.actorUserId,
    })
    .returning();

  const closed = await transitionShiftRecord(db, {
    tenantId: input.tenantId,
    shiftId: input.shift.id,
    from: input.shift.status === "on_break" ? "on_break" : "open",
    to: "closed",
    closingFloat: input.countedCash,
    actorUserId: input.actorUserId,
  });
  if (!reportRows[0] || !closed) {
    throw new Error("Atomic handover could not close the shift.");
  }

  const handover = handoverRows[0];
  return {
    id: handover.id,
    tenantId: handover.tenantId,
    branchId: handover.branchId,
    terminalId: handover.terminalId,
    outgoingShiftId: handover.outgoingShiftId,
    outgoingStaffId: handover.outgoingStaffId,
    incomingStaffId: handover.incomingStaffId,
    expectedCash: handover.expectedCash,
    countedCash: handover.countedCash,
    variance: handover.variance,
    outstandingOrders: handover.outstandingOrders,
    outstandingTickets: handover.outstandingTickets,
    notes: handover.notes,
    cutoffAt: handover.cutoffAt.toISOString(),
    createdAt: handover.createdAt.toISOString(),
    zReport: toZReport(reportRows[0]),
  };
}

export async function insertRegisterZReport(
  db: Database,
  input: {
    tenantId: string;
    branchId: string;
    terminalId: string;
    registerSessionId: string;
    countedCash: string;
    cutoffAt: Date;
    actorUserId: string;
    snapshot: HandoverSnapshot;
  },
): Promise<PosZReport | null> {
  const [row] = await db
    .insert(posZReports)
    .values({
      id: createId(),
      tenantId: input.tenantId,
      branchId: input.branchId,
      terminalId: input.terminalId,
      registerSessionId: input.registerSessionId,
      currency: input.snapshot.currency,
      cutoffAt: input.cutoffAt,
      orderCount: input.snapshot.orderCount,
      grossSales: input.snapshot.grossSales,
      discountAmount: input.snapshot.discountAmount,
      refundAmount: input.snapshot.refundAmount,
      correctionAmount: input.snapshot.correctionAmount,
      unsettledPaymentCount: input.snapshot.unsettledPaymentCount,
      unsettledPaymentAmount: input.snapshot.unsettledPaymentAmount,
      unsettledRefundCount: input.snapshot.unsettledRefundCount,
      unsettledRefundAmount: input.snapshot.unsettledRefundAmount,
      netSales: input.snapshot.netSales,
      expectedCash: input.snapshot.expectedCash,
      countedCash: input.countedCash,
      variance: calculateCashVariance(
        input.countedCash,
        input.snapshot.expectedCash,
      ),
      outstandingOrders: input.snapshot.outstandingOrders,
      paymentBreakdown: input.snapshot.paymentBreakdown,
      createdBy: input.actorUserId,
    })
    .onConflictDoNothing()
    .returning();
  return row ? toZReport(row) : null;
}

export async function listZReports(
  db: Database,
  input: { tenantId: string; branchId: string; limit: number; offset: number },
): Promise<PosZReport[]> {
  const rows = await db
    .select()
    .from(posZReports)
    .where(
      and(
        eq(posZReports.tenantId, input.tenantId),
        eq(posZReports.branchId, input.branchId),
      ),
    )
    .orderBy(desc(posZReports.cutoffAt))
    .limit(input.limit)
    .offset(input.offset);
  return rows.map(toZReport);
}

export async function findZReport(
  db: Database,
  input: { tenantId: string; branchId: string; zReportId: string },
): Promise<PosZReport | null> {
  const rows = await db
    .select()
    .from(posZReports)
    .where(
      and(
        eq(posZReports.id, input.zReportId),
        eq(posZReports.tenantId, input.tenantId),
        eq(posZReports.branchId, input.branchId),
      ),
    )
    .limit(1);
  return rows[0] ? toZReport(rows[0]) : null;
}
