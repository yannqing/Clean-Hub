import type { Context } from "hono";

import { getRequestMeta } from "../../../http/request-meta.js";
import type { AppBindings } from "../../../http/types.js";
import { TenantTaxRateError } from "./tax-rates.errors.js";
import {
  createTenantTaxRate,
  deleteTenantTaxRate,
  listTenantTaxRates,
  updateTenantTaxRate,
} from "./tax-rates.service.js";
import {
  createTaxRateBodySchema,
  taxRateListQuerySchema,
  taxRateParamsSchema,
  updateTaxRateBodySchema,
} from "./tax-rates.validation.js";

function createErrorResponse(c: Context<AppBindings>, error: TenantTaxRateError) {
  return c.json(
    { message: error.message, code: error.code, requestId: c.get("requestId") },
    error.status,
  );
}

async function handle(
  c: Context<AppBindings>,
  operation: () => Promise<Response>,
): Promise<Response> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof TenantTaxRateError) return createErrorResponse(c, error);
    throw error;
  }
}

export function listTenantTaxRatesController(c: Context<AppBindings>) {
  const query = taxRateListQuerySchema.parse(c.req.query());
  return handle(c, async () =>
    c.json(await listTenantTaxRates(c.get("authContext"), query)),
  );
}

export async function createTenantTaxRateController(c: Context<AppBindings>) {
  const data = createTaxRateBodySchema.parse(await c.req.json());
  return handle(c, async () =>
    c.json(
      await createTenantTaxRate({
        authContext: c.get("authContext"),
        data,
        requestMeta: getRequestMeta(c),
      }),
      201,
    ),
  );
}

export async function updateTenantTaxRateController(c: Context<AppBindings>) {
  const { taxRateId } = taxRateParamsSchema.parse(c.req.param());
  const data = updateTaxRateBodySchema.parse(await c.req.json());
  return handle(c, async () =>
    c.json(
      await updateTenantTaxRate({
        authContext: c.get("authContext"),
        taxRateId,
        data,
        requestMeta: getRequestMeta(c),
      }),
    ),
  );
}

export function deleteTenantTaxRateController(c: Context<AppBindings>) {
  const { taxRateId } = taxRateParamsSchema.parse(c.req.param());
  return handle(c, async () => {
    await deleteTenantTaxRate({
      authContext: c.get("authContext"),
      taxRateId,
      data: null,
      requestMeta: getRequestMeta(c),
    });
    return c.body(null, 204);
  });
}
