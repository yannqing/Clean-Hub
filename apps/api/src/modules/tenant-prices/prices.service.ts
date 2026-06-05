import { getDb, type Database } from "@cleanhub/db";

import {
  assertActiveTenant,
  assertTenantContext,
  requireFeatureEnabled,
} from "../auth/permission.helper.js";
import type { AuthContext, AuthRequestMeta } from "../auth/auth.types.js";
import { writeAuditLog } from "../audit/audit.helper.js";
import { TenantPricesError } from "./prices.errors.js";
import {
  findPriceAuditSnapshotById,
  findPriceById,
  findPrices,
  updatePriceRecord,
} from "./prices.repository.js";
import type {
  PriceListInput,
  PriceSummary,
  UpdatePriceRequest,
} from "./prices.types.js";

function requireTenantContext(authContext: AuthContext): string {
  assertTenantContext(authContext);

  return authContext.tenantId!;
}

async function requireTenantReadyForPrices(
  authContext: AuthContext,
  db: Database,
  businessLine?: PriceListInput["businessLine"],
): Promise<void> {
  await assertActiveTenant(authContext, db);

  if (businessLine) {
    await requireFeatureEnabled(authContext, businessLine, db);
  }
}

export async function listTenantPrices(
  authContext: AuthContext,
  input: PriceListInput,
  db: Database = getDb(),
): Promise<PriceSummary[]> {
  const tenantId = requireTenantContext(authContext);

  await requireTenantReadyForPrices(authContext, db, input.businessLine);

  return findPrices(db, {
    ...input,
    tenantId,
  });
}

export async function updateTenantPrice(
  authContext: AuthContext,
  priceId: string,
  data: UpdatePriceRequest,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<PriceSummary> {
  const tenantId = requireTenantContext(authContext);

  await requireTenantReadyForPrices(authContext, db);

  return db.transaction(async (tx) => {
    const before = await findPriceAuditSnapshotById(tx, {
      tenantId,
      priceId,
    });

    if (!before) {
      throw new TenantPricesError(
        "PRICE_NOT_FOUND",
        "Price was not found.",
        404,
      );
    }

    await requireTenantReadyForPrices(authContext, tx, before.businessLine);

    const price = await updatePriceRecord(tx, {
      ...data,
      tenantId,
      priceId,
      actorUserId: authContext.userId,
    });

    if (!price) {
      throw new TenantPricesError(
        "PRICE_NOT_FOUND",
        "Price was not found.",
        404,
      );
    }

    await writeAuditLog(tx, {
      actorUserId: authContext.userId,
      tenantId,
      eventCategory: "tenant_price",
      eventType: "price.updated",
      entityType: "price",
      entityId: priceId,
      before,
      after: price,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });

    return price;
  });
}

export async function getTenantPriceDetail(
  authContext: AuthContext,
  priceId: string,
  db: Database = getDb(),
): Promise<PriceSummary> {
  const tenantId = requireTenantContext(authContext);

  await requireTenantReadyForPrices(authContext, db);

  const price = await findPriceById(db, {
    tenantId,
    priceId,
  });

  if (!price) {
    throw new TenantPricesError(
      "PRICE_NOT_FOUND",
      "Price was not found.",
      404,
    );
  }

  await requireTenantReadyForPrices(authContext, db, price.businessLine);

  return price;
}
