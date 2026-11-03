import { and, countDistinct, eq, inArray, isNull, sql } from "drizzle-orm";
import { branches, posTerminalSettings, roles, tenants, userRoles, users, type Database } from "@cleanhub/db";

import type { AllowedBranchScope } from "../auth/branch-scope.helper.js";
import { findPosCatalogProducts, findPosCatalogServices } from "../pos/catalog/catalog.repository.js";
import { evaluatePosTaxReadiness, loadPosTaxReadinessContext, type PosTaxReadiness } from "./pos-tax-readiness.js";

export type TenantCheckoutReadiness = {
  ready: boolean;
  tenantActive: boolean;
  activeOwnerCount: number;
  activeBranchCount: number;
  activeCatalogItemCount: number;
  enrolledTerminalCount: number;
  taxEnabled: boolean;
  taxTemplateApplied: boolean;
  taxRegistrationNumberSet: boolean;
  taxReadiness: PosTaxReadiness;
  branches: Array<{
    id: string;
    name: string;
    currency: string;
    catalogReady: boolean;
    enrolledTerminalCount: number;
    taxReadiness: PosTaxReadiness;
    ready: boolean;
  }>;
};

/** Shared by SaaS details and the tenant home page. At least one same branch must be ready. */
export async function resolveTenantCheckoutReadiness(db: Database, tenantId: string, allowedBranchIds: AllowedBranchScope = "all"): Promise<TenantCheckoutReadiness> {
  const [[tenant], ownerRows, branchRows, terminalRows, context] = await Promise.all([
    db.select({ status: tenants.status }).from(tenants).where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt))).limit(1),
    db.select({ value: countDistinct(users.id) }).from(users)
      .innerJoin(userRoles, and(eq(userRoles.userId, users.id), eq(userRoles.tenantId, tenantId), isNull(userRoles.revokedAt)))
      .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.code, "owner"), eq(roles.status, "active"), isNull(roles.deletedAt)))
      .where(and(eq(users.tenantId, tenantId), eq(users.status, "active"), isNull(users.deletedAt))),
    db.select({ id: branches.id, name: branches.name, currency: branches.defaultCurrency }).from(branches)
      .where(and(eq(branches.tenantId, tenantId), eq(branches.status, "active"), isNull(branches.deletedAt),
        ...(allowedBranchIds === "all" ? [] : [inArray(branches.id, allowedBranchIds)]))),
    db.select({ branchId: posTerminalSettings.branchId }).from(posTerminalSettings)
      .where(and(eq(posTerminalSettings.tenantId, tenantId), eq(posTerminalSettings.status, "active"), sql`${posTerminalSettings.credentialDigest} is not null`)),
    loadPosTaxReadinessContext(db, tenantId),
  ]);
  const taxReadiness = evaluatePosTaxReadiness(context.checks);
  const activeOwnerCount = ownerRows[0]?.value ?? 0;
  const tenantActive = tenant?.status === "active";
  const branchReadiness = await Promise.all(branchRows.map(async (branch) => {
    const [services, products] = await Promise.all([
      findPosCatalogServices(db, { tenantId, branchId: branch.id, limit: 1 }),
      findPosCatalogProducts(db, { tenantId, branchId: branch.id, limit: 1 }),
    ]);
    const catalogReady = services.length > 0 || products.length > 0;
    const enrolledTerminalCount = terminalRows.filter((terminal) => terminal.branchId === branch.id).length;
    const branchTax = evaluatePosTaxReadiness({ ...context.checks, currencyMatches: context.checks.currencyMatches && branch.currency === context.templateCurrency });
    return { ...branch, catalogReady, enrolledTerminalCount, taxReadiness: branchTax,
      ready: tenantActive && activeOwnerCount > 0 && catalogReady && enrolledTerminalCount > 0 && branchTax.ready };
  }));
  return {
    ready: branchReadiness.some((branch) => branch.ready), tenantActive, activeOwnerCount,
    activeBranchCount: branchReadiness.length,
    activeCatalogItemCount: branchReadiness.some((branch) => branch.catalogReady) ? 1 : 0,
    enrolledTerminalCount: branchReadiness.reduce((total, branch) => total + branch.enrolledTerminalCount, 0),
    taxEnabled: context.checks.taxEnabled, taxTemplateApplied: context.checks.templateApplied,
    taxRegistrationNumberSet: context.checks.taxRegistrationNumberSet, taxReadiness, branches: branchReadiness,
  };
}
