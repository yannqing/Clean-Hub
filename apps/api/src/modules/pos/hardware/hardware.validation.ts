import { z } from "zod";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const reasonSchema = z.string().trim().min(1).max(500);

export const posHardwareDeviceParamsSchema = z.object({
  hardwareId: z.string().regex(ULID_PATTERN),
});

export const bindPosPrinterBodySchema = z.object({
  printerId: z.string().trim().min(1).max(256),
  printerName: z.string().trim().min(1).max(256),
  isDefault: z.boolean().optional(),
  version: z.number().int().positive(),
}).strict();

export const authorizeManualDrawerOpenBodySchema = z.object({
  reason: reasonSchema,
});

export const authorizePrivilegedReprintBodySchema = z.object({
  reason: reasonSchema,
  documentType: z.enum(["receipt", "label"]),
  entityId: z.string().regex(ULID_PATTERN).optional(),
  originalPrintJobId: z.string().trim().min(1).max(128).optional(),
});

export const recordPosPrintJobResultBodySchema = z.object({
  jobId: z.string().regex(ULID_PATTERN),
  documentType: z.enum(["receipt", "label"]),
  entityId: z.string().regex(ULID_PATTERN),
  status: z.enum(["printed", "failed"]),
  attempt: z.number().int().positive(),
  error: z.string().trim().min(1).max(1_000).optional(),
  authorizationId: z.string().regex(ULID_PATTERN).optional(),
  originalPrintJobId: z.string().regex(ULID_PATTERN).optional(),
});

export const recordCashPaymentDrawerResultBodySchema = z
  .object({
    paymentId: z.string().regex(ULID_PATTERN),
    status: z.enum(["opened", "failed"]),
    attempt: z.number().int().positive().max(100),
    printerId: z.string().trim().min(1).max(256).optional(),
    error: z.string().trim().min(1).max(1_000).optional(),
  })
  .superRefine((value, context) => {
    if (value.status === "failed" && !value.error) {
      context.addIssue({
        code: "custom",
        path: ["error"],
        message: "A failure reason is required.",
      });
    }
    if (value.status === "opened" && value.error) {
      context.addIssue({
        code: "custom",
        path: ["error"],
        message: "A successful drawer result cannot include an error.",
      });
    }
  });
