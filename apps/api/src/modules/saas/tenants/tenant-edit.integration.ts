import assert from "node:assert/strict";

import "../../../config/env.js";
import { eq } from "drizzle-orm";
import {
  branches,
  closeDbConnection,
  getDb,
  orders,
  platformTaxTemplates,
  posChannelSettings,
  products,
  runWithSystemDatabaseContext,
  taxRates,
  tenantFeatureFlags,
  tenantSettings,
  tenants,
  users,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import type { AuthContext } from "../../auth/auth.types.js";
import { resolvePosTaxReadiness } from "../../tax/pos-tax-readiness.js";
import { getTenantSettings, updateTenantSettings } from "../../tenant/settings/settings.service.js";
import { TenantSettingsError } from "../../tenant/settings/settings.errors.js";
import { updatePosChannelSettingsRecord, findPosChannelSettingsRecord } from "../../tenant/pos-channel/pos-channel.repository.js";
import { SaasTenantsError } from "./tenants.errors.js";
import { updateSaasTenant, updateSaasTenantFeatureFlags, updateSaasTenantSettings } from "./tenants.service.js";

const rollback = new Error("TENANT_EDIT_INTEGRATION_ROLLBACK");

async function run(): Promise<void> {
  try {
    await runWithSystemDatabaseContext(async () => {
      try {
        await getDb().transaction(async (tx) => {
          const tenantId = createId();
          const saasUserId = createId();
          const ownerId = createId();
          const branchId = createId();
          await tx.insert(tenants).values({
            id: tenantId,
            name: "Before edit",
            pressingCode: `EDIT-${tenantId}`,
            country: "QX",
            status: "active",
          });
          await tx.insert(users).values([
            { id: saasUserId, userType: "saas", passwordHash: "test", pinHash: "test", status: "active" },
            { id: ownerId, tenantId, userType: "tenant", passwordHash: "test", pinHash: "test", status: "active" },
          ]);
          await tx.insert(tenantSettings).values({ id: createId(), tenantId, defaultCurrency: "XOF" });
          await tx.insert(tenantFeatureFlags).values({ id: createId(), tenantId });
          await tx.insert(branches).values({ id: branchId, tenantId, name: "Test branch", defaultCurrency: "XOF" });
          await tx.insert(posChannelSettings).values({
            id: createId(), tenantId, taxEnabled: true, defaultTaxRate: "0.1000",
            taxRegistrationNumber: "OLD-ID", taxTemplateCountryCode: "QX", taxTemplateVersion: 1,
          });
          await tx.insert(taxRates).values({
            id: createId(), tenantId, name: "Standard", rate: "0.1000", templateRateKey: "standard",
          });
          await tx.insert(platformTaxTemplates).values([
            { id: createId(), countryCode: "QX", name: "Test X", currencyCode: "XOF", taxLabel: "VAT", taxEnabled: true, rates: [{ key: "standard", name: "Standard", rate: "0.1000", isDefault: true }] },
            { id: createId(), countryCode: "QY", name: "Test Y", currencyCode: "GHS", taxLabel: "VAT", taxEnabled: true, rates: [{ key: "standard", name: "Standard", rate: "0.2000", isDefault: true }] },
            { id: createId(), countryCode: "QZ", name: "Test Z", currencyCode: "GHS", taxLabel: "VAT", taxEnabled: true, rates: [{ key: "replacement", name: "Replacement", rate: "0.1500", isDefault: true }] },
          ]);

          const authBase = {
            displayName: "Test user", branchIds: [], roles: [], permissions: [],
            accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
          };
          const saasAuth: AuthContext = { ...authBase, userId: saasUserId, tenantId: null, role: "super_admin" };
          const ownerAuth: AuthContext = { ...authBase, userId: ownerId, tenantId, role: "owner" };

          await updateSaasTenant({
            authContext: saasAuth, tenantId,
            data: {
              name: "After edit", pressingCode: `EDIT-NEW-${tenantId}`,
              city: "Dakar", contactName: "Store manager", contactPhone: "+221123456789",
              contactEmail: "manager@example.test",
            },
          }, tx);
          const tenantView = await getTenantSettings({ authContext: ownerAuth }, tx);
          assert.equal(tenantView.tenantName, "After edit");
          assert.equal(tenantView.pressingCode, `EDIT-NEW-${tenantId}`);
          assert.equal(tenantView.city, "Dakar");
          assert.equal(tenantView.contactName, "Store manager");
          assert.equal(tenantView.contactPhone, "+221123456789");
          assert.equal(tenantView.contactEmail, "manager@example.test");
          await updateSaasTenantSettings({
            authContext: saasAuth, tenantId, data: { defaultLanguage: "fr" },
          }, tx);
          await updateSaasTenantFeatureFlags({
            authContext: saasAuth, tenantId, data: { carWashEnabled: true },
          }, tx);
          const updatedSettings = await getTenantSettings({ authContext: ownerAuth }, tx);
          assert.equal(updatedSettings.defaultLanguage, "fr");
          assert.equal(updatedSettings.featureFlags.carWashEnabled, true);

          await updateSaasTenant({ authContext: saasAuth, tenantId, data: { country: "QY" } }, tx);
          const afterCountry = await getTenantSettings({ authContext: ownerAuth }, tx);
          assert.equal(afterCountry.country, "QY");
          assert.equal(afterCountry.defaultCurrency, "GHS");
          const [branch] = await tx.select().from(branches).where(eq(branches.id, branchId));
          assert.equal(branch?.defaultCurrency, "GHS");
          const tax = await findPosChannelSettingsRecord(tx, tenantId);
          assert.equal(tax.taxTemplateCountryCode, "QY");
          assert.equal(tax.defaultTaxRate, "0.2000");
          assert.equal(tax.taxRegistrationNumber, null);
          assert.equal((await resolvePosTaxReadiness(tx, tenantId, branchId)).code, "POS_TAX_CONFIGURATION_INCOMPLETE");

          await updatePosChannelSettingsRecord(tx, {
            tenantId, actorUserId: saasUserId, current: tax,
            data: { version: tax.version, taxRegistrationNumber: "NEW-ID" },
          });
          assert.equal((await resolvePosTaxReadiness(tx, tenantId, branchId)).ready, true);

          await tx.update(branches).set({ defaultCurrency: "XOF" }).where(eq(branches.id, branchId));
          await updateSaasTenant({ authContext: saasAuth, tenantId, data: { country: "Test Y" } }, tx);
          const [realignedBranch] = await tx.select({ currency: branches.defaultCurrency })
            .from(branches).where(eq(branches.id, branchId));
          assert.equal(realignedBranch?.currency, "GHS");
          assert.equal((await findPosChannelSettingsRecord(tx, tenantId)).taxRegistrationNumber, "NEW-ID");

          const [assignedRate] = await tx.select({ id: taxRates.id }).from(taxRates)
            .where(eq(taxRates.tenantId, tenantId)).limit(1);
          await tx.insert(products).values({
            id: createId(), tenantId, name: "Assigned product", taxRateId: assignedRate.id,
          });
          await assert.rejects(
            () => updateSaasTenant({ authContext: saasAuth, tenantId, data: { country: "QZ" } }, tx),
            (error: unknown) => error instanceof SaasTenantsError && error.code === "SAAS_TENANT_TAX_TEMPLATE_CONFLICT",
          );
          assert.equal((await getTenantSettings({ authContext: ownerAuth }, tx)).country, "QY");
          assert.equal((await findPosChannelSettingsRecord(tx, tenantId)).taxRegistrationNumber, "NEW-ID");

          await assert.rejects(
            () => updateTenantSettings({ authContext: ownerAuth, data: { country: "QX", tenantVersion: afterCountry.tenantVersion } }, tx),
            (error: unknown) => error instanceof TenantSettingsError && error.code === "TENANT_COUNTRY_SAAS_MANAGED",
          );
          await assert.rejects(
            () => updateTenantSettings({ authContext: ownerAuth, data: { defaultCurrency: "XOF" } }, tx),
            (error: unknown) => error instanceof TenantSettingsError && error.code === "TENANT_CURRENCY_SAAS_MANAGED",
          );

          await tx.insert(orders).values({
            id: createId(), tenantId, branchId, currency: "GHS", createdBy: ownerId,
          });
          await assert.rejects(
            () => updateSaasTenant({ authContext: saasAuth, tenantId, data: { country: "QX" } }, tx),
            (error: unknown) => error instanceof SaasTenantsError && error.code === "SAAS_TENANT_CURRENCY_IN_USE",
          );
          assert.equal((await getTenantSettings({ authContext: ownerAuth }, tx)).country, "QY");
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

run().then(() => console.log("Tenant edit integration passed with a clean rollback."));
