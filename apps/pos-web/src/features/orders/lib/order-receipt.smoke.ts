import assert from "node:assert/strict";

import type {
  PosBranchSummary,
  PosOrderDetail,
  PosPaymentTransaction,
} from "@cleanhub/api-client";
import { buildPosReceiptText } from "@cleanhub/hardware";

import { buildPosOrderReceipt, getPosReceiptCopy } from "./order-receipt";

assert.equal(getPosReceiptCopy("en").paymentMethods.cash, "Cash");
assert.equal(getPosReceiptCopy("fr").paymentMethods.cash, "Espèces");
assert.equal(getPosReceiptCopy("zh-CN").paymentMethods.cash, "现金");

const content = buildPosReceiptText(
  {
    receiptNo: "RC-1",
    orderCode: "ORDER-1",
    issuedAt: "2026-09-07T00:00:00.000Z",
    currency: "XOF",
    merchantName: "CleanHub Merchant",
    branchName: "Dakar Branch",
    customerName: "Hidden Customer",
    fields: ["merchant_name", "branch_name", "payment_method"],
    items: [],
    subtotalMinor: 100,
    totalMinor: 100,
    paidMinor: 100,
    balanceMinor: 0,
    paymentMethod: getPosReceiptCopy("en").paymentMethods.cash,
  },
  { locale: "en" },
);

assert.match(content, /CleanHub Merchant/);
assert.match(content, /Dakar Branch/);
assert.match(content, /Payment: Cash/);
assert.doesNotMatch(content, /Hidden Customer/);
assert.doesNotMatch(content, /ORDER-1/);

const integratedReceipt = buildPosOrderReceipt({
  branch: {
    merchantName: "CleanHub Merchant",
    name: "Dakar Branch",
    receiptName: null,
    receiptAddress: null,
    receiptPhone: null,
    receiptFields: ["merchant_name", "branch_name", "payment_method"],
  } as PosBranchSummary,
  locale: "en",
  order: {
    id: "01M2F4J4P3V3V3V3V3V3V3V3V3",
    items: [],
    subtotalAmount: "100",
    discountAmount: "0",
    taxableAmount: "100",
    taxAmount: "0",
    taxRateSnapshot: "0",
    roundingAdjustmentAmount: "0",
    taxRegistrationNumberSnapshot: null,
    taxExemptionReason: null,
    totalAmount: "100",
    paidAmount: "100",
    currency: "XOF",
    customerName: null,
    paidAt: "2026-09-07T00:00:00.000Z",
    updatedAt: "2026-09-07T00:00:00.000Z",
  } as unknown as PosOrderDetail,
  payments: [
    {
      paymentStatus: "paid",
      paymentMethod: "cash",
      provider: null,
      tenderedAmount: "100",
      changeAmount: "0",
      amount: "100",
      currency: "XOF",
    } as PosPaymentTransaction,
  ],
});

assert.match(integratedReceipt.content, /CleanHub Merchant/);
assert.match(integratedReceipt.content, /Dakar Branch/);
assert.match(integratedReceipt.content, /Payment: Cash/);
assert.doesNotMatch(integratedReceipt.content, /现金/);

// The customer brings this slip back to collect their garments, so every line
// has to name the ticket and tag it belongs to, and the slip has to say when
// the order is ready.
const pickupReceipt = buildPosOrderReceipt({
  branch: {
    merchantName: "CleanHub Merchant",
    name: "Dakar Branch",
    receiptName: null,
    receiptAddress: null,
    receiptPhone: null,
    receiptFields: ["merchant_name", "item_notes", "expected_pickup"],
  } as PosBranchSummary,
  locale: "en",
  order: {
    id: "01M2F4J4P3V3V3V3V3V3V3V3V4",
    items: [
      {
        itemName: "Shirt wash",
        ticketId: "01ARZ3NDEKTSV4RRFFQ69G5FB4",
        itemIdentifier: "TK-100-001",
        quantity: "1",
        pricingUnit: "per_item",
        chargedUnitAmount: "15",
        lineAmount: "15",
        unitOfMeasure: null,
        weight: null,
        bagCount: null,
        itemColor: null,
        specialRequest: null,
        sku: null,
        barcode: null,
      },
      {
        itemName: "Suit dry clean",
        ticketId: "01ARZ3NDEKTSV4RRFFQ69G5FC0",
        itemIdentifier: "TK-101-001",
        quantity: "1",
        pricingUnit: "per_item",
        chargedUnitAmount: "40",
        lineAmount: "40",
        unitOfMeasure: null,
        weight: null,
        bagCount: null,
        itemColor: null,
        specialRequest: null,
        sku: null,
        barcode: null,
      },
    ],
    ticketReferences: [
      {
        ticketId: "01ARZ3NDEKTSV4RRFFQ69G5FB4",
        ticketNo: "TK-100",
        remark: null,
        priority: "normal",
        expectedPickupAt: "2026-09-12T09:00:00.000Z",
        assistantName: null,
        itemCount: 1,
        itemAmount: "15.00",
      },
      {
        ticketId: "01ARZ3NDEKTSV4RRFFQ69G5FC0",
        ticketNo: "TK-101",
        remark: null,
        priority: "urgent",
        expectedPickupAt: "2026-09-11T09:00:00.000Z",
        assistantName: null,
        itemCount: 1,
        itemAmount: "40.00",
      },
    ],
    subtotalAmount: "55",
    discountAmount: "0",
    taxableAmount: "55",
    taxAmount: "0",
    taxRateSnapshot: "0",
    roundingAdjustmentAmount: "0",
    taxRegistrationNumberSnapshot: null,
    taxExemptionReason: null,
    totalAmount: "55",
    paidAmount: "55",
    currency: "XOF",
    customerName: null,
    paidAt: "2026-09-07T00:00:00.000Z",
    updatedAt: "2026-09-07T00:00:00.000Z",
  } as unknown as PosOrderDetail,
  payments: [],
});

assert.match(
  pickupReceipt.content,
  /Ticket: TK-100/,
  "a receipt line must name the ticket its garment belongs to",
);
assert.match(
  pickupReceipt.content,
  /Ticket: TK-101/,
  "every ticket in a merged order must appear on the receipt",
);
assert.match(
  pickupReceipt.content,
  /Tag: TK-100-001/,
  "the label code must be printed so staff can find the garment",
);
assert.match(
  pickupReceipt.content,
  /Ready for pickup/,
  "the receipt must tell the customer when the order is ready",
);

console.log("POS receipt smoke ok");
