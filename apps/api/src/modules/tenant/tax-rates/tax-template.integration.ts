import assert from "node:assert/strict";

import "../../../config/env.js";
import { eq, sql } from "drizzle-orm";

import {
  closeDbConnection,
  getDb,
  platformTaxTemplates,
  posChannelSettings,
  products,
  runWithSystemDatabaseContext,
  taxRates,
  tenantSettings,
  tenants,
  users,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import type { AuthContext } from "../../auth/auth.types.js";
import { findPlatformTaxTemplateForCountry } from "../../saas/tenants/tenants.repository.js";
import { ApplyTaxTemplateError, applyTenantTaxTemplate, syncTaxTemplateForTenant } from "./tax-template.service.js";
import { updateTenantTaxRate } from "./tax-rates.service.js";

const rollback = new Error("TAX_TEMPLATE_INTEGRATION_ROLLBACK");

async function run(): Promise<void> {
  try {
    await runWithSystemDatabaseContext(async () => {
      try {
        await getDb().transaction(async (tx) => {
          const tenantId = createId();
          const userId = createId();
          const rateId = createId();
          const countryCode = "ZZ";
          await tx.insert(tenants).values({
            id: tenantId,
            name: "Template integration tenant",
            pressingCode: `TAX-${tenantId}`,
            status: "active",
          });
          await tx.insert(users).values({
            id: userId,
            tenantId,
            userType: "tenant",
            passwordHash: "integration-test-only",
            pinHash: "integration-test-only",
            status: "active",
          });
          await tx.insert(tenantSettings).values({
            id: createId(),
            tenantId,
            defaultCurrency: "GHS",
          });
          await tx.insert(posChannelSettings).values({
            id: createId(),
            tenantId,
            taxEnabled: true,
            defaultTaxRate: "0.1000",
          });
          await tx.insert(taxRates).values({
            id: rateId,
            tenantId,
            name: "Old display name",
            rate: "0.1000",
            templateRateKey: "standard",
          });
          const obsoleteRateId = createId();
          const productId = createId();
          await tx.insert(taxRates).values({
            id: obsoleteRateId,
            tenantId,
            name: "Obsolete specialty",
            rate: "0.1000",
            templateRateKey: "obsolete",
          });
          await tx.insert(products).values({
            id: productId,
            tenantId,
            name: "Previously assigned item",
            taxRateId: obsoleteRateId,
          });
          await tx.insert(platformTaxTemplates).values({
            id: createId(),
            countryCode,
            name: "Testland - Composite",
            currencyCode: "GHS",
            taxLabel: "Composite tax",
            rates: [
              {
                key: "standard",
                name: "New display name",
                rate: "0.2000",
                isDefault: true,
                components: [
                  { name: "Part A", rate: "0.1500" },
                  { name: "Part B", rate: "0.0500" },
                ],
              },
            ],
          });
          assert.equal(
            (await findPlatformTaxTemplateForCountry(tx, "Testland"))
              ?.countryCode,
            countryCode,
          );
          const authContext: AuthContext = {
            userId,
            displayName: "Template test owner",
            tenantId,
            branchIds: [],
            role: "owner",
            roles: ["owner"],
            permissions: [],
            accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
          };
          await assert.rejects(() => applyTenantTaxTemplate(
            {
              authContext,
              countryCode,
              templateVersion: 1,
              settingsVersion: 1,
            },
            tx,
          ), (error: unknown) => error instanceof ApplyTaxTemplateError && error.code === "TAX_TEMPLATE_RATE_IN_USE");
          await tx.update(products).set({ taxRateId: null }).where(eq(products.id, productId));
          const result = await applyTenantTaxTemplate(
            {
              authContext,
              countryCode,
              templateVersion: 1,
              settingsVersion: 1,
            },
            tx,
          );
          assert.equal(result.defaultTaxRate, "0.2000");
          const [rate] = await tx
            .select()
            .from(taxRates)
            .where(eq(taxRates.id, rateId));
          assert.equal(rate?.name, "New display name");
          assert.equal(rate?.rate, "0.2000");
          const [settings] = await tx
            .select()
            .from(posChannelSettings)
            .where(eq(posChannelSettings.tenantId, tenantId));
          assert.equal(settings?.taxTemplateCountryCode, countryCode);
          assert.equal(settings?.taxTemplateVersion, 1);
          const [obsolete] = await tx.select().from(taxRates).where(eq(taxRates.id, obsoleteRateId));
          assert.ok(obsolete?.deletedAt, "removed unassigned template rates must no longer be usable");
          assert.deepEqual(settings?.defaultTaxComponents, [
            { name: "Part A", rate: "0.1500" },
            { name: "Part B", rate: "0.0500" },
          ]);
          const [{ count }] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(taxRates)
            .where(sql`${taxRates.tenantId} = ${tenantId} and ${taxRates.deletedAt} is null`);
          assert.equal(
            count,
            1,
            "renaming a tax class must retain its ID and product assignments",
          );
          const [currentTemplate] = await tx.select().from(platformTaxTemplates).where(eq(platformTaxTemplates.countryCode, countryCode));
          assert.ok(currentTemplate);
          const unmanagedId = createId();
          await tx.insert(taxRates).values({
            id: unmanagedId, tenantId, name: "Unmanaged old rate", rate: "0.0900",
          });
          await assert.rejects(() => syncTaxTemplateForTenant(tx, {
            tenantId, actorUserId: userId, template: currentTemplate,
          }), (error: unknown) => error instanceof ApplyTaxTemplateError && error.code === "TAX_TEMPLATE_UNMANAGED_RATE");
          await tx.update(taxRates).set({ deletedAt: new Date() }).where(eq(taxRates.id, unmanagedId));
          const legacyExemptId = createId();
          await tx.insert(taxRates).values({
            id: legacyExemptId, tenantId, name: "Old exempt", rate: "0.0000",
          });
          await syncTaxTemplateForTenant(tx, {
            tenantId,
            actorUserId: userId,
            template: {
              ...currentTemplate,
              version: 2,
              rates: [
                { ...currentTemplate.rates[0], rate: "0.2500", components: [{ name: "Part A", rate: "0.2000" }, { name: "Part B", rate: "0.0500" }] },
                { key: "exempt", name: "Exempt", rate: "0.0000", isDefault: false },
              ],
            },
          });
          const [synced] = await tx.select().from(taxRates).where(eq(taxRates.id, rateId));
          assert.equal(synced?.rate, "0.2500", "SaaS updates must reprice future sales of assigned items");
          const [adoptedExempt] = await tx.select().from(taxRates).where(eq(taxRates.id, legacyExemptId));
          assert.equal(adoptedExempt?.templateRateKey, "exempt", "matching legacy rates must keep their IDs when the template is applied");
          await syncTaxTemplateForTenant(tx, {
            tenantId,
            actorUserId: userId,
            template: {
              ...currentTemplate,
              version: 3,
              rates: [
                { ...currentTemplate.rates[0], name: "Exempt" },
                { key: "exempt", name: "New display name", rate: "0.0000", isDefault: false },
              ],
            },
          });
          const [swapped] = await tx.select().from(taxRates).where(eq(taxRates.id, rateId));
          assert.equal(swapped?.name, "Exempt", "swapping names must preserve stable tax class IDs");
          await updateTenantTaxRate({
            authContext,
            taxRateId: rateId,
            data: { rate: "0.2100", expectedVersion: swapped!.version },
          }, tx);
          const [detached] = await tx.select().from(posChannelSettings)
            .where(eq(posChannelSettings.tenantId, tenantId));
          assert.equal(detached?.taxTemplateCountryCode, null, "manual rate edits must detach SaaS auto-sync");
          assert.equal(detached?.defaultTaxComponents, null, "manual rate edits must clear the component split");
          throw rollback;
        });
      } catch (error) {
        if (error !== rollback) throw error;
      }
    });
  } finally {
    await closeDbConnection();
  }
}

run().then(() =>
  console.log("Tax template integration passed with a clean rollback."),
);
