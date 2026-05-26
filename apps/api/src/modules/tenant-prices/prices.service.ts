import { getDb, type Database } from "@cleanhub/db";

import { AuthError } from "../auth/auth.errors.js";
import type { AuthContext, AuthRequestMeta } from "../auth/auth.types.js";
import { writeAuditLog } from "../audit/audit.helper.js";
import { TenantPricesError } from "./prices.errors.js";
import {
  createPriceBookRecord,
  findPriceBookAuditSnapshotById,
  findPriceBookByName,
  findPriceBooks,
  findTenantAccessById,
  softDeletePriceBookRecord,
  updatePriceBookRecord,
} from "./prices.repository.js";
import type {
  CreatePriceBookRequest,
  PriceBookListInput,
  PriceBookSummary,
  PriceBusinessLine,
  UpdatePriceBookRequest,
} from "./prices.types.js";

function requireTenantContext(authContext: AuthContext): string {
  if (!authContext.tenantId) {
    throw new TenantPricesError(
      "TENANT_CONTEXT_REQUIRED",
      "Tenant context is required for price book APIs.",
      403,
    );
  }

  if (authContext.role !== "owner" && authContext.role !== "manager") {
    throw new AuthError("FORBIDDEN", "User cannot access tenant prices.");
  }

  return authContext.tenantId;
}

function isBusinessLineEnabled(
  businessLine: PriceBusinessLine,
  flags: {
    laundryEnabled: boolean | null;
    carWashEnabled: boolean | null;
    retailProductsEnabled: boolean | null;
  },
): boolean {
  if (
    businessLine === "laundry" ||
    businessLine === "dry_cleaning" ||
    businessLine === "pressing"
  ) {
    return flags.laundryEnabled ?? true;
  }

  if (businessLine === "car_wash") {
    return flags.carWashEnabled ?? false;
  }

  return flags.retailProductsEnabled ?? false;
}

async function requireTenantReadyForPrices(
  db: Database,
  tenantId: string,
  businessLine?: PriceBusinessLine,
): Promise<void> {
  const tenant = await findTenantAccessById(db, tenantId);

  if (!tenant || tenant.status !== "active") {
    throw new TenantPricesError(
      "TENANT_NOT_ACTIVE",
      "Tenant is not active.",
      403,
    );
  }

  if (businessLine && !isBusinessLineEnabled(businessLine, tenant)) {
    throw new TenantPricesError(
      "FEATURE_DISABLED",
      "This business line is not enabled for the tenant.",
      403,
    );
  }
}

export async function listTenantPriceBooks(
  authContext: AuthContext,
  input: PriceBookListInput,
  db: Database = getDb(),
): Promise<PriceBookSummary[]> {
  const tenantId = requireTenantContext(authContext);

  await requireTenantReadyForPrices(db, tenantId, input.businessLine);

  return findPriceBooks(db, {
    ...input,
    tenantId,
  });
}

export async function createTenantPriceBook(
  authContext: AuthContext,
  data: CreatePriceBookRequest,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<PriceBookSummary> {
  const tenantId = requireTenantContext(authContext);

  await requireTenantReadyForPrices(db, tenantId, data.businessLine);

  const duplicate = await findPriceBookByName(db, {
    tenantId,
    name: data.name,
  });

  if (duplicate) {
    throw new TenantPricesError(
      "PRICE_BOOK_NAME_DUPLICATE",
      "Price book name already exists in this tenant.",
      409,
    );
  }

  return db.transaction(async (tx) => {
    const priceBook = await createPriceBookRecord(tx, {
      ...data,
      tenantId,
      actorUserId: authContext.userId,
    });

    await writeAuditLog(tx, {
      actorUserId: authContext.userId,
      tenantId,
      eventCategory: "tenant_price",
      eventType: "price.created",
      entityType: "price",
      entityId: priceBook.id,
      after: priceBook,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });

    return priceBook;
  });
}

export async function updateTenantPriceBook(
  authContext: AuthContext,
  priceBookId: string,
  data: UpdatePriceBookRequest,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<PriceBookSummary> {
  const tenantId = requireTenantContext(authContext);

  await requireTenantReadyForPrices(db, tenantId);

  if (data.name) {
    const duplicate = await findPriceBookByName(db, {
      tenantId,
      name: data.name,
      excludePriceBookId: priceBookId,
    });

    if (duplicate) {
      throw new TenantPricesError(
        "PRICE_BOOK_NAME_DUPLICATE",
        "Price book name already exists in this tenant.",
        409,
      );
    }
  }

  return db.transaction(async (tx) => {
    const before = await findPriceBookAuditSnapshotById(tx, {
      tenantId,
      priceBookId,
    });

    if (!before) {
      throw new TenantPricesError(
        "PRICE_BOOK_NOT_FOUND",
        "Price book was not found.",
        404,
      );
    }

    await requireTenantReadyForPrices(
      tx,
      tenantId,
      data.businessLine ?? before.businessLine,
    );

    const priceBook = await updatePriceBookRecord(tx, {
      ...data,
      tenantId,
      priceBookId,
      actorUserId: authContext.userId,
    });

    if (!priceBook) {
      throw new TenantPricesError(
        "PRICE_BOOK_NOT_FOUND",
        "Price book was not found.",
        404,
      );
    }

    await writeAuditLog(tx, {
      actorUserId: authContext.userId,
      tenantId,
      eventCategory: "tenant_price",
      eventType: "price.updated",
      entityType: "price",
      entityId: priceBookId,
      before,
      after: priceBook,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });

    return priceBook;
  });
}

export async function deleteTenantPriceBook(
  authContext: AuthContext,
  priceBookId: string,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<void> {
  const tenantId = requireTenantContext(authContext);

  await requireTenantReadyForPrices(db, tenantId);

  await db.transaction(async (tx) => {
    const before = await findPriceBookAuditSnapshotById(tx, {
      tenantId,
      priceBookId,
    });

    if (!before) {
      throw new TenantPricesError(
        "PRICE_BOOK_NOT_FOUND",
        "Price book was not found.",
        404,
      );
    }

    await requireTenantReadyForPrices(tx, tenantId, before.businessLine);

    const deleted = await softDeletePriceBookRecord(tx, {
      tenantId,
      priceBookId,
      actorUserId: authContext.userId,
    });

    if (!deleted) {
      throw new TenantPricesError(
        "PRICE_BOOK_NOT_FOUND",
        "Price book was not found.",
        404,
      );
    }

    await writeAuditLog(tx, {
      actorUserId: authContext.userId,
      tenantId,
      eventCategory: "tenant_price",
      eventType: "price.deleted",
      entityType: "price",
      entityId: priceBookId,
      before,
      after: {
        deleted: true,
      },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
  });
}
