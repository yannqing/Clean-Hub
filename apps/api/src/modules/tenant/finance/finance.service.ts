import { getDb, type Database } from "@cleanhub/db";

import type { AuthContext } from "../../auth/auth.types.js";
import { resolveAllowedBranchIds } from "../../auth/branch-scope.helper.js";
import {
  assertActiveTenant,
  assertTenantContext,
  requireTenantRole,
} from "../../auth/permission.helper.js";
import { TenantFinanceError } from "./finance.errors.js";
import {
  findTenantFinanceContext,
  getTenantFinanceSummaryRecord,
} from "./finance.repository.js";
import type { FinanceSummary, FinanceSummaryInput } from "./finance.types.js";

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

function resolveDateRange(
  input: FinanceSummaryInput,
  timezone: string,
): Required<Pick<FinanceSummaryInput, "from" | "to">> {
  const today = getDateOnlyInTimezone(new Date(), timezone);

  return {
    from: input.from ?? addCalendarDays(input.to ?? today, -29),
    to: input.to ?? today,
  };
}

export async function getTenantFinanceSummary(
  authContext: AuthContext,
  input: FinanceSummaryInput,
  db: Database = getDb(),
): Promise<FinanceSummary> {
  const tenantId = getTenantId(authContext);

  requireTenantRole(authContext, ["owner", "manager"]);
  await assertActiveTenant(authContext, db);

  const allowedBranchScope = await resolveAllowedBranchIds(authContext, db);
  const allowedBranchIds =
    allowedBranchScope === "all" ? undefined : allowedBranchScope;
  const context = await findTenantFinanceContext(db, {
    tenantId,
    allowedBranchIds,
  });
  const activeAllowedBranchIds = context.availableBranches.map(
    (branch) => branch.id,
  );

  if (
    input.branchId &&
    !context.availableBranches.some((branch) => branch.id === input.branchId)
  ) {
    throw new TenantFinanceError(
      "FINANCE_BRANCH_NOT_FOUND",
      "Branch was not found.",
      404,
    );
  }

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
  const range = resolveDateRange(input, timezone);

  return getTenantFinanceSummaryRecord(db, {
    ...input,
    ...range,
    tenantId,
    allowedBranchIds: activeAllowedBranchIds,
    currency,
    timezone,
    availableCurrencies: context.availableCurrencies,
    availableBranches: context.availableBranches,
  });
}
