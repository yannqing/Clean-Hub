import assert from "node:assert/strict";

import "../../../config/env.js";

import { eq, inArray } from "drizzle-orm";

import {
  branchProductSettings,
  branches,
  closeDbConnection,
  getDb,
  products,
  productSkus,
  tenants,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import {
  findTenantProductDetailRecord,
  findTenantProductOverview,
  findTenantProducts,
} from "./products.repository.js";

export async function runTenantProductScopeSmokeChecks(): Promise<void> {
  const db = getDb();
  const tenantRows = await db.select({ id: tenants.id }).from(tenants).limit(1);
  const tenantId = tenantRows[0]?.id;

  assert.ok(tenantId, "product scope smoke requires at least one tenant");

  const branchIds = [createId(), createId()];
  const productIds = [createId(), createId()];
  const productSkuIds = [createId(), createId()];
  const suffix = createId();

  try {
    await db.insert(branches).values(
      branchIds.map((id, index) => ({
        id,
        tenantId,
        name: `Scope smoke branch ${index + 1} ${suffix}`,
        status: "active" as const,
      })),
    );
    await db.insert(products).values(
      productIds.map((id, index) => ({
        id,
        tenantId,
        name: `Scope smoke product ${index + 1} ${suffix}`,
        tags: [],
        status: "active" as const,
      })),
    );
    await db.insert(productSkus).values(
      productSkuIds.map((id, index) => ({
        id,
        tenantId,
        productId: productIds[index]!,
        skuCode: `SCOPE-${suffix}-${index + 1}`,
        unitOfMeasure: "piece",
        unitsPerSale: "1",
        trackInventory: false,
        status: "active" as const,
      })),
    );
    await db.insert(branchProductSettings).values(
      productSkuIds.map((productSkuId, index) => ({
        id: createId(),
        tenantId,
        branchId: branchIds[index]!,
        productSkuId,
        isAvailable: true,
        reorderPoint: "0",
      })),
    );

    const ownerList = await findTenantProducts(db, {
      tenantId,
      limit: 100,
      offset: 0,
    });
    const managerList = await findTenantProducts(db, {
      tenantId,
      allowedBranchIds: [branchIds[0]!],
      limit: 100,
      offset: 0,
    });
    const unassignedManagerList = await findTenantProducts(db, {
      tenantId,
      allowedBranchIds: [],
      limit: 100,
      offset: 0,
    });

    assert.equal(
      ownerList.data.filter((product) => productIds.includes(product.id))
        .length,
      2,
    );
    assert.deepEqual(
      managerList.data
        .filter((product) => productIds.includes(product.id))
        .map((product) => product.id),
      [productIds[0]],
    );
    assert.equal(unassignedManagerList.total, 0);

    const ownerDetail = await findTenantProductDetailRecord(db, {
      tenantId,
      productId: productIds[0]!,
      preferTenantDefaultPrice: true,
    });
    const managerDetail = await findTenantProductDetailRecord(db, {
      tenantId,
      allowedBranchIds: [branchIds[0]!],
      productId: productIds[0]!,
      preferTenantDefaultPrice: false,
    });
    const crossBranchDetail = await findTenantProductDetailRecord(db, {
      tenantId,
      allowedBranchIds: [branchIds[0]!],
      productId: productIds[1]!,
      preferTenantDefaultPrice: false,
    });
    const unassignedManagerDetail = await findTenantProductDetailRecord(db, {
      tenantId,
      allowedBranchIds: [],
      productId: productIds[0]!,
      preferTenantDefaultPrice: false,
    });

    assert.equal(ownerDetail?.id, productIds[0]);
    assert.equal(managerDetail?.id, productIds[0]);
    assert.equal(crossBranchDetail, null);
    assert.equal(unassignedManagerDetail, null);

    const ownerOverview = await findTenantProductOverview(db, {
      tenantId,
    });
    const managerOverview = await findTenantProductOverview(db, {
      tenantId,
      allowedBranchIds: [branchIds[0]!],
    });
    const unassignedManagerOverview = await findTenantProductOverview(db, {
      tenantId,
      allowedBranchIds: [],
    });

    assert.ok(ownerOverview.productCount >= 2);
    assert.equal(managerOverview.productCount, 1);
    assert.equal(managerOverview.skuCount, 1);
    assert.deepEqual(unassignedManagerOverview, {
      productCount: 0,
      activeProductCount: 0,
      skuCount: 0,
      lowStockSkuCount: 0,
    });

    await db
      .update(branchProductSettings)
      .set({ isAvailable: false })
      .where(eq(branchProductSettings.productSkuId, productSkuIds[0]!));

    const unavailableManagerList = await findTenantProducts(db, {
      tenantId,
      allowedBranchIds: [branchIds[0]!],
      limit: 100,
      offset: 0,
    });
    const unavailableManagerOverview = await findTenantProductOverview(db, {
      tenantId,
      allowedBranchIds: [branchIds[0]!],
    });

    assert.equal(unavailableManagerList.total, 0);
    assert.deepEqual(unavailableManagerOverview, {
      productCount: 0,
      activeProductCount: 0,
      skuCount: 0,
      lowStockSkuCount: 0,
    });
  } finally {
    await db
      .delete(branchProductSettings)
      .where(inArray(branchProductSettings.productSkuId, productSkuIds));
    await db.delete(productSkus).where(inArray(productSkus.id, productSkuIds));
    await db.delete(products).where(inArray(products.id, productIds));
    await db.delete(branches).where(inArray(branches.id, branchIds));
  }
}

if (process.argv[1]?.endsWith("products.repository.scope.smoke.ts")) {
  try {
    await runTenantProductScopeSmokeChecks();
  } finally {
    await closeDbConnection();
  }
}
