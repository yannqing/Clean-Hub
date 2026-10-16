import { z } from "zod";

import { isCashRoundingStep } from "@cleanhub/domain/currency";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

const ulidSchema = z.string().regex(ULID_PATTERN);

export const posOrderStatusSchema = z.enum([
  "draft",
  "received",
  "paid",
  "delivered",
  "cancelled",
]);

export const posOrderPaymentStatusSchema = z.enum([
  "unpaid",
  "paid",
  "partial",
  "refunded",
]);

export const posOrderTypeSchema = z.enum(["ticket", "manual"]);

export const posOrderSortSchema = z.enum([
  "created_desc",
  "created_asc",
  "amount_desc",
  "amount_asc",
]);

export const posOrderItemSourceTypeSchema = z.enum([
  "subscription",
  "delivery_fee",
  "product",
]);

export const posPaymentMethodSchema = z.enum(["cash", "card", "app"]);

export const posMobileMoneyProviderSchema = z.enum(["wave", "orange_money"]);

const amountSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Amount must be a decimal with up to 2 places.")
  .refine((value) => Number(value) > 0, "Amount must be greater than zero.");

const nonnegativeAmountSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Amount must be a decimal with up to 2 places.");

const quantitySchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,3})?$/, "Quantity must be a decimal with up to 3 places.")
  .refine((value) => Number(value) > 0, "Quantity must be greater than zero.");

const weightSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,3})?$/, "Weight must be a decimal with up to 3 places.")
  .refine((value) => Number(value) > 0, "Weight must be greater than zero.");

const isoTimestampSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => !Number.isNaN(Date.parse(value)),
    "Invalid ISO timestamp.",
  );

const statusFilterSchema = z
  .union([posOrderStatusSchema, z.array(posOrderStatusSchema)])
  .transform((value) => (Array.isArray(value) ? value : [value]));

export const posOrderListQuerySchema = z.object({
  status: statusFilterSchema.optional(),
  paymentStatus: posOrderPaymentStatusSchema.optional(),
  orderType: posOrderTypeSchema.optional(),
  customerId: ulidSchema.optional(),
  branchId: ulidSchema.optional(),
  q: z.string().trim().min(1).max(120).optional(),
  createdAfter: isoTimestampSchema.optional(),
  createdBefore: isoTimestampSchema.optional(),
  sort: posOrderSortSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const posOrderParamsSchema = z.object({
  orderId: ulidSchema,
});

export const posOrderItemParamsSchema = z.object({
  orderId: ulidSchema,
  itemId: ulidSchema,
});

const manualOrderItemFields = {
  quantity: quantitySchema.optional(),
  weight: weightSchema.optional(),
  bagCount: z.coerce.number().int().min(1).max(9999).optional(),
  chargedUnitAmount: amountSchema.optional(),
  overrideReason: z.string().trim().min(1).max(500).optional(),
  itemColor: z.string().trim().max(40).optional(),
  defectNotes: z.string().trim().max(2000).optional(),
  specialRequest: z.string().trim().max(2000).optional(),
  itemIdentifier: z.string().trim().max(64).optional(),
};

const createCatalogOrderItemBodySchema = z.union([
  z.object({
    ...manualOrderItemFields,
    serviceId: ulidSchema,
    productSkuId: z.never().optional(),
    ticketId: z.never().optional(),
    ticketItemId: z.never().optional(),
  }),
  z.object({
    ...manualOrderItemFields,
    serviceId: z.never().optional(),
    productSkuId: ulidSchema,
    ticketId: z.never().optional(),
    ticketItemId: z.never().optional(),
  }),
]);

export const createManualOrderItemBodySchema = z.union([
  createCatalogOrderItemBodySchema,
  z.object({
    serviceId: z.never().optional(),
    productSkuId: z.never().optional(),
    ticketId: ulidSchema,
    ticketItemId: ulidSchema,
  }),
]);

export const createPosOrderBodySchema = z.discriminatedUnion("orderType", [
  z.object({
    id: ulidSchema.optional(),
    orderType: z.literal("ticket"),
    ticketId: ulidSchema,
    ticketItemIds: z.array(ulidSchema).min(1).max(100).optional(),
    expireAt: isoTimestampSchema.nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  }),
  z
    .object({
      id: ulidSchema.optional(),
      orderType: z.literal("manual"),
      branchId: ulidSchema,
      customerId: ulidSchema.optional(),
      items: z.array(createManualOrderItemBodySchema).min(1).max(100),
      expireAt: isoTimestampSchema.nullable().optional(),
      notes: z.string().trim().max(2000).nullable().optional(),
      discountCode: z.string().trim().min(1).max(120).optional(),
      discountReason: z.string().trim().min(1).max(500).optional(),
      discountIdempotencyKey: z.string().trim().min(1).max(120).optional(),
    })
    .refine(
      (value) =>
        !value.discountCode ||
        Boolean(value.discountReason && value.discountIdempotencyKey),
      "A reason and idempotency key are required when applying a discount code.",
    ),
]);

export const updatePosOrderBodySchema = z
  .object({
    orderType: posOrderTypeSchema.optional(),
    expireAt: isoTimestampSchema.nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    version: z.number().int().min(1),
  })
  .refine(
    (value) =>
      value.orderType !== undefined ||
      value.expireAt !== undefined ||
      value.notes !== undefined,
    "At least one order field must be provided.",
  );

export const changePosOrderStatusBodySchema = z.object({
  to: posOrderStatusSchema,
  note: z.string().trim().max(2000).optional(),
  reason: z.string().trim().min(1).max(500).optional(),
  version: z.number().int().min(1),
});

const sensitiveOperationReasonSchema = z.string().trim().min(1).max(500);

export const deletePosOrderBodySchema = z.object({
  reason: sensitiveOperationReasonSchema,
});

const idempotencyKeySchema = z.string().trim().min(1).max(120);

export const createPosPaymentBodySchema = z
  .discriminatedUnion("paymentMethod", [
    z.object({
      paymentMethod: z.literal("cash"),
      amount: amountSchema,
      tenderedAmount: amountSchema,
      shiftId: ulidSchema.optional(),
      registerSessionId: ulidSchema.optional(),
      cashDrawerSessionId: ulidSchema.optional(),
      occurredAt: isoTimestampSchema,
      idempotencyKey: idempotencyKeySchema,
    }),
    z.object({
      paymentMethod: z.literal("card"),
      amount: amountSchema,
      idempotencyKey: idempotencyKeySchema,
    }),
    z.object({
      paymentMethod: z.literal("app"),
      amount: amountSchema,
      provider: posMobileMoneyProviderSchema,
      externalReference: z.string().trim().min(3).max(120),
      idempotencyKey: idempotencyKeySchema,
    }),
  ])
  .superRefine((value, context) => {
    if (
      value.paymentMethod === "cash" &&
      Number(value.tenderedAmount) < Number(value.amount)
    ) {
      context.addIssue({
        code: "custom",
        message: "Tendered cash must cover the payment amount.",
        path: ["tenderedAmount"],
      });
    }
  });

const createPosCheckoutPaymentBodySchema = z.discriminatedUnion(
  "paymentMethod",
  [
    z.object({
      paymentMethod: z.literal("cash"),
      amount: amountSchema.optional(),
      tenderedAmount: amountSchema,
      shiftId: ulidSchema.optional(),
      registerSessionId: ulidSchema.optional(),
      cashDrawerSessionId: ulidSchema.optional(),
      occurredAt: isoTimestampSchema,
      idempotencyKey: idempotencyKeySchema,
    }),
    z.object({
      paymentMethod: z.literal("card"),
      amount: amountSchema.optional(),
      idempotencyKey: idempotencyKeySchema,
    }),
    z.object({
      paymentMethod: z.literal("app"),
      amount: amountSchema.optional(),
      provider: posMobileMoneyProviderSchema,
      externalReference: z.string().trim().min(3).max(120),
      idempotencyKey: idempotencyKeySchema,
    }),
  ],
);

export const createPosCheckoutBodySchema = z
  .object({
    order: createPosOrderBodySchema,
    expectedTotalAmount: nonnegativeAmountSchema,
    payment: createPosCheckoutPaymentBodySchema.optional(),
    payments: z
      .array(createPosCheckoutPaymentBodySchema)
      .min(1)
      .max(4)
      .optional(),
    settlementIntent: z.enum(["pay_now", "partial", "pay_later"]),
    balanceDueAt: isoTimestampSchema.optional(),
    unpaidReason: z.string().trim().min(3).max(500).optional(),
    taxExemptionReason: z.string().trim().min(3).max(500).optional(),
    /**
     * Cashier chose to round the cash total down, because the till cannot make
     * exact change. Kept for payloads that predate `cashRoundingStep`,
     * including offline sales queued before the upgrade: on its own it means
     * "use the branch's configured note".
     */
    cashRoundingApplied: z.boolean().optional(),
    /**
     * The denomination the cashier picked for this sale, in major units.
     *
     * Constrained to the shared allowlist: the server derives the concession
     * from this step, so the cashier never posts an amount of their own. A
     * free-form deduction would be a manual discount, which has to carry a
     * reason and an idempotency key.
     */
    cashRoundingStep: z
      .number()
      .int()
      .refine(isCashRoundingStep, "Choose an offered cash rounding step.")
      .optional(),
  })
  .superRefine((value, context) => {
    if (value.payment && value.payments) {
      context.addIssue({
        code: "custom",
        message: "Use either payment or payments, not both.",
        path: ["payments"],
      });
    }
    if (value.payments?.some((payment) => payment.amount === undefined)) {
      context.addIssue({
        code: "custom",
        message: "Every payment in a mixed tender must include an amount.",
        path: ["payments"],
      });
    }
    const keys = (value.payments ?? (value.payment ? [value.payment] : [])).map(
      (payment) => payment.idempotencyKey,
    );
    if (new Set(keys).size !== keys.length) {
      context.addIssue({
        code: "custom",
        message: "Payment idempotency keys must be unique within checkout.",
        path: ["payments"],
      });
    }
    if (value.settlementIntent !== "pay_now") {
      if (!value.balanceDueAt) {
        context.addIssue({
          code: "custom",
          message: "A balance due date is required for deferred payment.",
          path: ["balanceDueAt"],
        });
      }
      if (!value.unpaidReason) {
        context.addIssue({
          code: "custom",
          message: "A reason is required for deferred payment.",
          path: ["unpaidReason"],
        });
      }
    }
  });

export const recordPosCardPaymentOutcomeBodySchema = z
  .object({
    outcome: z.enum(["succeeded", "failed", "cancelled", "timed_out"]),
    externalReference: z.string().trim().min(1).max(120).optional(),
    authorizationCode: z.string().trim().min(1).max(120).optional(),
    failureCode: z.string().trim().min(1).max(80).optional(),
    failureReason: z.string().trim().min(1).max(500).optional(),
    providerPayload: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((value, context) => {
    if (value.outcome === "succeeded" && !value.externalReference) {
      context.addIssue({
        code: "custom",
        message: "A successful card payment requires the TPE reference.",
        path: ["externalReference"],
      });
    }
    if (value.outcome !== "succeeded" && !value.failureReason) {
      context.addIssue({
        code: "custom",
        message: "A non-successful card result requires a reason.",
        path: ["failureReason"],
      });
    }
  });

export const resolvePosPaymentBodySchema = z.object({
  reason: z.string().trim().min(3).max(500).optional(),
});

export const failPosPaymentBodySchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const posPaymentParamsSchema = posOrderParamsSchema.extend({
  paymentId: ulidSchema,
});

export const createPosOrderItemBodySchema = createCatalogOrderItemBodySchema;

export const updatePosOrderItemBodySchema = z
  .object({
    serviceId: ulidSchema.optional(),
    productSkuId: ulidSchema.optional(),
    quantity: quantitySchema.optional(),
    weight: weightSchema.optional(),
    bagCount: z.coerce.number().int().min(1).max(9999).optional(),
    chargedUnitAmount: amountSchema.optional(),
    overrideReason: sensitiveOperationReasonSchema.optional(),
    itemColor: z.string().trim().max(40).nullable().optional(),
    defectNotes: z.string().trim().max(2000).nullable().optional(),
    specialRequest: z.string().trim().max(2000).nullable().optional(),
    itemIdentifier: z.string().trim().max(64).nullable().optional(),
    version: z.number().int().min(1),
  })
  .refine(
    (value) =>
      value.serviceId !== undefined ||
      value.productSkuId !== undefined ||
      value.quantity !== undefined ||
      value.weight !== undefined ||
      value.bagCount !== undefined ||
      value.chargedUnitAmount !== undefined ||
      value.itemColor !== undefined ||
      value.defectNotes !== undefined ||
      value.specialRequest !== undefined ||
      value.itemIdentifier !== undefined,
    "At least one item field must be provided.",
  )
  .refine(
    (value) =>
      value.serviceId === undefined || value.productSkuId === undefined,
    "An order item cannot reference both a service and a product.",
  );

export const deletePosOrderItemBodySchema = z.object({
  reason: sensitiveOperationReasonSchema,
});

export const posOrderOverviewQuerySchema = z.object({
  period: z.enum(["all", "today", "week", "month"]).default("today"),
  branchId: ulidSchema.optional(),
  createdAfter: isoTimestampSchema.optional(),
  createdBefore: isoTimestampSchema.optional(),
});
