import { z } from "zod";

import {
  serviceBusinessLineSchema,
  serviceStatusSchema,
} from "../services/services.validation.js";

export const serviceCategoryListQuerySchema = z.object({
  businessLine: serviceBusinessLineSchema.optional(),
  status: serviceStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});
