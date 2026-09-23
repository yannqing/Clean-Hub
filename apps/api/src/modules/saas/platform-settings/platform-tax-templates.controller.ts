import { getDb, platformTaxTemplates } from "@cleanhub/db";
import { createId } from "@cleanhub/id";
import { eq, sql } from "drizzle-orm";
import type { Context } from "hono";
import { z } from "zod";

import type { AppBindings } from "../../../http/types.js";
import { writeAuditLog } from "../../audit/audit.helper.js";
import { requireSaasRole, requireSuperAdmin } from "../../auth/permission.helper.js";
import { taxRateFractionSchema } from "../../tax/tax.validation.js";

const rateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  rate: taxRateFractionSchema,
  isDefault: z.boolean(),
}).strict();

const templateSchema = z.object({
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  name: z.string().trim().min(1).max(120),
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
});

function toResponse(row: typeof platformTaxTemplates.$inferSelect) {
  return {
    id: row.id,
    countryCode: row.countryCode,
    name: row.name,
    taxEnabled: row.taxEnabled,
    pricesIncludeTax: row.pricesIncludeTax,
    rates: row.rates,
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

export async function upsertPlatformTaxTemplateController(c: Context<AppBindings>) {
  requireSuperAdmin(c.get("authContext"));
  const input = templateSchema.parse(await c.req.json());
  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const [before] = await tx.select().from(platformTaxTemplates)
      .where(eq(platformTaxTemplates.countryCode, input.countryCode)).limit(1);
    const [updated] = await tx.insert(platformTaxTemplates).values({
      id: createId(),
      ...input,
      updatedBy: c.get("authContext").userId,
    }).onConflictDoUpdate({
      target: platformTaxTemplates.countryCode,
      set: {
        name: input.name,
        taxEnabled: input.taxEnabled,
        pricesIncludeTax: input.pricesIncludeTax,
        rates: input.rates,
        updatedAt: new Date(),
        updatedBy: c.get("authContext").userId,
        version: sql`${platformTaxTemplates.version} + 1`,
      },
    }).returning();
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
  });
  return c.json(toResponse(result));
}
