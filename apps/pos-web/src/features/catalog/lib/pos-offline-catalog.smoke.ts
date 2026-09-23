import { createMemoryStorage } from "@cleanhub/offline";
import type { PosCatalogResponse } from "@cleanhub/api-client";

import {
  buildPosOfflineCatalogStorageKey,
  readPosOfflineCatalog,
  writePosOfflineCatalog,
} from "./pos-offline-catalog";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const scope = {
  tenantId: "01J00000000000000000000000",
  branchId: "01J00000000000000000000001",
  terminalId: "01J00000000000000000000002",
  currency: "XOF",
};

const catalog: PosCatalogResponse = {
  products: [
    {
      id: "01J00000000000000000000003",
      productId: "01J00000000000000000000004",
      productSkuId: "01J00000000000000000000005",
      productPriceId: "01J00000000000000000000006",
      name: "Laundry bag",
      brand: null,
      description: null,
      categoryId: null,
      categoryName: null,
      sku: "BAG-01",
      barcode: "1234567890",
      variantName: null,
      unitOfMeasure: "each",
      unitCostAmount: null,
      amount: "5.00",
      currency: "XOF",
      trackInventory: true,
      availableQuantity: "8",
      allowNegativeStock: false,
      allowOfflineSale: true,
      offlineStockBuffer: "2",
      media: [
        {
          id: "01J00000000000000000000007",
          downloadUrl: "https://example.test/signed-image",
          expiresAt: "2026-09-21T00:00:00.000Z",
          isPrimary: true,
          sortOrder: 0,
        },
      ],
    },
  ],
  data: [
    {
      id: "01J00000000000000000000008",
      name: "Wash and fold",
      shortName: null,
      description: null,
      categoryId: "01J00000000000000000000009",
      categoryName: "Laundry",
      businessLine: "laundry",
      pricingUnit: "per_item",
      labelRule: "per_item",
      applicableItemTypes: ["cloth"],
      turnaroundMinutes: 60,
      amount: "10.00",
      currency: "XOF",
      media: [],
    },
  ],
};

async function main(): Promise<void> {
  const storage = createMemoryStorage();
  const updatedAt = "2026-09-21T10:00:00.000Z";
  const written = await writePosOfflineCatalog(storage, scope, catalog, {
    updatedAt,
  });
  assert(written, "Catalog should fit in offline storage");

  const key = buildPosOfflineCatalogStorageKey(scope);
  assert(
    key.includes(scope.tenantId) &&
      key.includes(scope.branchId) &&
      key.includes(scope.terminalId),
    "Catalog cache must be scoped to the tenant, branch, and terminal",
  );

  const cached = await readPosOfflineCatalog(storage, scope, {
    now: Date.parse(updatedAt) + 60_000,
  });
  assert(cached !== null, "Fresh catalog cache should be readable");
  assert(
    cached.products[0]?.media.length === 0,
    "Catalog cache must not retain signed media URLs",
  );
  assert(
    cached.products[0]?.allowOfflineSale,
    "Offline sale rules must survive caching",
  );
  assert(
    (await readPosOfflineCatalog(storage, scope, {
      now: Date.parse(updatedAt) + 24 * 60 * 60 * 1000 + 1,
    })) === null,
    "Expired catalogs must not be used for offline sales",
  );
  assert(
    (await readPosOfflineCatalog(storage, { ...scope, currency: "USD" })) ===
      null,
    "A catalog in another currency must not be reused",
  );

  console.log("POS offline catalog smoke ok");
}

void main();
