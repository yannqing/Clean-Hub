import { getDb, type Database } from "@cleanhub/db";

import type { AuthContext } from "../../auth/auth.types.js";
import {
  assertBranchAccess,
  resolveAllowedBranchIds,
} from "../../auth/branch-scope.helper.js";
import {
  assertActiveTenant,
  assertTenantContext,
  requireTenantRole,
} from "../../auth/permission.helper.js";
import {
  findTenantReportContext,
  getTenantReportSummaryRecord,
} from "./reports.repository.js";
import type { ReportSummary, ReportSummaryInput } from "./reports.types.js";

function getTenantId(authContext: AuthContext): string {
  assertTenantContext(authContext);

  return authContext.tenantId!;
}

function resolveTimezone(value: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return "UTC";
  }
}

function getDateOnlyInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function addCalendarDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function resolveDefaultDateRange(
  input: ReportSummaryInput,
  timezone: string,
): ReportSummaryInput {
  if (input.from || input.to) {
    return input;
  }

  const to = getDateOnlyInTimezone(new Date(), timezone);

  return {
    ...input,
    from: addCalendarDays(to, -29),
    to,
  };
}

export async function getTenantReportSummary(
  authContext: AuthContext,
  input: ReportSummaryInput,
  db: Database = getDb(),
): Promise<ReportSummary> {
  const tenantId = getTenantId(authContext);

  requireTenantRole(authContext, ["owner", "manager"]);
  await assertActiveTenant(authContext, db);

  if (input.branchId) {
    await assertBranchAccess(authContext, input.branchId, db);
  }

  const allowedBranchScope = await resolveAllowedBranchIds(authContext, db);
  const allowedBranchIds =
    allowedBranchScope === "all" ? undefined : allowedBranchScope;
  const context = await findTenantReportContext(db, {
    tenantId,
    allowedBranchIds,
  });
  const timezone = resolveTimezone(context.timezone);
  const fallbackCurrency = context.availableCurrencies.includes(
    context.defaultCurrency,
  )
    ? context.defaultCurrency
    : (context.availableCurrencies[0] ?? context.defaultCurrency);
  const currency =
    input.currency && context.availableCurrencies.includes(input.currency)
      ? input.currency
      : fallbackCurrency;
  const normalizedInput = resolveDefaultDateRange(input, timezone);

  return getTenantReportSummaryRecord(db, {
    ...normalizedInput,
    tenantId,
    allowedBranchIds,
    currency,
    timezone,
    availableCurrencies: context.availableCurrencies,
  });
}
