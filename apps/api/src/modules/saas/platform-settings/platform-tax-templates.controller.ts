import { getDb, platformTaxTemplates, posChannelSettings, type Database } from "@cleanhub/db";
import { createId } from "@cleanhub/id";
import { taxRateToScale } from "@cleanhub/domain/tax";
import { eq, sql } from "drizzle-orm";
import type { Context } from "hono";
import { z } from "zod";

import type { AppBindings } from "../../../http/types.js";
import { writeAuditLog } from "../../audit/audit.helper.js";
import { requireSaasRole, requireSuperAdmin } from "../../auth/permission.helper.js";
import { taxRateFractionSchema } from "../../tax/tax.validation.js";
import { templateTaxRateKey } from "../../tax/tax.template-key.js";
import { ApplyTaxTemplateError, syncTaxTemplateForTenant } from "../../tenant/tax-rates/tax-template.service.js";

const rateSchema = z.object({
  key: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(),
  name: z.string().trim().min(1).max(80),
  rate: taxRateFractionSchema,
  isDefault: z.boolean(),
  components: z.array(z.object({
    name: z.string().trim().min(1).max(80),
    rate: taxRateFractionSchema,
  }).strict()).min(1).max(10).optional(),
}).strict();

export const templateSchema = z.object({
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  name: z.string().trim().min(1).max(120),
  currencyCode: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  taxLabel: z.string().trim().min(1).max(80),
  exemptionNotes: z.string().trim().max(2000).nullable(),
  taxEnabled: z.boolean(),
  pricesIncludeTax: z.boolean(),
  rates: z.array(rateSchema).min(1).max(20),
}).strict().superRefine((template, ctx) => {
  if (template.rates.filter((rate) => rate.isDefault).length !== 1) {
    ctx.addIssue({ code: "custom", path: ["rates"], message: "Exactly one default rate is required." });
  }
  const names = template.rates.map((rate) => rate.name.toLocaleLowerCase());
  if (new Set(names).size !== names.length) {
    ctx.addIssue({ code: "custom", path: ["rates"], message: "Rate names must be unique." });
  }
  const keys = template.rates.flatMap((rate) => rate.key ? [rate.key] : []);
  if (new Set(keys).size !== keys.length) {
    ctx.addIssue({ code: "custom", path: ["rates"], message: "Tax class keys must be unique." });
  }
  template.rates.forEach((rate, index) => {
    if (rate.components && !rate.isDefault) {
      ctx.addIssue({ code: "custom", path: ["rates", index, "components"], message: "Components are supported only on the default rate." });
    }
    if (rate.components && rate.components.reduce((sum, component) => sum + taxRateToScale(component.rate), BigInt(0)) !== taxRateToScale(rate.rate)) {
      ctx.addIssue({ code: "custom", path: ["rates", index, "components"], message: "Component rates must add up to the total rate." });
    }
  });
});

const bulkTemplateSchema = z.array(templateSchema).min(1).max(50).superRefine((templates, ctx) => {
  const codes = templates.map((template) => template.countryCode);
  if (new Set(codes).size !== codes.length) {
    ctx.addIssue({ code: "custom", message: "Country codes must be unique within one import." });
  }
});

function toResponse(row: typeof platformTaxTemplates.$inferSelect) {
  return {
    id: row.id,
    countryCode: row.countryCode,
    name: row.name,
    currencyCode: row.currencyCode,
    taxLabel: row.taxLabel,
    exemptionNotes: row.exemptionNotes,
    taxEnabled: row.taxEnabled,
    pricesIncludeTax: row.pricesIncludeTax,
    rates: row.rates.map((rate, index) => ({ ...rate, key: templateTaxRateKey(rate, index) })),
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listPlatformTaxTemplatesController(c: Context<AppBindings>) {
  requireSaasRole(c.get("authContext"), ["super_admin", "support"]);
  const rows = await getDb().select().from(platformTaxTemplates)
    .orderBy(platformTaxTemplates.countryCode);
  return c.json({ data: rows.map(toResponse) });
}

async function saveTemplate(
  tx: Database,
  input: z.infer<typeof templateSchema>,
  c: Context<AppBindings>,
): Promise<typeof platformTaxTemplates.$inferSelect> {
  const [before] = await tx.select().from(platformTaxTemplates)
    .where(eq(platformTaxTemplates.countryCode, input.countryCode)).limit(1);
  const rates = input.rates.map((rate, index) => ({
    ...rate,
    key: rate.key ?? (before?.rates[index] ? templateTaxRateKey(before.rates[index], index) : createId()),
  }));
  const [updated] = await tx.insert(platformTaxTemplates).values({
    id: createId(),
    countryCode: input.countryCode,
    name: input.name,
    currencyCode: input.currencyCode,
    taxLabel: input.taxLabel,
    exemptionNotes: input.exemptionNotes,
    taxEnabled: input.taxEnabled,
    pricesIncludeTax: input.pricesIncludeTax,
    rates,
    updatedBy: c.get("authContext").userId,
  }).onConflictDoUpdate({
    target: platformTaxTemplates.countryCode,
    set: {
      name: input.name,
      currencyCode: input.currencyCode,
      taxLabel: input.taxLabel,
      exemptionNotes: input.exemptionNotes,
      taxEnabled: input.taxEnabled,
      pricesIncludeTax: input.pricesIncludeTax,
      rates,
      updatedAt: new Date(),
      updatedBy: c.get("authContext").userId,
      version: sql`${platformTaxTemplates.version} + 1`,
    },
  }).returning();
  const appliedTenants = await tx.select({ tenantId: posChannelSettings.tenantId })
    .from(posChannelSettings)
    .where(eq(posChannelSettings.taxTemplateCountryCode, updated.countryCode));
  for (const applied of appliedTenants) {
    try {
      await syncTaxTemplateForTenant(tx, {
        tenantId: applied.tenantId,
        actorUserId: c.get("authContext").userId,
        template: updated,
      });
    } catch (error) {
      if (error instanceof ApplyTaxTemplateError) {
        throw new ApplyTaxTemplateError(
          error.code,
          `${updated.countryCode} / tenant ${applied.tenantId}: ${error.message}`,
          error.status,
        );
      }
      throw error;
    }
  }
  await writeAuditLog(tx, {
    actorUserId: c.get("authContext").userId,
    tenantId: null,
    eventCategory: "saas_platform",
    eventType: "platform_tax_template.updated",
    entityType: "platform_tax_template",
    entityId: updated.id,
    before: before ? toResponse(before) : null,
    after: toResponse(updated),
    ipAddress: c.req.header("x-forwarded-for")?.split(",")[0]?.trim(),
    userAgent: c.req.header("user-agent"),
  });
  return updated;
}

function templateWriteError(c: Context<AppBindings>, error: unknown) {
  if (error instanceof ApplyTaxTemplateError) {
    return c.json({ code: error.code, message: error.message, requestId: c.get("requestId") }, 409);
  }
  throw error;
}

export async function upsertPlatformTaxTemplateController(c: Context<AppBindings>) {
  requireSuperAdmin(c.get("authContext"));
  const input = templateSchema.parse(await c.req.json());
  try {
    const result = await getDb().transaction((tx) => saveTemplate(tx, input, c));
    return c.json(toResponse(result));
  } catch (error) {
    return templateWriteError(c, error);
  }
}

export async function bulkUpsertPlatformTaxTemplatesController(c: Context<AppBindings>) {
  requireSuperAdmin(c.get("authContext"));
  const inputs = bulkTemplateSchema.parse(await c.req.json());
  try {
    const results = await getDb().transaction(async (tx) => {
      const saved = [];
      for (const input of inputs) saved.push(await saveTemplate(tx, input, c));
      return saved;
    });
    return c.json({ data: results.map(toResponse) });
  } catch (error) {
    return templateWriteError(c, error);
  }
}
