import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { PosOrderError } from "../orders/orders.errors.js";
import {
  clearCurrentPosCart,
  claimParkedCart,
  getCurrentPosCart,
  listParkedCarts,
  parkCurrentPosCart,
  previewCurrentPosCart,
  saveCurrentPosCart,
} from "./carts.service.js";
import {
  previewPosCartBodySchema,
  claimPosCartBodySchema,
  parkPosCartBodySchema,
  posCartParamsSchema,
  savePosCartBodySchema,
} from "./carts.validation.js";
import { localizeErrorMessage } from "../../../http/error-messages.js";

function errorResponse(c: Context<AppBindings>, error: PosOrderError) {
  return c.json(
    { message: localizeErrorMessage(error.message, c.get("locale")), code: error.code, requestId: c.get("requestId") },
    error.status,
  );
}

export async function listParkedPosCartsController(c: Context<AppBindings>) {
  return c.json(await listParkedCarts(c.get("authContext")));
}

export async function parkCurrentPosCartController(c: Context<AppBindings>) {
  const data = parkPosCartBodySchema.parse(await c.req.json().catch(() => ({})));
  try {
    return c.json(
      await parkCurrentPosCart({ authContext: c.get("authContext"), data }),
      201,
    );
  } catch (error) {
    if (error instanceof PosOrderError) return errorResponse(c, error);
    throw error;
  }
}

export async function claimParkedPosCartController(c: Context<AppBindings>) {
  const { cartId } = posCartParamsSchema.parse(c.req.param());
  const data = claimPosCartBodySchema.parse(
    await c.req.json().catch(() => ({})),
  );
  try {
    return c.json(
      await claimParkedCart({
        authContext: c.get("authContext"),
        cartId,
        data,
      }),
    );
  } catch (error) {
    if (error instanceof PosOrderError) return errorResponse(c, error);
    throw error;
  }
}

export async function getCurrentPosCartController(c: Context<AppBindings>) {
  const cart = await getCurrentPosCart(c.get("authContext"));
  return c.json(cart);
}

export async function saveCurrentPosCartController(c: Context<AppBindings>) {
  const data = savePosCartBodySchema.parse(await c.req.json().catch(() => ({})));
  try {
    return c.json(
      await saveCurrentPosCart({ authContext: c.get("authContext"), data }),
    );
  } catch (error) {
    if (error instanceof PosOrderError) return errorResponse(c, error);
    throw error;
  }
}

export async function clearCurrentPosCartController(c: Context<AppBindings>) {
  await clearCurrentPosCart(c.get("authContext"));
  return c.body(null, 204);
}

export async function previewPosCartController(c: Context<AppBindings>) {
  const data = previewPosCartBodySchema.parse(
    await c.req.json().catch(() => ({})),
  );
  try {
    return c.json(
      await previewCurrentPosCart({ authContext: c.get("authContext"), data }),
    );
  } catch (error) {
    if (error instanceof PosOrderError) return errorResponse(c, error);
    throw error;
  }
}
