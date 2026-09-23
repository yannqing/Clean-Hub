import { getDb, type Database } from "@cleanhub/db";

import { writeAuditLog } from "../../audit/audit.helper.js";
import type { AuthContext } from "../../auth/auth.types.js";
import {
  assertActiveTenant,
  assertTenantContext,
  requireTenantRole,
} from "../../auth/permission.helper.js";
import { TenantTaxRateError } from "./tax-rates.errors.js";
import {
  findTenantTaxRateById,
  findTenantTaxRates,
  insertTenantTaxRate,
  isTaxRateNameUniqueViolation,
  softDeleteTenantTaxRate,
  updateTenantTaxRateRecord,
} from "./tax-rates.repository.js";
import type {
  CreateTenantTaxRateRequest,
  TenantTaxRate,
  TenantTaxRateListQuery,
  TenantTaxRateRequestInput,
  UpdateTenantTaxRateRequest,
} from "./tax-rates.types.js";

function nameConflict(): TenantTaxRateError {
  return new TenantTaxRateError(
    "TAX_RATE_NAME_CONFLICT",
    "A tax rate with this name already exists.",
    409,
  );
}

function notFound(): TenantTaxRateError {
  return new TenantTaxRateError(
    "TAX_RATE_NOT_FOUND",
    "Tax rate was not found.",
    404,
  );
}

export async function listTenantTaxRates(
  authContext: AuthContext,
  query: TenantTaxRateListQuery,
  db: Database = getDb(),
): Promise<TenantTaxRate[]> {
  assertTenantContext(authContext);
  // Managers read the list so they can see which rate a service carries; only
  // the owner changes rates, as with the default rate in POS settings.
  requireTenantRole(authContext, ["owner", "manager"]);
  await assertActiveTenant(authContext, db);
  return findTenantTaxRates(db, {
    tenantId: authContext.tenantId!,
    includeArchived: query.includeArchived,
  });
}

export async function createTenantTaxRate(
  input: TenantTaxRateRequestInput<CreateTenantTaxRateRequest>,
  db: Database = getDb(),
): Promise<TenantTaxRate> {
  assertTenantContext(input.authContext);
  requireTenantRole(input.authContext, ["owner"]);
  await assertActiveTenant(input.authContext, db);
  const tenantId = input.authContext.tenantId!;

  try {
    return await db.transaction(async (tx) => {
      const created = await insertTenantTaxRate(tx, {
        tenantId,
        actorUserId: input.authContext.userId,
        data: input.data,
      });
      await writeAuditLog(tx, {
        actorUserId: input.authContext.userId,
        tenantId,
        eventCategory: "tax",
        eventType: "tax_rate.created",
        entityType: "tax_rate",
        entityId: created.id,
        after: { name: created.name, rate: created.rate },
        ipAddress: input.requestMeta?.ipAddress,
        userAgent: input.requestMeta?.userAgent,
      });
      return created;
    });
  } catch (error) {
    if (isTaxRateNameUniqueViolation(error)) throw nameConflict();
    throw error;
  }
}

export async function updateTenantTaxRate(
  input: TenantTaxRateRequestInput<UpdateTenantTaxRateRequest> & {
    taxRateId: string;
  },
  db: Database = getDb(),
): Promise<TenantTaxRate> {
  assertTenantContext(input.authContext);
  requireTenantRole(input.authContext, ["owner"]);
  await assertActiveTenant(input.authContext, db);
  const tenantId = input.authContext.tenantId!;

  try {
    return await db.transaction(async (tx) => {
      const before = await findTenantTaxRateById(tx, {
        tenantId,
        taxRateId: input.taxRateId,
      });
      if (!before) throw notFound();

      const updated = await updateTenantTaxRateRecord(tx, {
        tenantId,
        taxRateId: input.taxRateId,
        actorUserId: input.authContext.userId,
        data: input.data,
      });
      if (!updated) {
        throw new TenantTaxRateError(
          "TAX_RATE_VERSION_CONFLICT",
          "Tax rate was modified by another request. Refresh and try again.",
          409,
        );
      }

      // A changed rate reprices every future sale of the services and
      // products that carry it; orders already placed keep their snapshot.
      await writeAuditLog(tx, {
        actorUserId: input.authContext.userId,
        tenantId,
        eventCategory: "tax",
        eventType: "tax_rate.updated",
        entityType: "tax_rate",
        entityId: updated.id,
        before: { name: before.name, rate: before.rate, archived: before.archived },
        after: { name: updated.name, rate: updated.rate, archived: updated.archived },
        ipAddress: input.requestMeta?.ipAddress,
        userAgent: input.requestMeta?.userAgent,
      });
      return updated;
    });
  } catch (error) {
    if (isTaxRateNameUniqueViolation(error)) throw nameConflict();
    throw error;
  }
}

export async function deleteTenantTaxRate(
  input: TenantTaxRateRequestInput<null> & { taxRateId: string },
  db: Database = getDb(),
): Promise<void> {
  assertTenantContext(input.authContext);
  requireTenantRole(input.authContext, ["owner"]);
  await assertActiveTenant(input.authContext, db);
  const tenantId = input.authContext.tenantId!;

  await db.transaction(async (tx) => {
    const current = await findTenantTaxRateById(tx, {
      tenantId,
      taxRateId: input.taxRateId,
    });
    if (!current) throw notFound();

    // Deleting a rate that services still carry would silently move them to
    // the default rate. Archive instead: the items keep their rate, and the
    // rate simply stops being offered for new assignments.
    if (current.serviceCount > 0 || current.productCount > 0) {
      throw new TenantTaxRateError(
        "TAX_RATE_IN_USE",
        "This tax rate is still assigned to services or products. Reassign them or archive the rate instead.",
        409,
      );
    }

    await softDeleteTenantTaxRate(tx, {
      tenantId,
      taxRateId: input.taxRateId,
      actorUserId: input.authContext.userId,
    });
    await writeAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId,
      eventCategory: "tax",
      eventType: "tax_rate.deleted",
      entityType: "tax_rate",
      entityId: current.id,
      before: { name: current.name, rate: current.rate },
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });
  });
}
