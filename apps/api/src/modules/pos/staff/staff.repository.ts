import {
  and,
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

import {
  branches,
  orders,
  paymentTransactions,
  posPaymentAdjustments,
  posShiftHandovers,
  posStaffShifts,
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
  PosZReport,
  PosZReportPaymentBreakdown,
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

function toZReport(row: typeof posZReports.$inferSelect): PosZReport {
  return {
    id: row.id,
    tenantId: row.tenantId,
    branchId: row.branchId,
    terminalId: row.terminalId,
    shiftId: row.shiftId,
    handoverId: row.handoverId,
    currency: row.currency,
    cutoffAt: row.cutoffAt.toISOString(),
    orderCount: row.orderCount,
    grossSales: row.grossSales,
    discountAmount: row.discountAmount,
    refundAmount: row.refundAmount,
    correctionAmount: row.correctionAmount,
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
  return money(Number(countedCash) - Number(expectedCash));
}

export function calculateNetSales(
  grossSales: string | number,
  discountAmount: string | number,
): string {
  return money(Number(grossSales) - Number(discountAmount));
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
    .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
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
    .filter((staff) => !input.query?.status || staff.status === input.query.status)
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

export async function createShiftRecord(
  db: Database,
  input: {
    tenantId: string;
    branchId: string;
    terminalId: string;
    staffId: string;
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
    startedAt: Date;
    cutoffAt: Date;
    openingFloat: string;
  },
): Promise<HandoverSnapshot> {
  const [currencyRows, orderRows, paymentRows, adjustmentRows, outstandingOrderRows, outstandingTicketRows] =
    await Promise.all([
      db
        .select({ currency: branches.defaultCurrency })
        .from(branches)
        .where(
          and(
            eq(branches.id, input.branchId),
            eq(branches.tenantId, input.tenantId),
            isNull(branches.deletedAt),
          ),
        )
        .limit(1),
      db
        .select({
          count: sql<number>`count(*)::int`,
          gross: sql<string>`coalesce(sum(${orders.totalAmount}), 0)`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.tenantId, input.tenantId),
            eq(orders.branchId, input.branchId),
            gte(orders.createdAt, input.startedAt),
            lte(orders.createdAt, input.cutoffAt),
            ne(orders.status, "cancelled"),
            isNull(orders.deletedAt),
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
            gte(posPaymentAdjustments.occurredAt, input.startedAt),
            lte(posPaymentAdjustments.occurredAt, input.cutoffAt),
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
            lte(serviceTickets.createdAt, input.cutoffAt),
            notInArray(serviceTickets.ticketStatus, ["picked_up", "cancelled"]),
            isNull(serviceTickets.deletedAt),
          ),
        ),
    ]);

  const breakdown = new Map<
    string,
    PosZReportPaymentBreakdown
  >();
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
    current.grossAmount = money(Number(current.grossAmount) + Number(payment.amount));
    current.netAmount = money(Number(current.netAmount) + Number(payment.amount));
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
  const discountAmount = 0;

  return {
    currency: currencyRows[0]?.currency ?? "XOF",
    orderCount: orderRows[0]?.count ?? 0,
    grossSales: money(grossSales),
    discountAmount: money(discountAmount),
    refundAmount: money(refundAmount),
    correctionAmount: money(correctionAmount),
    netSales: calculateNetSales(grossSales, discountAmount),
    expectedCash: money(
      Number(input.openingFloat) + cashPayments + cashAdjustment,
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
