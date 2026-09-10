import assert from "node:assert/strict";

import { createMemoryStorage } from "@cleanhub/offline";

import type { PosCartScope } from "../cart.types";
import { splitMixedPaymentTotal } from "./checkout-payment";
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

assert.deepEqual(splitMixedPaymentTotal("100.00"), {
  cashAmount: "50.00",
  externalAmount: "50.00",
});
assert.deepEqual(
  splitMixedPaymentTotal("100.01"),
  {
    cashAmount: "50.00",
    externalAmount: "50.01",
  },
  "mixed payment must preserve the exact total for odd minor units",
);

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

// A customer collecting one ticket while dropping off another must settle in
// a single order, so a second ticket has to accumulate onto the first.
const secondTicketResult = addTicketToPosCart(
  ticketResult.cart,
  {
    id: "01ARZ3NDEKTSV4RRFFQ69G5FC0",
    branchId: scope.branchId,
    currency: "XOF",
    customerId: "01ARZ3NDEKTSV4RRFFQ69G5FB5",
    customerName: "Awa",
    ticketNo: "TK-101",
    items: [
      {
        id: "01ARZ3NDEKTSV4RRFFQ69G5FC1",
        ticketId: "01ARZ3NDEKTSV4RRFFQ69G5FC0",
        itemType: "cloth",
        itemName: "Suit dry clean",
        itemCategory: null,
        itemStatus: "pending_wash",
        itemColor: null,
        itemBrand: null,
        itemMaterial: null,
        quantity: 1,
        pricingUnit: "per_item",
        standardUnitAmount: "2000",
        chargedUnitAmount: "2000",
        weight: null,
        bagCount: null,
        unitAmount: "2000",
        lineAmount: "2000",
        serviceId: "01ARZ3NDEKTSV4RRFFQ69G5FC2",
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
assert.equal(secondTicketResult.changed, true);
assert.equal(
  secondTicketResult.cart.lines.filter((line) => line.kind === "ticket_item")
    .length,
  2,
  "a second ticket must add to the cart instead of replacing the first",
);
assert.deepEqual(
  secondTicketResult.cart.lines
    .filter((line) => line.kind === "ticket_item")
    .map((line) => line.ticketCode)
    .sort(),
  ["TK-100", "TK-101"],
  "each ticket item must keep the ticket it came from",
);
assert.equal(
  calculatePosCartTotal(secondTicketResult.cart),
  "3750.00",
  "a multi-ticket cart must total every ticket it holds",
);

const foreignCustomerTicket = addTicketToPosCart(
  ticketResult.cart,
  {
    id: "01ARZ3NDEKTSV4RRFFQ69G5FC3",
    branchId: scope.branchId,
    currency: "XOF",
    customerId: "01ARZ3NDEKTSV4RRFFQ69G5FC4",
    customerName: "Bintou",
    ticketNo: "TK-102",
    items: secondTicketResult.cart.lines
      .filter((line) => line.kind === "ticket_item")
      .slice(0, 1)
      .map(() => ({
        id: "01ARZ3NDEKTSV4RRFFQ69G5FC5",
        ticketId: "01ARZ3NDEKTSV4RRFFQ69G5FC3",
        itemType: "cloth" as const,
        itemName: "Coat wash",
        itemCategory: null,
        itemStatus: "pending_wash" as const,
        itemColor: null,
        itemBrand: null,
        itemMaterial: null,
        quantity: 1,
        pricingUnit: "per_item" as const,
        standardUnitAmount: "500",
        chargedUnitAmount: "500",
        weight: null,
        bagCount: null,
        unitAmount: "500",
        lineAmount: "500",
        serviceId: "01ARZ3NDEKTSV4RRFFQ69G5FC6",
        labelCode: null,
        defectNotes: null,
        specialRequest: null,
        remark: null,
        sortOrder: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      })),
  },
  scope.branchId,
);
assert.equal(
  foreignCustomerTicket.changed,
  false,
  "tickets belonging to another customer must never join the same cart",
);

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
