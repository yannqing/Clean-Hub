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

console.log("POS receipt smoke ok");
