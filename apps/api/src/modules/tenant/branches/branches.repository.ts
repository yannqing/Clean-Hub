import { and, asc, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";

import { branches, type Database, userBranches } from "@cleanhub/db";
import {
  DEFAULT_POS_RECEIPT_FIELDS,
  DEFAULT_POS_TICKET_LABEL_FIELDS,
  normalizePosReceiptFields,
  normalizePosTicketLabelFields,
} from "@cleanhub/domain/receipt";
import { createId } from "@cleanhub/id";

import { writeAuditLog } from "../../audit/audit.helper.js";
import { findTenantDefaultCurrency } from "../settings/settings.repository.js";
import { TenantBranchesError } from "./branches.errors.js";
import type {
  BranchAuditSnapshot,
  BranchBusinessHours,
  BranchListInput,
  BranchStatus,
  BranchSummary,
  BranchWeekday,
  CreateBranchRequest,
  UpdateBranchRequest,
} from "./branches.types.js";

function normalizeNullable(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

const branchWeekdays: BranchWeekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const legacyWeekdayAliases: Record<string, BranchWeekday> = {
  mon: "monday",
  tue: "tuesday",
  wed: "wednesday",
  thu: "thursday",
  fri: "friday",
  sat: "saturday",
  sun: "sunday",
};

function isTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function normalizeBusinessHours(value: unknown): BranchBusinessHours | null {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return null;
  }

  const normalized: BranchBusinessHours = {};

  for (const [rawWeekday, rawHours] of Object.entries(value)) {
    const weekday = branchWeekdays.includes(rawWeekday as BranchWeekday)
      ? (rawWeekday as BranchWeekday)
      : legacyWeekdayAliases[rawWeekday];

    if (!weekday) {
      continue;
    }

    let opensAt: unknown;
    let closesAt: unknown;

    if (typeof rawHours === "string") {
      [opensAt, closesAt] = rawHours.split("-");
    } else if (
      rawHours &&
      !Array.isArray(rawHours) &&
      typeof rawHours === "object"
    ) {
      const source = rawHours as Record<string, unknown>;
      opensAt = source.opensAt ?? source.open;
      closesAt = source.closesAt ?? source.close;
    }

    if (isTime(opensAt) && isTime(closesAt) && opensAt < closesAt) {
      normalized[weekday] = { opensAt, closesAt };
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

function isBranchLogoObjectKey(value: string | null): value is string {
  return Boolean(value?.includes("/branch_logo/unassigned/"));
}

function toBranchSummary(row: typeof branches.$inferSelect): BranchSummary {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    phone: row.phone,
    businessHours: normalizeBusinessHours(row.businessHours),
    defaultLanguage:
      row.defaultLanguage === "fr" || row.defaultLanguage === "zh-CN"
        ? row.defaultLanguage
        : "en",
    defaultCurrency: row.defaultCurrency,
    receiptName: row.receiptName,
    receiptPhone: row.receiptPhone,
    receiptAddress: row.receiptAddress,
    receiptFields: normalizePosReceiptFields(row.receiptFields),
    ticketLabelFields: normalizePosTicketLabelFields(row.ticketLabelFields),
    paymentMethodsEnabled: row.paymentMethodsEnabled,
    defaultPaymentMethod: row.defaultPaymentMethod,
    cashHandlingMode: row.cashHandlingMode,
    logoObjectKey: isBranchLogoObjectKey(row.logoUrl) ? row.logoUrl : null,
    logoUrl: isBranchLogoObjectKey(row.logoUrl) ? null : row.logoUrl,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

function toAuditSnapshot(branch: BranchSummary): BranchAuditSnapshot {
  const { updatedAt: _updatedAt, ...snapshot } = branch;
  return snapshot;
}

export async function findBranches(
  db: Database,
  input: BranchListInput & { tenantId: string; allowedBranchIds?: string[] },
): Promise<BranchSummary[]> {
  if (input.allowedBranchIds?.length === 0) {
    return [];
  }

  const filters: SQL[] = [
    eq(branches.tenantId, input.tenantId),
    isNull(branches.deletedAt),
  ];

  if (input.allowedBranchIds) {
    filters.push(inArray(branches.id, input.allowedBranchIds));
  }

  if (input.status) {
    filters.push(eq(branches.status, input.status));
  }

  if (input.q) {
    const query = `%${escapeLikePattern(input.q)}%`;
    filters.push(
      or(
        sql`${branches.name} ilike ${query} escape '\\'`,
        sql`${branches.address} ilike ${query} escape '\\'`,
        sql`${branches.phone} ilike ${query} escape '\\'`,
      )!,
    );
  }

  const rows = await db
    .select()
    .from(branches)
    .where(and(...filters))
    .orderBy(asc(branches.name))
    .limit(input.limit)
    .offset(input.offset);

  return rows.map(toBranchSummary);
}

export async function findBranchById(
  db: Database,
  input: { tenantId: string; branchId: string },
): Promise<BranchSummary | null> {
  const rows = await db
    .select()
    .from(branches)
    .where(
      and(
        eq(branches.id, input.branchId),
        eq(branches.tenantId, input.tenantId),
        isNull(branches.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ? toBranchSummary(rows[0]) : null;
}

export async function createBranchRecord(
  db: Database,
  input: CreateBranchRequest & { tenantId: string; actorUserId: string },
): Promise<BranchSummary> {
  const branchId = createId();
  const defaultCurrency = await findTenantDefaultCurrency(db, input.tenantId);

  await db.insert(branches).values({
    id: branchId,
    tenantId: input.tenantId,
    name: input.name.trim(),
    address: normalizeNullable(input.address),
    phone: normalizeNullable(input.phone),
    businessHours: input.businessHours ?? null,
    defaultLanguage: input.defaultLanguage ?? "en",
    defaultCurrency,
    receiptName: normalizeNullable(input.receiptName),
    receiptPhone: normalizeNullable(input.receiptPhone),
    receiptAddress: normalizeNullable(input.receiptAddress),
    receiptFields: input.receiptFields ?? [...DEFAULT_POS_RECEIPT_FIELDS],
    ticketLabelFields: input.ticketLabelFields ?? [
      ...DEFAULT_POS_TICKET_LABEL_FIELDS,
    ],
    paymentMethodsEnabled: input.paymentMethodsEnabled ?? ["cash"],
    defaultPaymentMethod: input.defaultPaymentMethod ?? "cash",
    cashHandlingMode: input.cashHandlingMode ?? "shared_drawer",
    logoUrl: normalizeNullable(input.logoObjectKey),
    status: input.status ?? "active",
    createdBy: input.actorUserId,
    updatedBy: input.actorUserId,
  });

  return (await findBranchById(db, {
    tenantId: input.tenantId,
    branchId,
  }))!;
}

export async function assignBranchToUser(
  db: Database,
  input: { tenantId: string; branchId: string; userId: string },
): Promise<void> {
  await db.insert(userBranches).values({
    tenantId: input.tenantId,
    branchId: input.branchId,
    userId: input.userId,
  });
}

export async function updateBranchRecord(
  db: Database,
  input: {
    tenantId: string;
    branchId: string;
    actorUserId: string;
    current: BranchSummary;
    data: UpdateBranchRequest;
  },
): Promise<BranchSummary | null> {
  const updatedRows = await db
    .update(branches)
    .set({
      name: input.data.name?.trim() ?? input.current.name,
      address:
        input.data.address === undefined
          ? input.current.address
          : normalizeNullable(input.data.address),
      phone:
        input.data.phone === undefined
          ? input.current.phone
          : normalizeNullable(input.data.phone),
      businessHours:
        input.data.businessHours === undefined
          ? input.current.businessHours
          : input.data.businessHours,
      defaultLanguage:
        input.data.defaultLanguage ?? input.current.defaultLanguage,
      // Currency is a tenant-wide setting. Existing branches are synchronized
      // when that setting changes, so branch edits must not create overrides.
      defaultCurrency: input.current.defaultCurrency,
      receiptName:
        input.data.receiptName === undefined
          ? input.current.receiptName
          : normalizeNullable(input.data.receiptName),
      receiptPhone:
        input.data.receiptPhone === undefined
          ? input.current.receiptPhone
          : normalizeNullable(input.data.receiptPhone),
      receiptAddress:
        input.data.receiptAddress === undefined
          ? input.current.receiptAddress
          : normalizeNullable(input.data.receiptAddress),
      receiptFields:
        input.data.receiptFields === undefined
          ? input.current.receiptFields
          : normalizePosReceiptFields(input.data.receiptFields),
      ticketLabelFields:
        input.data.ticketLabelFields === undefined
          ? input.current.ticketLabelFields
          : normalizePosTicketLabelFields(input.data.ticketLabelFields),
      paymentMethodsEnabled:
        input.data.paymentMethodsEnabled ?? input.current.paymentMethodsEnabled,
      defaultPaymentMethod:
        input.data.defaultPaymentMethod ?? input.current.defaultPaymentMethod,
      cashHandlingMode:
        input.data.cashHandlingMode ?? input.current.cashHandlingMode,
      logoUrl:
        input.data.logoObjectKey === undefined
          ? (input.current.logoObjectKey ?? input.current.logoUrl)
          : normalizeNullable(input.data.logoObjectKey),
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${branches.version} + 1`,
    })
    .where(
      and(
        eq(branches.id, input.branchId),
        eq(branches.tenantId, input.tenantId),
        eq(branches.version, input.data.version),
        isNull(branches.deletedAt),
      ),
    )
    .returning({ id: branches.id });

  if (!updatedRows[0]) {
    const existing = await findBranchById(db, {
      tenantId: input.tenantId,
      branchId: input.branchId,
    });
    if (!existing) {
      throw new TenantBranchesError(
        "BRANCH_NOT_FOUND",
        "Branch was not found.",
        404,
      );
    }
    throw new TenantBranchesError(
      "BRANCH_VERSION_CONFLICT",
      "Branch has been modified. Refresh and try again.",
      409,
    );
  }

  return findBranchById(db, {
    tenantId: input.tenantId,
    branchId: input.branchId,
  });
}

export async function updateBranchStatusRecord(
  db: Database,
  input: {
    tenantId: string;
    branchId: string;
    actorUserId: string;
    status: BranchStatus;
    version: number;
  },
): Promise<BranchSummary | null> {
  const updatedRows = await db
    .update(branches)
    .set({
      status: input.status,
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${branches.version} + 1`,
    })
    .where(
      and(
        eq(branches.id, input.branchId),
        eq(branches.tenantId, input.tenantId),
        eq(branches.version, input.version),
        isNull(branches.deletedAt),
      ),
    )
    .returning({ id: branches.id });

  if (!updatedRows[0]) {
    const existing = await findBranchById(db, {
      tenantId: input.tenantId,
      branchId: input.branchId,
    });
    if (!existing) {
      throw new TenantBranchesError(
        "BRANCH_NOT_FOUND",
        "Branch was not found.",
        404,
      );
    }
    throw new TenantBranchesError(
      "BRANCH_VERSION_CONFLICT",
      "Branch has been modified. Refresh and try again.",
      409,
    );
  }

  return findBranchById(db, {
    tenantId: input.tenantId,
    branchId: input.branchId,
  });
}

export async function writeBranchCreatedAuditLog(
  db: Database,
  input: {
    actorUserId: string;
    branch: BranchSummary;
    tenantId: string;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  await writeAuditLog(db, {
    tenantId: input.tenantId,
    branchId: input.branch.id,
    actorUserId: input.actorUserId,
    eventCategory: "tenant_branch",
    eventType: "branch.created",
    entityType: "branch",
    entityId: input.branch.id,
    after: toAuditSnapshot(input.branch),
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
}

export async function writeBranchUpdatedAuditLog(
  db: Database,
  input: {
    actorUserId: string;
    before: BranchSummary;
    after: BranchSummary;
    tenantId: string;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  await writeAuditLog(db, {
    tenantId: input.tenantId,
    branchId: input.after.id,
    actorUserId: input.actorUserId,
    eventCategory: "tenant_branch",
    eventType: "branch.updated",
    entityType: "branch",
    entityId: input.after.id,
    before: toAuditSnapshot(input.before),
    after: toAuditSnapshot(input.after),
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
}

export async function writeBranchStatusChangedAuditLog(
  db: Database,
  input: {
    actorUserId: string;
    before: BranchSummary;
    after: BranchSummary;
    tenantId: string;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  await writeAuditLog(db, {
    tenantId: input.tenantId,
    branchId: input.after.id,
    actorUserId: input.actorUserId,
    eventCategory: "tenant_branch",
    eventType: "branch.status_changed",
    entityType: "branch",
    entityId: input.after.id,
    before: { status: input.before.status },
    after: { status: input.after.status },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
}
