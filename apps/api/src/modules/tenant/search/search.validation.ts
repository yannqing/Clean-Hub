import { z } from "zod";

export const tenantGlobalSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(10).default(5),
});
