import type { Context } from "hono";

import type { AppBindings } from "../../http/types.js";
import { TenantPricesError } from "./prices.errors.js";
import {
  createTenantPriceBook,
  deleteTenantPriceBook,
  listTenantPriceBooks,
  updateTenantPriceBook,
} from "./prices.service.js";
import {
  createPriceBookBodySchema,
  priceBookListQuerySchema,
  priceBookParamsSchema,
  updatePriceBookBodySchema,
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

export async function listTenantPriceBooksController(c: Context<AppBindings>) {
  const query = priceBookListQuerySchema.parse(c.req.query());
  const priceBooks = await listTenantPriceBooks(c.get("authContext"), query);

  return c.json(priceBooks);
}

export async function createTenantPriceBookController(c: Context<AppBindings>) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = createPriceBookBodySchema.parse(rawBody);

  try {
    const priceBook = await createTenantPriceBook(c.get("authContext"), data, {
      ipAddress: getClientIp(c),
      userAgent: c.req.header("user-agent"),
    });

    return c.json(priceBook, 201);
  } catch (error) {
    if (error instanceof TenantPricesError) {
      return createTenantPricesErrorResponse(c, error);
    }

    throw error;
  }
}

export async function updateTenantPriceBookController(c: Context<AppBindings>) {
  const params = priceBookParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = updatePriceBookBodySchema.parse(rawBody);

  try {
    const priceBook = await updateTenantPriceBook(
      c.get("authContext"),
      params.priceBookId,
      data,
      {
        ipAddress: getClientIp(c),
        userAgent: c.req.header("user-agent"),
      },
    );

    return c.json(priceBook);
  } catch (error) {
    if (error instanceof TenantPricesError) {
      return createTenantPricesErrorResponse(c, error);
    }

    throw error;
  }
}

export async function deleteTenantPriceBookController(c: Context<AppBindings>) {
  const params = priceBookParamsSchema.parse(c.req.param());

  try {
    await deleteTenantPriceBook(c.get("authContext"), params.priceBookId, {
      ipAddress: getClientIp(c),
      userAgent: c.req.header("user-agent"),
    });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof TenantPricesError) {
      return createTenantPricesErrorResponse(c, error);
    }

    throw error;
  }
}
