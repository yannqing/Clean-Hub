import { z } from "zod";

const ulidSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);

export const listHardwareConfigsQuerySchema = z.object({
  branchId: ulidSchema.optional(),
  deviceType: z.enum(["printer", "scanner", "cash_drawer"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const hardwareConfigParamsSchema = z.object({
  hardwareId: ulidSchema,
});

export const createHardwareConfigBodySchema = z.object({
  branchId: ulidSchema,
  name: z.string().trim().min(1).max(200),
  deviceType: z.enum(["printer", "scanner", "cash_drawer"]),
  connectionType: z.enum(["usb", "bluetooth", "network", "other"]),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const updateHardwareConfigBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    connectionType: z.enum(["usb", "bluetooth", "network", "other"]).optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: "At least one field must be provided." },
  );
