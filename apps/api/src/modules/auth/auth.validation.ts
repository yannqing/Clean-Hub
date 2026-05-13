import { z } from "zod";

export const loginRequestSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
  tenantCode: z.string().trim().min(1).optional(),
  deviceId: z.string().trim().min(1).optional(),
});

export type LoginRequestBody = z.infer<typeof loginRequestSchema>;
