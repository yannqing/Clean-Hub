import { z } from "zod";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export const posCatalogQuerySchema = z.object({
  branchId: z.string().regex(ULID_PATTERN).optional(),
  businessLine: z
    .enum(["laundry", "car_wash", "retail", "delivery"])
    .optional(),
  q: z.string().trim().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
