import { and, eq, isNull } from "drizzle-orm";
import {
  branches,
  posChannelSettings,
  tenantSettings,
  tenants,
  type Database,
} from "@cleanhub/db";

import { findPlatformTaxTemplateForCountry } from "./platform-tax-template.repository.js";
import { isReadyTaxTemplate } from "./tax-template-readiness.js";

export type PosTaxReadinessCode =
  | "POS_TAX_COUNTRY_REQUIRED"
  | "POS_TAX_TEMPLATE_REQUIRED"
  | "POS_TAX_TEMPLATE_NOT_APPLIED"
  | "POS_TAX_CONFIGURATION_INCOMPLETE"
  | "POS_TAX_CURRENCY_MISMATCH";

export type PosTaxReadinessChecks = {
  countrySet: boolean;
  templateAvailable: boolean;
  templateApplied: boolean;
  taxEnabled: boolean;
  taxRegistrationNumberSet: boolean;
  taxLabelSet: boolean;
  currencyMatches: boolean;
};

export type PosTaxReadiness = {
  checks: PosTaxReadinessChecks;
  issues: Array<{ code: PosTaxReadinessCode; message: string }>;
} & (
  | { ready: true; code: null; message: null }
  | { ready: false; code: PosTaxReadinessCode; message: string }
);

/** These facts also drive onboarding, so its green checks cannot contradict checkout. */
export function evaluatePosTaxReadiness(checks: PosTaxReadinessChecks): PosTaxReadiness {
  const issues: PosTaxReadiness["issues"] = [];
  if (!checks.countrySet) {
    issues.push({ code: "POS_TAX_COUNTRY_REQUIRED", message: "The tenant's country is missing. Ask a SaaS administrator to set the country before taking a sale." });
  } else if (!checks.templateAvailable) {
    issues.push({ code: "POS_TAX_TEMPLATE_REQUIRED", message: "The country tax template is unavailable or incomplete. Ask a SaaS administrator to complete its form or import the tax template file, then ask the owner to apply it." });
  } else if (!checks.templateApplied) {
    issues.push({ code: "POS_TAX_TEMPLATE_NOT_APPLIED", message: "The current country tax template has not been applied. Ask the owner or manager to select and apply it in tenant settings, then sync the terminal." });
  }
  if (!checks.taxEnabled || !checks.taxRegistrationNumberSet || !checks.taxLabelSet) {
    issues.push({ code: "POS_TAX_CONFIGURATION_INCOMPLETE", message: "Tax configuration is incomplete. Ask the owner or manager to enable tax and enter the tax registration number in POS settings." });
  }
  if (checks.templateAvailable && !checks.currencyMatches) {
    issues.push({ code: "POS_TAX_CURRENCY_MISMATCH", message: "The tenant or current store currency does not match the country tax template. Ask an administrator to correct the currency before checkout." });
  }
  return issues[0]
    ? { ready: false, ...issues[0], checks, issues }
    : { ready: true, code: null, message: null, checks, issues };
}

export async function loadPosTaxReadinessContext(db: Database, tenantId: string) {
  const [[tenant], [channel], [settings]] = await Promise.all([
    db.select({ country: tenants.country }).from(tenants)
      .where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt))).limit(1),
    db.select({
      country: posChannelSettings.taxTemplateCountryCode,
      version: posChannelSettings.taxTemplateVersion,
      enabled: posChannelSettings.taxEnabled,
      registration: posChannelSettings.taxRegistrationNumber,
      label: posChannelSettings.taxLabel,
    }).from(posChannelSettings).where(eq(posChannelSettings.tenantId, tenantId)).limit(1),
    db.select({ currency: tenantSettings.defaultCurrency }).from(tenantSettings)
      .where(eq(tenantSettings.tenantId, tenantId)).limit(1),
  ]);
  const template = tenant?.country?.trim()
    ? await findPlatformTaxTemplateForCountry(db, tenant.country) : null;
  return {
    templateCurrency: template?.currencyCode ?? null,
    checks: {
      countrySet: Boolean(tenant?.country?.trim()),
      templateAvailable: Boolean(template && isReadyTaxTemplate(template) && template.taxEnabled),
      templateApplied: Boolean(template && isReadyTaxTemplate(template) && template.taxEnabled && channel?.country === template.countryCode && channel.version === template.version),
      taxEnabled: channel?.enabled ?? false,
      taxRegistrationNumberSet: Boolean(channel?.registration?.trim()),
      taxLabelSet: Boolean(channel?.label?.trim()),
      currencyMatches: Boolean(template?.currencyCode && settings?.currency === template.currencyCode),
    },
  };
}

/** Currency is checked for this terminal's branch, never an unrelated branch. */
export async function resolvePosTaxReadiness(db: Database, tenantId: string, branchId?: string): Promise<PosTaxReadiness> {
  const context = await loadPosTaxReadinessContext(db, tenantId);
  if (branchId) {
    const [branch] = await db.select({ currency: branches.defaultCurrency }).from(branches).where(and(
      eq(branches.tenantId, tenantId), eq(branches.id, branchId),
      eq(branches.status, "active"), isNull(branches.deletedAt),
    )).limit(1);
    context.checks.currencyMatches &&= Boolean(branch && branch.currency === context.templateCurrency);
  }
  return evaluatePosTaxReadiness(context.checks);
}
