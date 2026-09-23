import { getDb, tenants } from "@cleanhub/db";
import { and, eq, isNull } from "drizzle-orm";
import type { Context } from "hono";
import { z } from "zod";

import type { AppBindings } from "../../../http/types.js";
import { writeAuditLog } from "../../audit/audit.helper.js";
import { requireSaasRole, requireSuperAdmin } from "../../auth/permission.helper.js";
import { taxRateFractionSchema } from "../../tax/tax.validation.js";
import {
  findPosChannelSettingsRecord,
  updatePosChannelSettingsRecord,
} from "../../tenant/pos-channel/pos-channel.repository.js";

const paramsSchema = z.object({ tenantId: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/) });
const updateSchema = z.object({
  taxEnabled: z.boolean(),
  defaultTaxRate: taxRateFractionSchema,
  pricesIncludeTax: z.boolean(),
  taxRegistrationNumber: z.string().trim().max(200).nullable(),
  version: z.number().int().min(0),
}).strict();

function toTaxSettings(record: Awaited<ReturnType<typeof findPosChannelSettingsRecord>>) {
  return {
    taxEnabled: record.taxEnabled,
    defaultTaxRate: record.defaultTaxRate,
    pricesIncludeTax: record.pricesIncludeTax,
    taxRegistrationNumber: record.taxRegistrationNumber,
    version: record.version,
  };
}

async function tenantExists(tenantId: string) {
  const [tenant] = await getDb().select({ id: tenants.id }).from(tenants)
    .where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt))).limit(1);
  return Boolean(tenant);
}

export async function getSaasTenantTaxSettingsController(c: Context<AppBindings>) {
  requireSaasRole(c.get("authContext"), ["super_admin", "support"]);
  const { tenantId } = paramsSchema.parse(c.req.param());
  if (!await tenantExists(tenantId)) {
    return c.json({ code: "SAAS_TENANT_NOT_FOUND", message: "Tenant not found." }, 404);
  }
  return c.json(toTaxSettings(await findPosChannelSettingsRecord(getDb(), tenantId)));
}

export async function updateSaasTenantTaxSettingsController(c: Context<AppBindings>) {
  requireSuperAdmin(c.get("authContext"));
  const { tenantId } = paramsSchema.parse(c.req.param());
  const input = updateSchema.parse(await c.req.json());
  const result = await getDb().transaction(async (tx) => {
    const [tenant] = await tx.select({ id: tenants.id }).from(tenants)
      .where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt))).limit(1);
    if (!tenant) return { status: 404 as const };

    const current = await findPosChannelSettingsRecord(tx, tenantId);
    const updated = await updatePosChannelSettingsRecord(tx, {
      tenantId,
      actorUserId: c.get("authContext").userId,
      data: input,
      current,
    });
    if (!updated) return { status: 409 as const };
    await writeAuditLog(tx, {
      actorUserId: c.get("authContext").userId,
      tenantId,
      eventCategory: "saas_tenant",
      eventType: "tenant_tax_settings.updated",
      entityType: "pos_channel_settings",
      entityId: updated.id ?? undefined,
      before: toTaxSettings(current),
      after: toTaxSettings(updated),
      ipAddress: c.req.header("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: c.req.header("user-agent"),
    });
    return { status: 200 as const, data: toTaxSettings(updated) };
  });
  if (result.status === 404) return c.json({ code: "SAAS_TENANT_NOT_FOUND", message: "Tenant not found." }, 404);
  if (result.status === 409) return c.json({ code: "VERSION_CONFLICT", message: "Tax settings changed. Refresh and retry." }, 409);
  return c.json(result.data);
}
