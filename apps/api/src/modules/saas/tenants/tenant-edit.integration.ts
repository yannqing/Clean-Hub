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
import { verifyPassword } from "../../auth/password.service.js";
import { changeTenantSelfPin } from "../../tenant/profile/profile.service.js";
import { updatePosChannelSettingsRecord, findPosChannelSettingsRecord } from "../../tenant/pos-channel/pos-channel.repository.js";
import { SaasTenantsError } from "./tenants.errors.js";
import { createSaasTenant, listSaasTenantUsers, updateSaasTenant, updateSaasTenantFeatureFlags, updateSaasTenantSettings } from "./tenants.service.js";

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

          const createdTenant = await createSaasTenant({
            authContext: saasAuth,
            data: {
              name: "Automatically coded tenant",
              country: "QX",
              featureFlags: {
                laundryEnabled: false,
                carWashEnabled: true,
                retailProductsEnabled: true,
                deliveryEnabled: true,
                notificationsEnabled: false,
                emailEnabled: true,
                customerOtpEnabled: true,
              },
              initialOwner: { displayName: "Initial owner", email: `owner-${tenantId}@example.test` },
            },
          }, tx);
          assert.match(createdTenant.pressingCode, /^(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]{10}$/);
          const [createdRecord] = await tx.select({ pressingCode: tenants.pressingCode })
            .from(tenants).where(eq(tenants.id, createdTenant.id));
          assert.equal(createdRecord?.pressingCode, createdTenant.pressingCode);
          const [createdFlags] = await tx.select().from(tenantFeatureFlags)
            .where(eq(tenantFeatureFlags.tenantId, createdTenant.id));
          assert.equal(createdFlags?.laundryEnabled, false);
          assert.equal(createdFlags?.carWashEnabled, true);
          assert.equal(createdFlags?.retailProductsEnabled, true);
          assert.equal(createdFlags?.deliveryEnabled, true);
          assert.equal(createdFlags?.notificationsEnabled, false);
          assert.equal(createdFlags?.emailEnabled, true);
          assert.equal(createdFlags?.customerOtpEnabled, true);
          const defaultTenant = await createSaasTenant({
            authContext: saasAuth,
            data: { name: "Default flag tenant", country: "QX" },
          }, tx);
          const [defaultFlags] = await tx.select().from(tenantFeatureFlags)
            .where(eq(tenantFeatureFlags.tenantId, defaultTenant.id));
          assert.equal(defaultFlags?.laundryEnabled, true);
          assert.equal(defaultFlags?.carWashEnabled, false);
          assert.equal(defaultFlags?.notificationsEnabled, true);
          assert.equal(defaultFlags?.emailEnabled, false);
          assert.ok(createdTenant.initialOwnerUserId);
          const createdUsers = await listSaasTenantUsers({
            authContext: saasAuth,
            tenantId: createdTenant.id,
          }, tx);
          assert.equal(createdUsers.length, 1);
          assert.equal(createdUsers[0]?.id, createdTenant.initialOwnerUserId);
          assert.deepEqual(createdUsers[0]?.roleCodes, ["owner"]);
          const [ownerCredentials] = await tx.select({ passwordHash: users.passwordHash, pinHash: users.pinHash })
            .from(users).where(eq(users.id, createdTenant.initialOwnerUserId));
          assert.equal(await verifyPassword("123456", ownerCredentials.passwordHash), true);
          assert.equal(await verifyPassword("666666", ownerCredentials.pinHash), true);
          const createdOwnerAuth: AuthContext = {
            ...authBase, userId: createdTenant.initialOwnerUserId,
            tenantId: createdTenant.id, role: "owner",
          };
          await changeTenantSelfPin({
            authContext: createdOwnerAuth,
            data: { currentPin: "666666", newPin: "654321" },
          }, tx);
          const [changedPin] = await tx.select({ pinHash: users.pinHash })
            .from(users).where(eq(users.id, createdTenant.initialOwnerUserId));
          assert.equal(await verifyPassword("654321", changedPin.pinHash), true);

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
