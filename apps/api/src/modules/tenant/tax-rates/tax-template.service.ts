import {
  getDb,
  branches,
  platformTaxTemplates,
  posChannelSettings,
  products,
  runWithSystemDatabaseContext,
  services,
  taxRates,
  tenantSettings,
  type Database,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { writeAuditLog } from "../../audit/audit.helper.js";
import { templateTaxRateKey } from "../../tax/tax.template-key.js";
import { isReadyTaxTemplate } from "../../tax/tax-template-readiness.js";
import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";
import {
  assertActiveTenant,
  assertTenantContext,
  requireTenantRole,
} from "../../auth/permission.helper.js";
import {
  findPosChannelSettingsRecord,
  updatePosChannelSettingsRecord,
} from "../pos-channel/pos-channel.repository.js";

type TaxTemplate = typeof platformTaxTemplates.$inferSelect;

function toTemplate(row: TaxTemplate) {
  return {
    id: row.id,
    countryCode: row.countryCode,
    name: row.name,
    currencyCode: row.currencyCode,
    taxLabel: row.taxLabel,
    exemptionNotes: row.exemptionNotes,
    taxEnabled: row.taxEnabled,
    pricesIncludeTax: row.pricesIncludeTax,
    rates: row.rates,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function readPlatformTemplates(): Promise<TaxTemplate[]> {
  return runWithSystemDatabaseContext(() =>
    getDb().select().from(platformTaxTemplates).orderBy(platformTaxTemplates.countryCode),
  );
}

export async function listAvailableTaxTemplates(
  authContext: AuthContext,
  db: Database = getDb(),
) {
  assertTenantContext(authContext);
  requireTenantRole(authContext, ["owner", "manager"]);
  await assertActiveTenant(authContext, db);
  return (await readPlatformTemplates()).filter(isReadyTaxTemplate).map(toTemplate);
}

export class ApplyTaxTemplateError extends Error {
  constructor(
    readonly code: "TAX_TEMPLATE_NOT_FOUND" | "TAX_TEMPLATE_VERSION_CONFLICT" | "TAX_SETTINGS_VERSION_CONFLICT" | "TAX_TEMPLATE_CURRENCY_MISMATCH" | "TAX_TEMPLATE_RATE_IN_USE" | "TAX_TEMPLATE_RATE_NAME_CONFLICT" | "TAX_TEMPLATE_UNMANAGED_RATE",
    message: string,
    readonly status: 404 | 409,
  ) {
    super(message);
    this.name = "ApplyTaxTemplateError";
  }
}

/** Apply one configured version to a tenant inside the caller's transaction. */
export async function syncTaxTemplateForTenant(
  tx: Database,
  input: {
    tenantId: string;
    actorUserId: string;
    template: TaxTemplate;
    expectedSettingsVersion?: number;
  },
) {
  const { tenantId, actorUserId, template } = input;
  if (!isReadyTaxTemplate(template)) {
    throw new ApplyTaxTemplateError("TAX_TEMPLATE_NOT_FOUND", "Country tax template is incomplete.", 404);
  }
  const [tenantCurrency] = await tx.select({ currency: tenantSettings.defaultCurrency })
    .from(tenantSettings).where(eq(tenantSettings.tenantId, tenantId)).limit(1);
  const branchCurrencies = await tx.select({ currency: branches.defaultCurrency })
    .from(branches).where(and(eq(branches.tenantId, tenantId), isNull(branches.deletedAt)));
  if (tenantCurrency?.currency !== template.currencyCode ||
      branchCurrencies.some((branch) => branch.currency !== template.currencyCode)) {
    throw new ApplyTaxTemplateError(
      "TAX_TEMPLATE_CURRENCY_MISMATCH",
      "The tenant and all branches must use the template currency before applying it.",
      409,
    );
  }

  const desiredKeys = new Set(template.rates.map(templateTaxRateKey));
  const previous = await tx.select().from(taxRates).where(and(
    eq(taxRates.tenantId, tenantId), isNotNull(taxRates.templateRateKey), isNull(taxRates.deletedAt),
  ));
  const manual = await tx.select().from(taxRates).where(and(
    eq(taxRates.tenantId, tenantId), isNull(taxRates.templateRateKey), isNull(taxRates.deletedAt),
  ));
  const adopted = new Map<string, typeof manual[number]>();
  const adoptedIds = new Set<string>();
  for (const [index, desired] of template.rates.entries()) {
    const key = templateTaxRateKey(desired, index);
    if (previous.some((rate) => rate.templateRateKey === key)) continue;
    const available = manual.filter((rate) => !adoptedIds.has(rate.id));
    const sameName = available.filter((rate) => rate.name.toLowerCase() === desired.name.toLowerCase());
    const sameRate = available.filter((rate) => Number(rate.rate) === Number(desired.rate));
    const matches = sameName.length > 0 ? sameName : sameRate;
    if (matches.length > 1) {
      throw new ApplyTaxTemplateError(
        "TAX_TEMPLATE_UNMANAGED_RATE",
        `Several existing tax classes match "${desired.name}". Resolve the duplicate classes before applying this template.`,
        409,
      );
    }
    if (matches[0]) {
      adopted.set(key, matches[0]);
      adoptedIds.add(matches[0].id);
    }
  }
  const unmatched = manual.find((rate) => !adoptedIds.has(rate.id));
  if (unmatched) {
    throw new ApplyTaxTemplateError(
      "TAX_TEMPLATE_UNMANAGED_RATE",
      `Existing tax class "${unmatched.name}" is not in the country template. Reassign and remove it before applying the template.`,
      409,
    );
  }
  const obsolete = previous.filter((rate) => !desiredKeys.has(rate.templateRateKey!));
  for (const rate of obsolete) {
    const [service] = await tx.select({ id: services.id }).from(services).where(and(
      eq(services.tenantId, tenantId), eq(services.taxRateId, rate.id), isNull(services.deletedAt),
    )).limit(1);
    const [product] = await tx.select({ id: products.id }).from(products).where(and(
      eq(products.tenantId, tenantId), eq(products.taxRateId, rate.id), isNull(products.deletedAt),
    )).limit(1);
    if (service || product) {
      throw new ApplyTaxTemplateError(
        "TAX_TEMPLATE_RATE_IN_USE",
        `Tax class "${rate.name}" is still assigned to a service or product. Reassign those items before changing the country template.`,
        409,
      );
    }
  }

  const current = await findPosChannelSettingsRecord(tx, tenantId);
  if (input.expectedSettingsVersion !== undefined && current.version !== input.expectedSettingsVersion) {
    throw new ApplyTaxTemplateError("TAX_SETTINGS_VERSION_CONFLICT", "Tenant tax settings changed. Refresh and retry.", 409);
  }
  const defaultRate = template.rates.find((rate) => rate.isDefault)!;
  const updated = await updatePosChannelSettingsRecord(tx, {
    tenantId,
    actorUserId,
    current,
    data: {
      version: current.version,
      taxEnabled: template.taxEnabled,
      defaultTaxRate: defaultRate.rate,
      pricesIncludeTax: template.pricesIncludeTax,
    },
  });
  if (!updated) {
    throw new ApplyTaxTemplateError("TAX_SETTINGS_VERSION_CONFLICT", "Tenant tax settings changed. Refresh and retry.", 409);
  }
  await tx.update(posChannelSettings).set({
    taxLabel: template.taxLabel,
    defaultTaxComponents: defaultRate.components ?? null,
    taxTemplateCountryCode: template.countryCode,
    taxTemplateVersion: template.version,
  }).where(eq(posChannelSettings.tenantId, tenantId));

  for (const rate of obsolete) {
    await tx.update(taxRates).set({
      deletedAt: new Date(), deletedBy: actorUserId, updatedAt: new Date(),
      updatedBy: actorUserId, version: sql`${taxRates.version} + 1`,
    }).where(and(eq(taxRates.tenantId, tenantId), eq(taxRates.id, rate.id)));
  }
  // Move renamed template classes out of the way first. Otherwise swapping
  // two class names fails the active-name unique index halfway through an
  // otherwise valid SaaS edit.
  for (const [index, rate] of template.rates.entries()) {
    const key = templateTaxRateKey(rate, index);
    const existing = previous.find((entry) => entry.templateRateKey === key);
    if (existing && existing.name.toLowerCase() !== rate.name.toLowerCase()) {
      await tx.update(taxRates).set({ name: `__template_${createId()}` })
        .where(and(eq(taxRates.tenantId, tenantId), eq(taxRates.id, existing.id)));
    }
    const legacy = adopted.get(key);
    if (legacy) {
      await tx.update(taxRates).set({
        name: `__template_${createId()}`,
        templateRateKey: key,
      }).where(and(eq(taxRates.tenantId, tenantId), eq(taxRates.id, legacy.id)));
    }
  }
  for (const [index, rate] of template.rates.entries()) {
    const key = templateTaxRateKey(rate, index);
    const [existingByKey] = await tx.select({ id: taxRates.id }).from(taxRates)
      .where(and(eq(taxRates.tenantId, tenantId), eq(taxRates.templateRateKey, key), isNull(taxRates.deletedAt))).limit(1);
    const [existingByName] = existingByKey ? [] : await tx.select({ id: taxRates.id }).from(taxRates)
      .where(and(eq(taxRates.tenantId, tenantId), sql`lower(${taxRates.name}) = lower(${rate.name})`, isNull(taxRates.deletedAt))).limit(1);
    if (existingByName) {
      throw new ApplyTaxTemplateError(
        "TAX_TEMPLATE_RATE_NAME_CONFLICT",
        `A tenant tax class named "${rate.name}" already exists. Rename it before applying this template.`,
        409,
      );
    }
    if (existingByKey) {
      await tx.update(taxRates).set({
        name: rate.name, rate: rate.rate, templateRateKey: key, displayOrder: index,
        archivedAt: null, updatedAt: new Date(), updatedBy: actorUserId,
        version: sql`${taxRates.version} + 1`,
      }).where(and(eq(taxRates.tenantId, tenantId), eq(taxRates.id, existingByKey.id)));
    } else {
      await tx.insert(taxRates).values({
        id: createId(), tenantId, name: rate.name, rate: rate.rate,
        templateRateKey: key, displayOrder: index, createdBy: actorUserId,
        updatedBy: actorUserId,
      });
    }
  }
  return { current, updated };
}

export async function applyTenantTaxTemplate(input: {
  authContext: AuthContext;
  countryCode: string;
  templateVersion: number;
  settingsVersion: number;
  requestMeta?: AuthRequestMeta;
}, db: Database = getDb()) {
  assertTenantContext(input.authContext);
  requireTenantRole(input.authContext, ["owner"]);
  await assertActiveTenant(input.authContext, db);
  const tenantId = input.authContext.tenantId!;
  return db.transaction(async (tx) => {
    // Lock the source row until tenant settings and tax classes are committed.
    // A simultaneous SaaS edit then sees the newly applied tenant and syncs it,
    // rather than racing with a stale copy loaded before the transaction.
    const [template] = await tx.select().from(platformTaxTemplates)
      .where(eq(platformTaxTemplates.countryCode, input.countryCode))
      .limit(1).for("share");
    if (!template || !isReadyTaxTemplate(template)) {
      throw new ApplyTaxTemplateError("TAX_TEMPLATE_NOT_FOUND", "Country tax template was not found.", 404);
    }
    if (template.version !== input.templateVersion) {
      throw new ApplyTaxTemplateError("TAX_TEMPLATE_VERSION_CONFLICT", "Country tax template changed. Refresh and retry.", 409);
    }
    const { current, updated } = await syncTaxTemplateForTenant(tx, {
      tenantId,
      actorUserId: input.authContext.userId,
      template,
      expectedSettingsVersion: input.settingsVersion,
    });
    await writeAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId,
      eventCategory: "tax",
      eventType: "tax_template.applied",
      entityType: "platform_tax_template",
      entityId: template.id,
      before: {
        taxEnabled: current.taxEnabled,
        defaultTaxRate: current.defaultTaxRate,
        pricesIncludeTax: current.pricesIncludeTax,
      },
      after: {
        countryCode: template.countryCode,
        templateVersion: template.version,
        taxEnabled: updated.taxEnabled,
        defaultTaxRate: updated.defaultTaxRate,
        pricesIncludeTax: updated.pricesIncludeTax,
        taxLabel: template.taxLabel,
      },
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });
    return {
      template: toTemplate(template),
      settingsVersion: updated.version,
      defaultTaxRate: updated.defaultTaxRate,
    };
  });
}
