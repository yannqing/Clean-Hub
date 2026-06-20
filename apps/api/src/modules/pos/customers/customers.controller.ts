import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  createPosCustomer,
  getPosCustomer,
  listPosCustomers,
} from "./customers.service.js";
import { PosNotImplementedError } from "../not-implemented.errors.js";
import { getRequestMeta } from "../request-meta.helper.js";
import { requirePathParam } from "../require-path-param.helper.js";
import type {
  CreatePosCustomerRequest,
  PosCustomerListQuery,
} from "./customers.types.js";

function notImplementedResponse(c: Context<AppBindings>, error: PosNotImplementedError) {
  return c.json(
    {
      message: error.message,
      code: error.code,
      requestId: c.get("requestId"),
    },
    error.status,
  );
}

export async function listPosCustomersController(c: Context<AppBindings>) {
  const query = c.req.query() as PosCustomerListQuery;
  const result = await listPosCustomers({
    authContext: c.get("authContext"),
    query,
  });
  return c.json({ data: result });
}

export async function getPosCustomerController(c: Context<AppBindings>) {
  const customerId = requirePathParam(c, "customerId");
  if (customerId instanceof Response) {
    return customerId;
  }
  const customer = await getPosCustomer({
    authContext: c.get("authContext"),
    customerId,
  });
  return c.json(customer);
}

export async function createPosCustomerController(c: Context<AppBindings>) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = rawBody as CreatePosCustomerRequest;

  try {
    const customer = await createPosCustomer({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      data,
    });
    return c.json(customer, 201);
  } catch (error) {
    if (error instanceof PosNotImplementedError) {
      return notImplementedResponse(c, error);
    }
    throw error;
  }
}
