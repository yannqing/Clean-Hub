import { z } from "zod";

const ulidSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);

export const listHardwareConfigsQuerySchema = z.object({
  branchId: ulidSchema.optional(),
  deviceType: z.enum(["printer", "scanner", "cash_drawer"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
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
    branchId: ulidSchema.optional(),
    connectionType: z.enum(["usb", "bluetooth", "network", "other"]).optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    status: z.enum(["active", "inactive"]).optional(),
    version: z.number().int().positive(),
  })
  .refine(
    (data) => Object.keys(data).some((key) => key !== "version"),
    { message: "At least one field must be provided." },
  );

export const deleteHardwareConfigBodySchema = z.object({
  version: z.number().int().positive(),
});
