import { and, eq, isNull } from "drizzle-orm";
import {
  branches,
  posChannelSettings,
  tenantSettings,
  tenants,
  type Database,
} from "@cleanhub/db";

import { findPlatformTaxTemplateForCountry } from "../saas/tenants/tenants.repository.js";
import { isReadyTaxTemplate } from "./tax-template-readiness.js";

export type PosTaxReadinessCode =
  | "POS_TAX_COUNTRY_REQUIRED"
  | "POS_TAX_TEMPLATE_REQUIRED"
  | "POS_TAX_TEMPLATE_NOT_APPLIED"
  | "POS_TAX_CONFIGURATION_INCOMPLETE"
  | "POS_TAX_CURRENCY_MISMATCH";

export type PosTaxReadiness =
  | { ready: true; code: null; message: null }
  | { ready: false; code: PosTaxReadinessCode; message: string };

const ready: PosTaxReadiness = { ready: true, code: null, message: null };

function missing(code: PosTaxReadinessCode, message: string): PosTaxReadiness {
  return { ready: false, code, message };
}

/** A terminal must never turn a missing country template into an untaxed sale. */
export async function resolvePosTaxReadiness(
  db: Database,
  tenantId: string,
  branchId?: string,
): Promise<PosTaxReadiness> {
  const [tenant] = await db.select({ country: tenants.country }).from(tenants)
    .where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt))).limit(1);
  if (!tenant?.country?.trim()) {
    return missing("POS_TAX_COUNTRY_REQUIRED", "The tenant's country is missing. Ask a SaaS administrator to set the country before taking a sale.");
  }

  const template = await findPlatformTaxTemplateForCountry(db, tenant.country);
  if (!template || !isReadyTaxTemplate(template) || !template.taxEnabled) {
    return missing("POS_TAX_TEMPLATE_REQUIRED", "The country tax template is unavailable or incomplete. Ask a SaaS administrator to complete its form or import the tax template file, then ask the owner to apply it.");
  }

  const [[channel], [settings], branchRows] = await Promise.all([
    db.select({
      country: posChannelSettings.taxTemplateCountryCode,
      version: posChannelSettings.taxTemplateVersion,
      enabled: posChannelSettings.taxEnabled,
      registration: posChannelSettings.taxRegistrationNumber,
      label: posChannelSettings.taxLabel,
    }).from(posChannelSettings).where(eq(posChannelSettings.tenantId, tenantId)).limit(1),
    db.select({ currency: tenantSettings.defaultCurrency }).from(tenantSettings)
      .where(eq(tenantSettings.tenantId, tenantId)).limit(1),
    db.select({ currency: branches.defaultCurrency }).from(branches).where(and(
      eq(branches.tenantId, tenantId),
      isNull(branches.deletedAt),
      ...(branchId ? [eq(branches.id, branchId)] : []),
    )),
  ]);
  if (channel?.country !== template.countryCode || channel.version !== template.version) {
    return missing("POS_TAX_TEMPLATE_NOT_APPLIED", "The current country tax template has not been applied. Ask the owner or manager to select and apply it in tenant settings, then sync the terminal.");
  }
  if (!channel.enabled || !channel.registration?.trim() || !channel.label?.trim()) {
    return missing("POS_TAX_CONFIGURATION_INCOMPLETE", "Tax configuration is incomplete. Ask the owner or manager to enable tax and enter the tax registration number in POS settings.");
  }
  if (settings?.currency !== template.currencyCode ||
      branchRows.length === 0 ||
      branchRows.some((branch) => branch.currency !== template.currencyCode)) {
    return missing("POS_TAX_CURRENCY_MISMATCH", "The tenant or store currency does not match the country tax template. Ask an administrator to correct the currency before checkout.");
  }
  return ready;
}
