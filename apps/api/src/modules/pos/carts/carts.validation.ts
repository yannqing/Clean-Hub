import { z } from "zod";

import { createManualOrderItemBodySchema } from "../orders/orders.validation.js";

const ulidSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
const currencySchema = z.string().regex(/^[A-Z]{3}$/);
const amountSchema = z.string().regex(/^\d+(?:\.\d{1,4})?$/);
const timestampSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)));

const productLineSchema = z.object({
  id: z.string().min(1).max(180),
  kind: z.literal("product"),
  productSkuId: ulidSchema,
  name: z.string().min(1).max(200),
  sku: z.string().min(1).max(80),
  barcode: z.string().max(80).nullable(),
  variantName: z.string().max(160).nullable(),
  unitOfMeasure: z.string().min(1).max(32),
  unitAmount: amountSchema,
  currency: currencySchema,
  quantity: z.number().int().min(1).max(999_999),
  trackInventory: z.boolean(),
  availableQuantity: amountSchema.nullable(),
  allowNegativeStock: z.boolean(),
  allowOfflineSale: z.boolean(),
  offlineStockBuffer: amountSchema,
  coverUrl: z.string().max(8192).nullable(),
});

const ticketLineSchema = z.object({
  id: z.string().min(1).max(180),
  kind: z.literal("ticket_item"),
  ticketId: ulidSchema,
  ticketItemId: ulidSchema,
  ticketCode: z.string().min(1).max(80),
  serviceId: ulidSchema.nullable(),
  name: z.string().min(1).max(200),
  pricingUnit: z.enum(["per_item", "per_kg"]),
  quantity: z.number().int().min(1).max(999_999),
  weight: amountSchema.nullable(),
  bagCount: z.number().int().min(1).max(9999).nullable(),
  unitAmount: amountSchema,
  lineAmount: amountSchema,
  currency: currencySchema,
  customerId: ulidSchema,
  customerName: z.string().min(1).max(200),
});

export const posCartSnapshotSchema = z.object({
  version: z.literal(2),
  checkoutId: ulidSchema,
  currency: currencySchema,
  customer: z
    .object({
      id: ulidSchema,
      name: z.string().min(1).max(200),
      accountName: z.string().max(200).nullable().optional(),
    })
    .nullable(),
  lines: z
    .array(z.discriminatedUnion("kind", [productLineSchema, ticketLineSchema]))
    .max(100),
  notes: z.string().max(2000),
  discountCode: z.string().max(120),
  discountReason: z.string().max(500),
  updatedAt: timestampSchema,
});

export const savePosCartBodySchema = z.object({
  cart: posCartSnapshotSchema,
});

export const parkPosCartBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  handoffNote: z.string().trim().max(500).nullable().optional(),
});

export const claimPosCartBodySchema = z.object({
  handoffNote: z.string().trim().max(500).nullable().optional(),
});

export const posCartParamsSchema = z.object({
  cartId: ulidSchema,
});

export const previewPosCartBodySchema = z.object({
  branchId: ulidSchema,
  customerId: ulidSchema.optional(),
  items: z.array(createManualOrderItemBodySchema).min(1).max(100),
  discountCode: z.string().trim().min(1).max(120).optional(),
  taxExemptionReason: z.string().trim().min(3).max(500).optional(),
});
