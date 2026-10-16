import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { TenantDiscountsError } from "./discounts.errors.js";
import {
  createTenantDiscount,
  deleteTenantDiscount,
  getTenantDiscountDetail,
  getTenantDiscountListOptions,
  getTenantDiscountOptions,
  getTenantDiscountOverview,
  listTenantDiscounts,
  updateTenantDiscount,
  updateTenantDiscountStatus,
} from "./discounts.service.js";
import {
  createDiscountBodySchema,
  deleteDiscountBodySchema,
  discountListQuerySchema,
  discountParamsSchema,
  updateDiscountBodySchema,
  updateDiscountStatusBodySchema,
} from "./discounts.validation.js";

function requestMeta(c: Context<AppBindings>) {
  return {
    ipAddress:
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
  };
}

function errorResponse(c: Context<AppBindings>, error: TenantDiscountsError) {
  return c.json(
    {
      message: error.message,
      code: error.code,
      requestId: c.get("requestId"),
    },
    error.status,
  );
}

async function handleDiscountError<T>(
  c: Context<AppBindings>,
  operation: () => Promise<T>,
): Promise<T | ReturnType<typeof errorResponse>> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof TenantDiscountsError) {
      return errorResponse(c, error);
    }
    throw error;
  }
}

export async function getTenantDiscountOverviewController(
  c: Context<AppBindings>,
) {
  const result = await handleDiscountError(c, () =>
    getTenantDiscountOverview(c.get("authContext")),
  );
  return result instanceof Response ? result : c.json(result);
}

export async function listTenantDiscountsController(c: Context<AppBindings>) {
  const query = discountListQuerySchema.parse(c.req.query());
  const result = await handleDiscountError(c, () =>
    listTenantDiscounts(c.get("authContext"), query),
  );
  return result instanceof Response ? result : c.json(result);
}

export async function getTenantDiscountOptionsController(
  c: Context<AppBindings>,
) {
  const result = await handleDiscountError(c, () =>
    getTenantDiscountOptions(c.get("authContext")),
  );
  return result instanceof Response ? result : c.json(result);
}

export async function getTenantDiscountListOptionsController(
  c: Context<AppBindings>,
) {
  const result = await handleDiscountError(c, () =>
    getTenantDiscountListOptions(c.get("authContext")),
  );
  return result instanceof Response ? result : c.json(result);
}

export async function getTenantDiscountController(c: Context<AppBindings>) {
  const { discountId } = discountParamsSchema.parse(c.req.param());
  const result = await handleDiscountError(c, () =>
    getTenantDiscountDetail(c.get("authContext"), discountId),
  );
  return result instanceof Response ? result : c.json(result);
}

export async function createTenantDiscountController(c: Context<AppBindings>) {
  const data = createDiscountBodySchema.parse(
    await c.req.json().catch(() => ({})),
  );
  const result = await handleDiscountError(c, () =>
    createTenantDiscount({
      authContext: c.get("authContext"),
      data,
      requestMeta: requestMeta(c),
    }),
  );
  return result instanceof Response ? result : c.json(result, 201);
}

export async function updateTenantDiscountController(c: Context<AppBindings>) {
  const { discountId } = discountParamsSchema.parse(c.req.param());
  const data = updateDiscountBodySchema.parse(
    await c.req.json().catch(() => ({})),
  );
  const result = await handleDiscountError(c, () =>
    updateTenantDiscount(discountId, {
      authContext: c.get("authContext"),
      data,
      requestMeta: requestMeta(c),
    }),
  );
  return result instanceof Response ? result : c.json(result);
}

export async function updateTenantDiscountStatusController(
  c: Context<AppBindings>,
) {
  const { discountId } = discountParamsSchema.parse(c.req.param());
  const data = updateDiscountStatusBodySchema.parse(
    await c.req.json().catch(() => ({})),
  );
  const result = await handleDiscountError(c, () =>
    updateTenantDiscountStatus(discountId, {
      authContext: c.get("authContext"),
      data,
      requestMeta: requestMeta(c),
    }),
  );
  return result instanceof Response ? result : c.json(result);
}

export async function deleteTenantDiscountController(c: Context<AppBindings>) {
  const { discountId } = discountParamsSchema.parse(c.req.param());
  const data = deleteDiscountBodySchema.parse(
    await c.req.json().catch(() => ({})),
  );
  const result = await handleDiscountError(c, () =>
    deleteTenantDiscount(discountId, {
      authContext: c.get("authContext"),
      data,
      requestMeta: requestMeta(c),
    }),
  );
  return result instanceof Response ? result : c.body(null, 204);
}
