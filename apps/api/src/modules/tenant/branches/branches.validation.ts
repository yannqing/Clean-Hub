import { z } from "zod";
import {
  DEFAULT_POS_RECEIPT_FIELDS,
  DEFAULT_POS_TICKET_LABEL_FIELDS,
  POS_RECEIPT_FIELDS,
  POS_TICKET_LABEL_FIELDS,
} from "@cleanhub/domain/receipt";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export const branchStatusSchema = z.enum(["active", "inactive"]);
export const branchLanguageSchema = z.enum(["en", "fr", "zh-CN"]);

const nullableStringSchema = (max: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? null : value,
    z.string().trim().max(max).nullable().optional(),
  );

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const businessDayHoursSchema = z
  .object({
    opensAt: timeSchema,
    closesAt: timeSchema,
  })
  .strict()
  .refine((value) => value.opensAt < value.closesAt, {
    message: "Closing time must be later than opening time.",
    path: ["closesAt"],
  });
const businessHoursSchema = z
  .object({
    monday: businessDayHoursSchema.optional(),
    tuesday: businessDayHoursSchema.optional(),
    wednesday: businessDayHoursSchema.optional(),
    thursday: businessDayHoursSchema.optional(),
    friday: businessDayHoursSchema.optional(),
    saturday: businessDayHoursSchema.optional(),
    sunday: businessDayHoursSchema.optional(),
  })
  .strict()
  .nullable();
const branchLogoObjectKeySchema = z
  .string()
  .trim()
  .regex(
    /^tenant\/[0-9A-HJKMNP-TV-Z]{26}\/branch_logo\/unassigned\/[A-Za-z0-9._-]+$/,
  )
  .max(1024)
  .nullable();
const versionSchema = z.coerce.number().int().min(1);
const receiptFieldsSchema = z
  .array(z.enum(POS_RECEIPT_FIELDS))
  .min(1)
  .max(POS_RECEIPT_FIELDS.length)
  .transform((fields) => Array.from(new Set(fields)))
  .refine((fields) => fields.includes("merchant_name"), {
    message: "Merchant name is required on every receipt.",
  });
const ticketLabelFieldsSchema = z
  .array(z.enum(POS_TICKET_LABEL_FIELDS))
  .min(2)
  .max(POS_TICKET_LABEL_FIELDS.length)
  .transform((fields) => Array.from(new Set(fields)))
  .refine(
    (fields) => fields.includes("ticket_number") && fields.includes("item_name"),
    { message: "Ticket number and item name are required on every label." },
  );

const branchPaymentMethodSchema = z.enum(["cash", "card", "app"]);
const paymentMethodsEnabledSchema = z
  .array(branchPaymentMethodSchema)
  .min(1)
  .max(3)
  .transform((methods) => Array.from(new Set(methods)));
const cashHandlingModeSchema = z.enum([
  "none",
  "untracked",
  "shared_drawer",
  "cash_in_hand",
]);

export const branchListQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  status: branchStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const branchParamsSchema = z.object({
  branchId: z.string().regex(ULID_PATTERN),
});

const branchBodyBaseSchema = z.object({
  name: z.string().trim().min(1).max(200),
  address: nullableStringSchema(500),
  phone: nullableStringSchema(32),
  businessHours: businessHoursSchema.optional(),
  defaultLanguage: branchLanguageSchema.default("en"),
  receiptName: nullableStringSchema(200),
  receiptPhone: nullableStringSchema(32),
  receiptAddress: nullableStringSchema(500),
  receiptFields: receiptFieldsSchema.default([...DEFAULT_POS_RECEIPT_FIELDS]),
  ticketLabelFields: ticketLabelFieldsSchema.default([
    ...DEFAULT_POS_TICKET_LABEL_FIELDS,
  ]),
  paymentMethodsEnabled: paymentMethodsEnabledSchema.default(["cash", "app"]),
  defaultPaymentMethod: branchPaymentMethodSchema.default("cash"),
  cashHandlingMode: cashHandlingModeSchema.default("shared_drawer"),
  logoObjectKey: branchLogoObjectKeySchema.optional(),
  status: branchStatusSchema.default("active"),
});

export const createBranchBodySchema = branchBodyBaseSchema.refine(
  (data) => data.paymentMethodsEnabled.includes(data.defaultPaymentMethod),
  {
    message: "The default payment method must also be enabled.",
    path: ["defaultPaymentMethod"],
  },
);

export const updateBranchBodySchema = branchBodyBaseSchema
  .omit({ status: true })
  .partial()
  .extend({
    version: versionSchema,
  })
  .strict()
  .refine(
    (data) =>
      Object.entries(data).some(
        ([key, value]) => key !== "version" && value !== undefined,
      ),
    "At least one branch field must be provided.",
  )
  .refine(
    (data) =>
      !data.defaultPaymentMethod ||
      !data.paymentMethodsEnabled ||
      data.paymentMethodsEnabled.includes(data.defaultPaymentMethod),
    {
      message: "The default payment method must also be enabled.",
      path: ["defaultPaymentMethod"],
    },
  );

export const updateBranchStatusBodySchema = z.object({
  status: branchStatusSchema,
  version: versionSchema,
});

export const requestBranchLogoUploadBodySchema = z
  .object({
    contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(5 * 1_024 * 1_024),
  })
  .strict();
