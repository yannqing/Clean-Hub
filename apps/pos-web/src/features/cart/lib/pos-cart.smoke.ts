import assert from "node:assert/strict";

import { createMemoryStorage } from "@cleanhub/offline";

import type { PosCartScope } from "../cart.types";
import {
  addProductToPosCart,
  addTicketToPosCart,
  buildPosCartStorageKey,
  calculatePosCartTotal,
  createEmptyPosCart,
  getTicketItemAvailability,
  readPosCart,
  selectNewestPosCart,
  writePosCart,
} from "./pos-cart";

const scope: PosCartScope = {
  tenantId: "01ARZ3NDEKTSV4RRFFQ69G5FAA",
  branchId: "01ARZ3NDEKTSV4RRFFQ69G5FAB",
  terminalId: "01ARZ3NDEKTSV4RRFFQ69G5FAC",
  userId: "01ARZ3NDEKTSV4RRFFQ69G5FAD",
};

assert.notEqual(
  buildPosCartStorageKey(scope),
  buildPosCartStorageKey({
    ...scope,
    tenantId: "01ARZ3NDEKTSV4RRFFQ69G5FAE",
  }),
  "cart persistence must be isolated by tenant",
);
assert.notEqual(
  buildPosCartStorageKey(scope),
  buildPosCartStorageKey({
    ...scope,
    terminalId: "01ARZ3NDEKTSV4RRFFQ69G5FAF",
  }),
  "cart persistence must be isolated by terminal",
);

let cart = createEmptyPosCart("XOF");
const firstProduct = addProductToPosCart(cart, {
  id: "01ARZ3NDEKTSV4RRFFQ69G5FB0",
  productId: "01ARZ3NDEKTSV4RRFFQ69G5FB1",
  productSkuId: "01ARZ3NDEKTSV4RRFFQ69G5FB2",
  productPriceId: "01ARZ3NDEKTSV4RRFFQ69G5FB3",
  name: "Detergent",
  brand: null,
  description: null,
  categoryId: null,
  categoryName: null,
  sku: "DET-1",
  barcode: "123456789",
  variantName: null,
  unitOfMeasure: "piece",
  unitCostAmount: "300",
  amount: "500",
  currency: "XOF",
  trackInventory: true,
  availableQuantity: "2",
  allowNegativeStock: false,
  allowOfflineSale: true,
  offlineStockBuffer: "0",
  media: [],
});
assert.equal(firstProduct.changed, true);
cart = firstProduct.cart;
cart = addProductToPosCart(cart, {
  id: "01ARZ3NDEKTSV4RRFFQ69G5FB0",
  productId: "01ARZ3NDEKTSV4RRFFQ69G5FB1",
  productSkuId: "01ARZ3NDEKTSV4RRFFQ69G5FB2",
  productPriceId: "01ARZ3NDEKTSV4RRFFQ69G5FB3",
  name: "Detergent",
  brand: null,
  description: null,
  categoryId: null,
  categoryName: null,
  sku: "DET-1",
  barcode: "123456789",
  variantName: null,
  unitOfMeasure: "piece",
  unitCostAmount: "300",
  amount: "500",
  currency: "XOF",
  trackInventory: true,
  availableQuantity: "2",
  allowNegativeStock: false,
  allowOfflineSale: true,
  offlineStockBuffer: "0",
  media: [],
}).cart;
assert.equal(cart.lines[0]?.kind, "product");
assert.equal(cart.lines[0]?.kind === "product" && cart.lines[0].quantity, 2);
assert.equal(calculatePosCartTotal(cart), "1000.00");

const overStock = addProductToPosCart(cart, {
  id: "01ARZ3NDEKTSV4RRFFQ69G5FB0",
  productId: "01ARZ3NDEKTSV4RRFFQ69G5FB1",
  productSkuId: "01ARZ3NDEKTSV4RRFFQ69G5FB2",
  productPriceId: "01ARZ3NDEKTSV4RRFFQ69G5FB3",
  name: "Detergent",
  brand: null,
  description: null,
  categoryId: null,
  categoryName: null,
  sku: "DET-1",
  barcode: "123456789",
  variantName: null,
  unitOfMeasure: "piece",
  unitCostAmount: "300",
  amount: "500",
  currency: "XOF",
  trackInventory: true,
  availableQuantity: "2",
  allowNegativeStock: false,
  allowOfflineSale: true,
  offlineStockBuffer: "0",
  media: [],
});
assert.equal(overStock.changed, false, "cart must reject stale over-selling");

const ticketResult = addTicketToPosCart(
  cart,
  {
    id: "01ARZ3NDEKTSV4RRFFQ69G5FB4",
    branchId: scope.branchId,
    currency: "XOF",
    customerId: "01ARZ3NDEKTSV4RRFFQ69G5FB5",
    customerName: "Awa",
    ticketNo: "TK-100",
    items: [
      {
        id: "01ARZ3NDEKTSV4RRFFQ69G5FB6",
        ticketId: "01ARZ3NDEKTSV4RRFFQ69G5FB4",
        itemType: "cloth",
        itemName: "Shirt wash",
        itemCategory: null,
        itemStatus: "pending_wash",
        itemColor: null,
        itemBrand: null,
        itemMaterial: null,
        quantity: 1,
        pricingUnit: "per_item",
        standardUnitAmount: "750",
        chargedUnitAmount: "750",
        weight: null,
        bagCount: null,
        unitAmount: "750",
        lineAmount: "750",
        serviceId: "01ARZ3NDEKTSV4RRFFQ69G5FB7",
        labelCode: null,
        defectNotes: null,
        specialRequest: null,
        remark: null,
        sortOrder: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
    ],
  },
  scope.branchId,
);
assert.equal(ticketResult.changed, true);
assert.equal(ticketResult.cart.customer?.id, "01ARZ3NDEKTSV4RRFFQ69G5FB5");
assert.equal(calculatePosCartTotal(ticketResult.cart), "1750.00");

const older = { ...ticketResult.cart, updatedAt: "2026-01-01T00:00:00.000Z" };
const newer = { ...ticketResult.cart, updatedAt: "2026-01-02T00:00:00.000Z" };
assert.equal(
  selectNewestPosCart(older, newer, "XOF").updatedAt,
  newer.updatedAt,
  "a newer cloud cart must win when resuming on another terminal",
);
assert.equal(
  selectNewestPosCart(newer, older, "XOF").updatedAt,
  newer.updatedAt,
  "an older cloud response must not overwrite newer local work",
);

const ticketItemId = "01ARZ3NDEKTSV4RRFFQ69G5FB6";
const activeOrder = {
  id: "01ARZ3NDEKTSV4RRFFQ69G5FB8",
  ticketItemIds: [ticketItemId],
  currency: "XOF",
  orderType: "manual",
  status: "received",
  paymentStatus: "unpaid",
  totalAmount: "750",
  paidAmount: "0",
  createdAt: new Date().toISOString(),
};
assert.equal(
  getTicketItemAvailability(
    "01ARZ3NDEKTSV4RRFFQ69G5FB4",
    [activeOrder],
    cart,
  ).billedIds.has(ticketItemId),
  true,
  "non-cancelled orders must reserve their ticket items",
);
assert.equal(
  getTicketItemAvailability(
    "01ARZ3NDEKTSV4RRFFQ69G5FB4",
    [{ ...activeOrder, status: "cancelled" }],
    cart,
  ).billedIds.has(ticketItemId),
  false,
  "cancelled orders must release their ticket items for rebilling",
);

async function testPersistence() {
  const storage = createMemoryStorage();
  await writePosCart(storage, scope, ticketResult.cart);
  const restored = await readPosCart(storage, scope, "XOF");
  assert.deepEqual(restored, ticketResult.cart);
}

void testPersistence()
  .then(() => console.log("POS cart smoke passed."))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
