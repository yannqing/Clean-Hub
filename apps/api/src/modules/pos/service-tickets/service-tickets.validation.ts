import { z } from "zod";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export const serviceTicketTypeSchema = z.enum([
  "laundry",
  "car_wash",
  "retail",
  "delivery",
]);

export const serviceTicketStatusSchema = z.enum([
  "draft",
  "pending",
  "in_progress",
  "ready_to_pick",
  "picked_up",
  "cancelled",
  "exception",
]);

export const serviceTicketPrioritySchema = z.enum([
  "normal",
  "urgent",
  "critical",
]);

export const serviceTicketSourceChannelSchema = z.enum([
  "pos",
  "app",
  "phone",
  "whatsapp",
]);

export const serviceTicketItemTypeSchema = z.enum([
  "cloth",
  "car",
  "shoe",
  "carpet",
]);

export const serviceTicketItemStatusSchema = z.enum([
  "pending_wash",
  "washing",
  "done",
  "ready_to_pick",
  "exception",
]);

/**
 * Money / quantity input. Drizzle stores amounts as numeric(12,2); the API
 * accepts a string to avoid floating-point loss, matching the existing
 * `pos/orders` client convention.
 */
const amountSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Amount must be a decimal with up to 2 places.");

const weightSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,3})?$/, "Weight must be a decimal with up to 3 places.")
  .refine((value) => Number(value) > 0, "Weight must be greater than zero.");

const optionalUlid = z.string().regex(ULID_PATTERN);

const isoTimestampSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid ISO timestamp.");

// `status` accepts a single value or a repeated query param (?status=a&status=b).
const statusFilterSchema = z
  .union([serviceTicketStatusSchema, z.array(serviceTicketStatusSchema)])
  .transform((value) => (Array.isArray(value) ? value : [value]));

export const serviceTicketListQuerySchema = z.object({
  status: statusFilterSchema.optional(),
  priority: serviceTicketPrioritySchema.optional(),
  ticketType: serviceTicketTypeSchema.optional(),
  sourceChannel: serviceTicketSourceChannelSchema.optional(),
  customerId: optionalUlid.optional(),
  branchId: optionalUlid.optional(),
  assistantId: optionalUlid.optional(),
  q: z.string().trim().min(1).max(120).optional(),
  createdBefore: isoTimestampSchema.optional(),
  createdAfter: isoTimestampSchema.optional(),
  expectedPickupBefore: isoTimestampSchema.optional(),
  expectedPickupAfter: isoTimestampSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const serviceTicketParamsSchema = z.object({
  ticketId: z.string().regex(ULID_PATTERN),
});

export const serviceTicketItemParamsSchema = z.object({
  ticketId: z.string().regex(ULID_PATTERN),
  itemId: z.string().regex(ULID_PATTERN),
});

export const createServiceTicketBodySchema = z.object({
  customerId: z.string().regex(ULID_PATTERN),
  branchId: z.string().regex(ULID_PATTERN),
  ticketType: serviceTicketTypeSchema,
  priority: serviceTicketPrioritySchema.default("normal"),
  sourceChannel: serviceTicketSourceChannelSchema.default("pos"),
  expectedPickupAt: isoTimestampSchema.nullable().optional(),
  remark: z.string().trim().max(2000).optional(),
});

export const updateServiceTicketBodySchema = z
  .object({
    ticketType: serviceTicketTypeSchema.optional(),
    priority: serviceTicketPrioritySchema.optional(),
    sourceChannel: serviceTicketSourceChannelSchema.optional(),
    assistantId: optionalUlid.nullable().optional(),
    expectedPickupAt: isoTimestampSchema.nullable().optional(),
    remark: z.string().trim().max(2000).nullable().optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one ticket field must be provided.",
  );

export const changeServiceTicketStatusBodySchema = z
  .object({
    to: serviceTicketStatusSchema,
    note: z.string().trim().max(2000).optional(),
    reason: z.string().trim().min(1).max(500).optional(),
    version: z.number().int().min(1),
  })
  .superRefine((value, context) => {
    if (value.to === "cancelled" && !value.reason) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "A reason is required when cancelling a ticket.",
      });
    }
  });

export const createServiceTicketItemBodySchema = z.object({
  serviceId: z.string().regex(ULID_PATTERN),
  itemType: serviceTicketItemTypeSchema.optional(),
  itemCategory: z.string().trim().max(80).optional(),
  itemColor: z.string().trim().max(40).optional(),
  itemBrand: z.string().trim().max(80).optional(),
  itemMaterial: z.string().trim().max(80).optional(),
  quantity: z.coerce.number().int().min(1).max(9999).optional(),
  weight: weightSchema.optional(),
  bagCount: z.coerce.number().int().min(1).max(9999).optional(),
  chargedUnitAmount: amountSchema.optional(),
  overrideReason: z.string().trim().min(1).max(500).optional(),
  defectNotes: z.string().trim().max(2000).optional(),
  specialRequest: z.string().trim().max(2000).optional(),
  remark: z.string().trim().max(2000).optional(),
  sortOrder: z.number().int().min(0).max(99999).optional(),
});

export const updateServiceTicketItemBodySchema = z
  .object({
    serviceId: z.string().regex(ULID_PATTERN).optional(),
    itemType: serviceTicketItemTypeSchema.optional(),
    itemCategory: z.string().trim().max(80).nullable().optional(),
    itemColor: z.string().trim().max(40).nullable().optional(),
    itemBrand: z.string().trim().max(80).nullable().optional(),
    itemMaterial: z.string().trim().max(80).nullable().optional(),
    quantity: z.coerce.number().int().min(1).max(9999).optional(),
    weight: weightSchema.nullable().optional(),
    bagCount: z.coerce.number().int().min(1).max(9999).nullable().optional(),
    chargedUnitAmount: amountSchema.optional(),
    overrideReason: z.string().trim().min(1).max(500).optional(),
    defectNotes: z.string().trim().max(2000).nullable().optional(),
    specialRequest: z.string().trim().max(2000).nullable().optional(),
    remark: z.string().trim().max(2000).nullable().optional(),
    sortOrder: z.number().int().min(0).max(99999).optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one item field must be provided.",
  )
  ;

export const changeServiceTicketItemStatusBodySchema = z.object({
  to: serviceTicketItemStatusSchema,
});

export const serviceTicketOverviewQuerySchema = z.object({
  branchId: optionalUlid.optional(),
});

export const serviceTicketDeleteQuerySchema = z.object({
  reason: z.string().trim().min(1).max(500),
});
