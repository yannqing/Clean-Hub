import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { auditLogs, type Database } from "@cleanhub/db";

import { writeAuditLog } from "../../audit/audit.helper.js";
import type { AuthRequestMeta } from "../../auth/auth.types.js";
import { TenantProductsError } from "./products.errors.js";
import {
  createTenantProductRecord,
  lockTenantProductSkuWrites,
} from "./products.repository.js";
import type {
  ImportTenantProductsRequest,
  ImportTenantProductsResponse,
} from "./products.types.js";

export async function importTenantProductRecords(
  db: Database,
  input: ImportTenantProductsRequest & {
    tenantId: string;
    actorUserId: string;
    requestMeta: AuthRequestMeta;
  },
): Promise<ImportTenantProductsResponse> {
  const requestHash = createHash("sha256")
    .update(JSON.stringify(input.products))
    .digest("hex");
  return db.transaction(async (tx) => {
    await lockTenantProductSkuWrites(tx, input.tenantId);
    const [receipt] = await tx
      .select({ after: auditLogs.after, metadata: auditLogs.metadata })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.tenantId, input.tenantId),
          eq(auditLogs.entityType, "product_import"),
          eq(auditLogs.entityId, input.importId),
          eq(auditLogs.eventType, "product.imported"),
        ),
      )
      .limit(1);
    // The receipt commits in the same transaction as the products. A retry
    // after a lost response therefore returns the original result.
    if (receipt) {
      if (receipt.metadata?.requestHash !== requestHash) {
        throw new TenantProductsError(
          "PRODUCT_IMPORT_CONFLICT",
          "This import ID was already used for a different file. Start a new import.",
          409,
        );
      }
      return receipt.after as ImportTenantProductsResponse;
    }

    const data: ImportTenantProductsResponse["data"] = [];
    for (const { rowNumber, product } of input.products) {
      try {
        data.push(
          await createTenantProductRecord(tx, {
            ...product,
            tenantId: input.tenantId,
            actorUserId: input.actorUserId,
            createTenantDefaultPrice: true,
            requestMeta: input.requestMeta,
          }),
        );
      } catch (error) {
        if (error instanceof TenantProductsError) {
          throw new TenantProductsError(
            error.code,
            error.message,
            error.status,
            rowNumber,
          );
        }
        throw error;
      }
    }
    const result = { imported: data.length, data };
    await writeAuditLog(tx, {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      eventCategory: "tenant_product",
      eventType: "product.imported",
      entityType: "product_import",
      entityId: input.importId,
      after: result,
      metadata: { requestHash },
      ...input.requestMeta,
    });
    return result;
  });
}
