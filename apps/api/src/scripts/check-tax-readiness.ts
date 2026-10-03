import "../config/env.js";

import {
  branches,
  closeDbConnection,
  getDb,
  platformTaxTemplates,
  posChannelSettings,
  runWithSystemDatabaseContext,
  taxRates,
  tenantSettings,
  tenants,
} from "@cleanhub/db";
import { and, eq, isNull } from "drizzle-orm";

import { findPlatformTaxTemplateForCountry } from "../modules/saas/tenants/tenants.repository.js";
import { isReadyTaxTemplate } from "../modules/tax/tax-template-readiness.js";

// Market scope only. The tax values themselves are read from the database.
const launchCountries = ["SN", "CI", "ML", "BF", "GN", "CM", "TG", "BJ", "NG", "GH", "SL", "LR", "GM"];

async function check(): Promise<string[]> {
  return runWithSystemDatabaseContext(async () => {
    const db = getDb();
    const errors: string[] = [];
    const templates = await db.select().from(platformTaxTemplates);
    for (const country of launchCountries) {
      const template = templates.find((entry) => entry.countryCode === country);
      if (!template || !isReadyTaxTemplate(template)) {
        errors.push(`${country}: complete SaaS country template is missing`);
      } else if (!template.taxEnabled) {
        errors.push(`${country}: country template has tax disabled`);
      }
    }

    const activeTenants = await db.select({ id: tenants.id, country: tenants.country })
      .from(tenants).where(and(eq(tenants.status, "active"), isNull(tenants.deletedAt)));
    for (const tenant of activeTenants) {
      const [settings, pos, branchRows, legacyRates] = await Promise.all([
        db.select({ currency: tenantSettings.defaultCurrency }).from(tenantSettings)
          .where(eq(tenantSettings.tenantId, tenant.id)).limit(1),
        db.select({
          country: posChannelSettings.taxTemplateCountryCode,
          version: posChannelSettings.taxTemplateVersion,
          taxEnabled: posChannelSettings.taxEnabled,
          taxRegistrationNumber: posChannelSettings.taxRegistrationNumber,
        }).from(posChannelSettings).where(eq(posChannelSettings.tenantId, tenant.id)).limit(1),
        db.select({ currency: branches.defaultCurrency }).from(branches)
          .where(and(eq(branches.tenantId, tenant.id), isNull(branches.deletedAt))),
        db.select({ name: taxRates.name }).from(taxRates).where(and(
          eq(taxRates.tenantId, tenant.id), isNull(taxRates.templateRateKey), isNull(taxRates.deletedAt),
        )),
      ]);
      const prefix = `tenant ${tenant.id}`;
      if (!tenant.country) {
        errors.push(`${prefix}: country is not set`);
        continue;
      }
      const countryTemplate = await findPlatformTaxTemplateForCountry(db, tenant.country);
      if (!countryTemplate || !isReadyTaxTemplate(countryTemplate)) {
        errors.push(`${prefix}: country ${tenant.country} has no complete template`);
        continue;
      }
      if (pos[0]?.country !== countryTemplate.countryCode || pos[0]?.version !== countryTemplate.version) {
        errors.push(`${prefix}: country template is not applied at the current version`);
      }
      if (!pos[0]?.taxEnabled) {
        errors.push(`${prefix}: tax is disabled`);
      }
      if (settings[0]?.currency !== countryTemplate.currencyCode ||
          branchRows.some((branch) => branch.currency !== countryTemplate.currencyCode)) {
        errors.push(`${prefix}: tenant or branch currency differs from ${countryTemplate.countryCode} template`);
      }
      if (legacyRates.length > 0) {
        errors.push(`${prefix}: ${legacyRates.length} tax classes are outside SaaS template control`);
      }
      if (!pos[0]?.taxRegistrationNumber?.trim()) {
        errors.push(`${prefix}: tax registration number is missing`);
      }
    }
    console.log(`Checked ${templates.length} country templates and ${activeTenants.length} active tenants.`);
    return errors;
  });
}

try {
  const errors = await check();
  if (errors.length > 0) {
    for (const error of errors) console.error(`TAX READINESS: ${error}`);
    process.exitCode = 1;
  } else {
    console.log("Tax readiness passed.");
  }
} finally {
  await closeDbConnection();
}
