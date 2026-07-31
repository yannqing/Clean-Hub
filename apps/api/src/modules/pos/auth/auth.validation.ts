import { z } from "zod";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const deviceIdSchema = z.string().trim().min(1).max(128);
const reasonSchema = z.string().trim().min(1).max(500);

export const bindPosDeviceBodySchema = z.object({
  deviceId: deviceIdSchema,
  label: z.string().trim().min(1).max(64),
  branchId: z.string().regex(ULID_PATTERN),
});

export const updatePosDeviceBodySchema = z
  .object({
    branchId: z.string().regex(ULID_PATTERN).optional(),
    label: z.string().trim().min(1).max(64).optional(),
    status: z.enum(["active", "inactive"]).optional(),
    reason: reasonSchema,
  })
  .refine(
    ({ branchId, label, status }) =>
      branchId !== undefined || label !== undefined || status !== undefined,
    "At least one terminal field must be provided.",
  );

export const rotatePosDeviceCredentialBodySchema = z.object({
  reason: reasonSchema,
});

export const revokePosDeviceBodySchema = z.object({
  reason: reasonSchema,
});

export const setTerminalLockBodySchema = z.object({
  lockState: z.enum(["locked", "unlocked"]),
  reason: reasonSchema,
});
