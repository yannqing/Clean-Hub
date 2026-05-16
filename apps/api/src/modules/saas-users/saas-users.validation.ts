import { z } from "zod";

export const listSaasUsersQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  status: z.enum(["invited", "active", "disabled", "suspended"]).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
