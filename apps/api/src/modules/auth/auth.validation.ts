import { z } from "zod";

export const loginRequestSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
  tenantCode: z.string().trim().min(1).optional(),
  deviceId: z.string().trim().min(1).optional(),
});

export const posPinLoginRequestSchema = z.object({
  pin: z.string().regex(/^\d{4,8}$/),
  tenantCode: z.string().trim().min(1),
  deviceId: z.string().trim().min(1),
});

export type LoginRequestBody = z.infer<typeof loginRequestSchema>;
export type PosPinLoginRequestBody = z.infer<typeof posPinLoginRequestSchema>;
