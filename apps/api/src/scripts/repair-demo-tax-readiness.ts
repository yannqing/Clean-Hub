import "../config/env.js";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  branches, closeDbConnection, getDb, orders, posChannelSettings, prices, roles,
  serviceCategories, serviceBranchSettings, services, tenantFeatureFlags, userBranches,
  runWithSystemDatabaseContext, tenantSettings, tenants, userRoles, users, type Database,
} from "@cleanhub/db";

import { writeAuditLog } from "../modules/audit/audit.helper.js";
import { createBranchRecord } from "../modules/tenant/branches/branches.repository.js";
import { findPlatformSettings } from "../modules/saas/platform-settings/platform-settings.repository.js";
import { findPlatformTaxTemplateForCountry } from "../modules/tax/platform-tax-template.repository.js";
import { isReadyTaxTemplate } from "../modules/tax/tax-template-readiness.js";
import { resolvePosTaxReadiness } from "../modules/tax/pos-tax-readiness.js";
import { syncTaxTemplateForTenant } from "../modules/tenant/tax-rates/tax-template.service.js";
import { findPosChannelSettingsRecord, updatePosChannelSettingsRecord } from "../modules/tenant/pos-channel/pos-channel.repository.js";

// User-confirmed test tenants only. Never infer the country of a real merchant.
const demoTenants = [
  { id: "01KRERJN800000000000000001", code: "CLEAN-001", name: "CleanHub Demo Tenant 1", country: "SN" },
  { id: "01KRERJN810000000000000002", code: "CLEAN-002", name: "CleanHub Demo Tenant 2", country: "CI" },
  { id: "01KRERJN820000000000000003", code: "CLEAN-003", name: "CleanHub Demo Tenant 3", country: "ML" },
  { id: "01M4D63YHY2FMC9WS6RFHRRCXM", code: "CLEAN-004", name: "test-merchant-1", country: "CM" },
] as const;

async function orderFingerprint(db: Database, ids: string[]): Promise<string> {
  // Complete rows: country repair must not modify any historical order field.
  const result = await db.execute(sql`select md5(coalesce(jsonb_agg(to_jsonb(o) order by o.id)::text,'[]')) as fingerprint
    from ${orders} o where o.tenant_id in (${sql.join(ids.map((id) => sql`${id}`), sql`,`)})`);
  return String(result.rows[0]?.fingerprint);
}

export async function repairDemoTaxReadiness(db: Database, apply: boolean, prepareNewBranch = false) {
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(tenants).where(and(inArray(tenants.id, demoTenants.map((tenant) => tenant.id)), isNull(tenants.deletedAt))).for("update");
    const beforeOrders = rows.length ? await orderFingerprint(tx, rows.map((row) => row.id)) : null;
    const originalPrices = rows.length ? await tx.select().from(prices).where(inArray(prices.tenantId, rows.map((row) => row.id))).orderBy(prices.id) : [];
    const originalBranches = rows.length ? await tx.select().from(branches).where(inArray(branches.tenantId, rows.map((row) => row.id))).orderBy(branches.id) : [];
    const [actor] = await tx.select({ id: users.id }).from(users)
      .innerJoin(userRoles, and(eq(userRoles.userId, users.id), isNull(userRoles.revokedAt)))
      .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.code, "super_admin"), eq(roles.scope, "saas"), eq(roles.status, "active")))
      .where(and(eq(users.userType, "saas"), eq(users.status, "active"), isNull(users.deletedAt))).limit(1);
    if (apply && !actor) throw new Error("An active SaaS super administrator is required for audited demo repair.");
    const summary = [];
    for (const fixture of demoTenants) {
      const tenant = rows.find((row) => row.id === fixture.id);
      if (!tenant) continue;
      if (tenant.pressingCode !== fixture.code || tenant.name !== fixture.name) {
        throw new Error(`Refusing to modify ${fixture.code}: it no longer matches the confirmed demo fixture.`);
      }
      if (tenant.country?.trim() && tenant.country !== fixture.country) {
        throw new Error(`Refusing to replace the existing country of ${fixture.code}. Review it explicitly.`);
      }
      const template = await findPlatformTaxTemplateForCountry(tx, fixture.country);
      if (!template || !isReadyTaxTemplate(template) || !template.taxEnabled) {
        throw new Error(`${fixture.country}: configure/import a complete enabled SaaS tax template before demo repair.`);
      }
      const [[settings], branchRows, [previousTax]] = await Promise.all([
        tx.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenant.id)).limit(1),
        tx.select({ id: branches.id, currency: branches.defaultCurrency }).from(branches)
          .where(and(eq(branches.tenantId, tenant.id), isNull(branches.deletedAt))),
        tx.select().from(posChannelSettings).where(eq(posChannelSettings.tenantId, tenant.id)).limit(1),
      ]);
      if (settings && settings.defaultCurrency !== template.currencyCode) {
        throw new Error(`${fixture.code}: tenant currency differs from the template. This repair never changes existing settings or monetary amounts.`);
      }
      const matchingBranches = branchRows.filter((branch) => branch.currency === template.currencyCode);
      const needsNewBranch = branchRows.some((branch) => branch.currency !== template.currencyCode) && matchingBranches.length === 0;
      if (apply && needsNewBranch && !prepareNewBranch) {
        throw new Error(`${fixture.code}: retain the old store and use --prepare-new-demo-branch for the user-authorized new test store.`);
      }
      const taxNumber = previousTax?.taxRegistrationNumber?.trim() || `TEST-${fixture.country}-${fixture.code}`;
      if (apply) {
        const defaults = await findPlatformSettings(tx);
        await tx.insert(tenantSettings).values({ tenantId: tenant.id, defaultCurrency: template.currencyCode!,
          defaultLanguage: defaults?.defaultLanguage ?? "en", timezone: defaults?.timezone ?? "UTC", updatedBy: actor!.id })
          .onConflictDoNothing({ target: tenantSettings.tenantId });
        await tx.insert(tenantFeatureFlags).values({ tenantId: tenant.id, laundryEnabled: true, carWashEnabled: true, updatedBy: actor!.id })
          .onConflictDoNothing({ target: tenantFeatureFlags.tenantId });
        if (!tenant.country?.trim()) {
          await tx.update(tenants).set({ country: fixture.country, updatedAt: new Date(), version: sql`${tenants.version} + 1` })
            .where(and(eq(tenants.id, tenant.id), eq(tenants.pressingCode, fixture.code)));
        }
        await syncTaxTemplateForTenant(tx, { tenantId: tenant.id, actorUserId: actor!.id, template });
        const current = await findPosChannelSettingsRecord(tx, tenant.id);
        await updatePosChannelSettingsRecord(tx, { tenantId: tenant.id, actorUserId: actor!.id, current,
          data: { version: current.version, taxRegistrationNumber: taxNumber } });
        await writeAuditLog(tx, { tenantId: tenant.id, actorUserId: actor!.id, eventCategory: "saas_tenant",
          eventType: "tenant.demo_tax_readiness_repaired", entityType: "tenant", entityId: tenant.id,
          reason: "User confirmed these are test tenants and authorized assigning test countries and TEST tax numbers.",
          before: { country: tenant.country, tax: previousTax ?? null },
          after: { country: fixture.country, templateVersion: template.version, taxRegistrationNumber: taxNumber },
          metadata: { demoOnly: true, historicalOrdersUnchanged: true } });
        if (needsNewBranch && prepareNewBranch) {
          const newBranch = await createBranchRecord(tx, { tenantId: tenant.id, actorUserId: actor!.id,
            name: `TEST ${fixture.code} ${fixture.country} ${template.currencyCode}`, receiptName: `TEST ${fixture.code}`,
            defaultLanguage: defaults?.defaultLanguage === "zh-CN" || defaults?.defaultLanguage === "fr" ? defaults.defaultLanguage : "en" });
          const staff = await tx.select({ id: users.id }).from(users)
            .where(and(eq(users.tenantId, tenant.id), eq(users.status, "active"), isNull(users.deletedAt)));
          for (const user of staff) {
            await tx.insert(userBranches).values({ tenantId: tenant.id, branchId: newBranch.id, userId: user.id }).onConflictDoNothing();
          }
          const sourceServices = await tx.select({ service: services, price: prices }).from(services)
            .innerJoin(prices, and(eq(prices.tenantId, tenant.id), eq(prices.serviceId, services.id), eq(prices.status, "active"), isNull(prices.deletedAt)))
            .innerJoin(serviceCategories, and(eq(serviceCategories.id, services.categoryId), eq(serviceCategories.tenantId, tenant.id), eq(serviceCategories.status, "active"), isNull(serviceCategories.deletedAt)))
            .where(and(eq(services.tenantId, tenant.id), eq(services.status, "active"), isNull(services.deletedAt)));
          for (const source of sourceServices) {
            const code = `DEMO-${fixture.country}-${source.service.id}`;
            const [copy] = await tx.insert(services).values({ tenantId: tenant.id, categoryId: source.service.categoryId,
              code, name: `TEST ${source.service.name}`.slice(0, 200), businessLine: source.service.businessLine,
              pricingUnit: source.service.pricingUnit, labelRule: source.service.labelRule,
              applicableItemTypes: source.service.applicableItemTypes, turnaroundMinutes: source.service.turnaroundMinutes,
              allBranches: false, displayOrder: source.service.displayOrder,
              internalNotes: `Demo-only price in ${template.currencyCode}. Source ${source.service.id} amount ${source.price.amount} ${source.price.currency}; this is a new test price, not a currency conversion.`,
              createdBy: actor!.id, updatedBy: actor!.id }).returning({ id: services.id });
            await tx.insert(prices).values({ tenantId: tenant.id, serviceId: copy.id, amount: source.price.amount,
              currency: template.currencyCode!, createdBy: actor!.id, updatedBy: actor!.id });
            await tx.insert(serviceBranchSettings).values({ tenantId: tenant.id, branchId: newBranch.id,
              serviceId: copy.id, isAvailable: true, createdBy: actor!.id, updatedBy: actor!.id });
          }
          matchingBranches.push({ id: newBranch.id, currency: template.currencyCode! });
          await writeAuditLog(tx, { tenantId: tenant.id, actorUserId: actor!.id, eventCategory: "saas_tenant",
            eventType: "tenant.demo_store_provisioned", entityType: "branch", entityId: newBranch.id,
            reason: "User authorized a new template-currency test store and new test prices while retaining all old amounts and currencies.",
            metadata: { demoOnly: true, currency: template.currencyCode, copiedServiceCount: sourceServices.length,
              oldBranchIds: branchRows.map((branch) => branch.id), terminalReenrollmentRequired: true } });
        }
        for (const branch of matchingBranches) {
          const readiness = await resolvePosTaxReadiness(tx, tenant.id, branch.id);
          if (!readiness.ready) throw new Error(`${fixture.code}: readiness failed after repair (${readiness.code}).`);
        }
      }
      summary.push({ tenantCode: fixture.code, country: fixture.country, taxRegistrationNumber: taxNumber,
        templateVersion: template.version, branches: matchingBranches, oldBranchesPreserved: branchRows.map((branch) => branch.id),
        terminalReenrollmentRequired: needsNewBranch, applied: apply });
    }
    if (beforeOrders !== null && beforeOrders !== await orderFingerprint(tx, rows.map((row) => row.id))) {
      throw new Error("Historical orders changed; rolling back demo repair.");
    }
    const afterPrices = originalPrices.length ? await tx.select().from(prices).where(inArray(prices.id, originalPrices.map((row) => row.id))).orderBy(prices.id) : [];
    const afterBranches = originalBranches.length ? await tx.select().from(branches).where(inArray(branches.id, originalBranches.map((row) => row.id))).orderBy(branches.id) : [];
    if (JSON.stringify(originalPrices) !== JSON.stringify(afterPrices) || JSON.stringify(originalBranches) !== JSON.stringify(afterBranches)) {
      throw new Error("Original store or price data changed; rolling back demo repair.");
    }
    return summary;
  });
}

if (process.argv[1]?.endsWith("repair-demo-tax-readiness.ts")) {
  try {
    const apply = process.argv.includes("--apply-confirmed-demo-data");
    const summary = await runWithSystemDatabaseContext(() => repairDemoTaxReadiness(getDb(), apply, process.argv.includes("--prepare-new-demo-branch")));
    console.log(JSON.stringify({ mode: apply ? "applied" : "preview", tenants: summary, historicalOrdersUnchanged: true }, null, 2));
  } finally {
    await closeDbConnection();
  }
}
