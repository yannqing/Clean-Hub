import { PIN_DIGIT_PATTERN } from "@cleanhub/domain/pin";
import { z } from "zod";

export const loginRequestSchema = z.object({
  identifier: z.string().trim().email().max(320),
  password: z.string().min(1),
  deviceId: z.string().trim().min(1).optional(),
});

export const posPinLoginRequestSchema = z.object({
  pin: z.string().regex(PIN_DIGIT_PATTERN, "PIN must be exactly 6 digits."),
  deviceId: z.string().trim().min(1),
});

export const posBootstrapRequestSchema = z.object({
  deviceId: z.string().trim().min(1).max(128),
});

export type LoginRequestBody = z.infer<typeof loginRequestSchema>;
export type PosPinLoginRequestBody = z.infer<typeof posPinLoginRequestSchema>;
export type PosBootstrapRequestBody = z.infer<typeof posBootstrapRequestSchema>;
