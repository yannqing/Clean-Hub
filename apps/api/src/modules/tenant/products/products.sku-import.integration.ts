import assert from "node:assert/strict";
import "../../../config/env.js";
import { and, eq } from "drizzle-orm";
import {
  auditLogs,
  branchProductSettings,
  branches,
  closeDbConnection,
  getDb,
  inventoryBalances,
  inventoryMovements,
  productPrices,
  products,
  productSkus,
  runWithSystemDatabaseContext,
  runWithTenantDatabaseContext,
  tenantFeatureFlags,
  tenantSettings,
  tenants,
  users,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";
import type { AuthContext } from "../../auth/auth.types.js";
import {
  createTenantProduct,
  importTenantProducts,
} from "./products.service.js";
import {
  findTenantProductDetailRecord,
  updateTenantProductRecord,
} from "./products.repository.js";
import type {
  CreateTenantProductRequest,
  ImportTenantProductsRequest,
} from "./products.types.js";
import {
  createTenantProductBodySchema,
  importTenantProductsBodySchema,
  updateTenantProductBodySchema,
} from "./products.validation.js";

async function run() {
  assert.ok(
    ["localhost", "127.0.0.1", "postgres", "[::1]"].includes(
      new URL(process.env.DATABASE_URL!).hostname,
    ),
    "Use a local test database.",
  );
  const tenantIds = [createId(), createId()];
  const ownerIds = [createId(), createId()];
  const branchIds = [createId(), createId()];
  const auth = (index = 0): AuthContext => ({
    userId: ownerIds[index]!,
    tenantId: tenantIds[index]!,
    role: "owner",
    displayName: "SKU import test",
    branchIds: [],
    roles: ["owner"],
    permissions: [],
    accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  const body = (skuCode?: string, index = 0): CreateTenantProductRequest => ({
    name: "SKU import test",
    skuCode,
    status: "active",
    salePrice: "25",
    categoryAttributes: [],
    tags: [],
    unitOfMeasure: "piece",
    unitsPerSale: "1",
    trackInventory: true,
    allowNegativeStock: false,
    allowOfflineSale: false,
    branchSettings: [
      { branchId: branchIds[index]!, openingStock: "3", reorderPoint: "1" },
    ],
    mediaObjectKeys: [],
  });
  const scoped = <T>(operation: () => Promise<T>, index = 0) =>
    runWithTenantDatabaseContext(tenantIds[index]!, operation);
  try {
    await runWithSystemDatabaseContext(async () => {
      await getDb().transaction(async (tx) => {
        for (const index of [0, 1]) {
          const tenantId = tenantIds[index]!;
          await tx
            .insert(tenants)
            .values({
              id: tenantId,
              name: "SKU test",
              pressingCode: `SKU-${tenantId}`,
              status: "active",
            });
          await tx
            .insert(users)
            .values({
              id: ownerIds[index]!,
              tenantId,
              userType: "tenant",
              passwordHash: "test",
              pinHash: "test",
              status: "active",
            });
          await tx
            .insert(tenantSettings)
            .values({ id: createId(), tenantId, defaultCurrency: "XOF" });
          await tx
            .insert(tenantFeatureFlags)
            .values({ id: createId(), tenantId, retailProductsEnabled: true });
          await tx
            .insert(branches)
            .values({
              id: branchIds[index]!,
              tenantId,
              name: "SKU store",
              defaultCurrency: "XOF",
              status: "active",
            });
        }
      });
    });

    assert.equal(
      createTenantProductBodySchema.parse(body("  ")).skuCode,
      undefined,
    );
    const generated = await Promise.all(
      Array.from({ length: 12 }, () =>
        scoped(() => createTenantProduct(auth(), body())),
      ),
    );
    assert.equal(
      new Set(generated.map((item) => item.skuCode)).size,
      12,
      "concurrent requests use distinct SKUs",
    );
    generated.forEach((item) =>
      assert.match(item.skuCode, /^SKU-[2-9A-HJKMNPQRSTUVWXYZ]{10}$/),
    );
    const custom = await scoped(() =>
      createTenantProduct(auth(), body("CUSTOM-001")),
    );
    assert.equal(custom.skuCode, "CUSTOM-001");
    await assert.rejects(
      scoped(() => createTenantProduct(auth(), body("CUSTOM-001"))),
      { code: "PRODUCT_SKU_CODE_DUPLICATE" },
    );
    assert.equal(
      (
        await scoped(
          () => createTenantProduct(auth(1), body("CUSTOM-001", 1)),
          1,
        )
      ).skuCode,
      "CUSTOM-001",
      "uniqueness is tenant scoped",
    );

    const batch: ImportTenantProductsRequest = {
      importId: createId(),
      products: [
        { rowNumber: 2, product: body() },
        { rowNumber: 4, product: body("BATCH-001") },
      ],
    };
    const [first, retry] = await Promise.all([
      scoped(() =>
        importTenantProducts(
          auth(),
          importTenantProductsBodySchema.parse(batch),
        ),
      ),
      scoped(() =>
        importTenantProducts(
          auth(),
          importTenantProductsBodySchema.parse(batch),
        ),
      ),
    ]);
    assert.equal(first.imported, 2);
    assert.deepEqual(
      retry,
      first,
      "concurrent/retried imports return the same products",
    );
    assert.equal(first.data[1]!.skuCode, "BATCH-001");
    await assert.rejects(
      scoped(() =>
        importTenantProducts(auth(), {
          ...batch,
          products: [{ rowNumber: 2, product: body("DIFFERENT") }],
        }),
      ),
      { code: "PRODUCT_IMPORT_CONFLICT" },
    );

    const counts = () =>
      scoped(async () => {
        const result: number[] = [];
        for (const table of [
          products,
          productSkus,
          inventoryMovements,
          auditLogs,
        ]) {
          result.push(
            (
              await getDb()
                .select({ id: table.id })
                .from(table)
                .where(eq(table.tenantId, tenantIds[0]!))
            ).length,
          );
        }
        return result;
      });
    const before = await counts();
    await assert.rejects(
      scoped(() =>
        importTenantProducts(auth(), {
          importId: createId(),
          products: [
            { rowNumber: 2, product: body() },
            { rowNumber: 9, product: body("CUSTOM-001") },
          ],
        }),
      ),
      { code: "PRODUCT_SKU_CODE_DUPLICATE", row: 9 },
    );
    assert.deepEqual(
      await counts(),
      before,
      "failed batch rolls back products, stock movements and audit receipts",
    );
    await assert.rejects(
      scoped(() =>
        importTenantProducts(auth(), {
          importId: createId(),
          products: [{ rowNumber: 5, product: body(undefined, 1) }],
        }),
      ),
      { code: "PRODUCT_BRANCH_NOT_FOUND", row: 5 },
    );
    await assert.rejects(
      scoped(() => importTenantProducts({ ...auth(), role: "manager" }, batch)),
      { code: "FORBIDDEN" },
    );

    await scoped(async () => {
      const db = getDb();
      const detail = await findTenantProductDetailRecord(db, {
        tenantId: tenantIds[0]!,
        productId: generated[0]!.id,
        preferTenantDefaultPrice: true,
      });
      assert.ok(detail);
      const update = {
        ...body(),
        tenantId: tenantIds[0]!,
        productId: detail.id,
        actorUserId: ownerIds[0]!,
        skuCode: detail.sku.skuCode,
        name: "Renamed product",
        currency: "XOF",
        version: detail.version,
        skuId: detail.sku.id,
        skuVersion: detail.sku.version,
        updateTenantDefaultPrice: true,
        retainedMediaIds: [],
        newMediaObjectKeys: [],
        branchSettings: [
          {
            branchId: branchIds[0]!,
            expectedStockOnHand: "3",
            stockOnHand: "3",
            reorderPoint: "1",
          },
        ],
      };
      const renamed = await updateTenantProductRecord(db, update);
      assert.equal(
        renamed.sku.skuCode,
        detail.sku.skuCode,
        "editing other fields preserves the SKU",
      );
      const edited = await updateTenantProductRecord(db, {
        ...update,
        version: renamed.version,
        skuVersion: renamed.sku.version,
        skuCode: "EDITED-001",
      });
      assert.equal(edited.sku.skuCode, "EDITED-001");
      assert.equal(
        edited.sku.id,
        detail.sku.id,
        "SKU edits preserve inventory and order references",
      );
      assert.equal(
        updateTenantProductBodySchema.safeParse({ ...update, skuCode: "" })
          .success,
        false,
      );
      await assert.rejects(
        updateTenantProductRecord(db, {
          ...update,
          version: edited.version,
          skuVersion: edited.sku.version,
          skuCode: "CUSTOM-001",
        }),
        { code: "PRODUCT_SKU_CODE_DUPLICATE" },
      );
      const stock = await db
        .select()
        .from(inventoryBalances)
        .where(
          and(
            eq(inventoryBalances.tenantId, tenantIds[0]!),
            eq(inventoryBalances.productSkuId, detail.sku.id),
          ),
        );
      assert.equal(Number(stock[0]!.onHandQuantity), 3);
    });
    await runWithSystemDatabaseContext(() =>
      getDb()
        .update(tenantFeatureFlags)
        .set({ retailProductsEnabled: false })
        .where(eq(tenantFeatureFlags.tenantId, tenantIds[0]!)),
    );
    await assert.rejects(
      scoped(() => importTenantProducts(auth(), batch)),
      { code: "FEATURE_DISABLED" },
    );
    console.log(
      "Product SKU/import integration passed: concurrency, custom/edit, tenant isolation, atomic rollback, replay and feature gating.",
    );
  } finally {
    await runWithSystemDatabaseContext(async () => {
      for (const tenantId of tenantIds) {
        for (const table of [
          auditLogs,
          inventoryMovements,
          inventoryBalances,
          branchProductSettings,
          productPrices,
          productSkus,
          products,
          tenantFeatureFlags,
          tenantSettings,
          branches,
          users,
          tenants,
        ]) {
          const column =
            table === tenants
              ? tenants.id
              : "tenantId" in table
                ? table.tenantId
                : tenants.id;
          await getDb().delete(table).where(eq(column, tenantId));
        }
      }
    });
    await closeDbConnection();
  }
}

await run();
