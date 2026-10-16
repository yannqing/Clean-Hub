import type { Context } from "hono";
import { z } from "zod";

import { getRequestMeta } from "../../../http/request-meta.js";
import type { AppBindings } from "../../../http/types.js";
import {
  ApplyTaxTemplateError,
  applyTenantTaxTemplate,
  listAvailableTaxTemplates,
} from "./tax-template.service.js";

const applySchema = z.object({
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  templateVersion: z.number().int().positive(),
  settingsVersion: z.number().int().min(0),
}).strict();

export async function listTaxTemplatesController(c: Context<AppBindings>) {
  return c.json({ data: await listAvailableTaxTemplates(c.get("authContext")) });
}

export async function applyTaxTemplateController(c: Context<AppBindings>) {
  const data = applySchema.parse(await c.req.json());
  try {
    return c.json(await applyTenantTaxTemplate({
      authContext: c.get("authContext"),
      ...data,
      requestMeta: getRequestMeta(c),
    }));
  } catch (error) {
    if (error instanceof ApplyTaxTemplateError) {
      return c.json({
        code: error.code,
        message: error.message,
        requestId: c.get("requestId"),
      }, error.status);
    }
    throw error;
  }
}
