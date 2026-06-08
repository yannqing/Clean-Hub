import type { Context } from "hono";

import type { AppBindings } from "../../http/types.js";
import { TenantPricesError } from "./prices.errors.js";
import {
  listTenantPrices,
  updateTenantPrice,
} from "./prices.service.js";
import {
  priceListQuerySchema,
  priceParamsSchema,
  updatePriceBodySchema,
} from "./prices.validation.js";

function getClientIp(c: Context<AppBindings>): string | undefined {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip")
  );
}

function createTenantPricesErrorResponse(
  c: Context<AppBindings>,
  error: TenantPricesError,
) {
  return c.json(
    {
      message: error.message,
      code: error.code,
      requestId: c.get("requestId"),
    },
    error.status,
  );
}

export async function listTenantPricesController(c: Context<AppBindings>) {
  const query = priceListQuerySchema.parse(c.req.query());
  const prices = await listTenantPrices(c.get("authContext"), query);

  return c.json(prices);
}

export async function updateTenantPriceController(c: Context<AppBindings>) {
  const params = priceParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = updatePriceBodySchema.parse(rawBody);

  try {
    const price = await updateTenantPrice(
      c.get("authContext"),
      params.priceId,
      data,
      {
        ipAddress: getClientIp(c),
        userAgent: c.req.header("user-agent"),
      },
    );

    return c.json(price);
  } catch (error) {
    if (error instanceof TenantPricesError) {
      return createTenantPricesErrorResponse(c, error);
    }

    throw error;
  }
}
