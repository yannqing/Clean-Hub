import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { PosOrderError } from "../orders/orders.errors.js";
import {
  clearCurrentPosCart,
  getCurrentPosCart,
  previewCurrentPosCart,
  saveCurrentPosCart,
} from "./carts.service.js";
import {
  previewPosCartBodySchema,
  savePosCartBodySchema,
} from "./carts.validation.js";

function errorResponse(c: Context<AppBindings>, error: PosOrderError) {
  return c.json(
    { message: error.message, code: error.code, requestId: c.get("requestId") },
    error.status,
  );
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
