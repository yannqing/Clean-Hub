import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { PosCustomerError } from "./customers.errors.js";
import { getRequestMeta } from "../request-meta.helper.js";
import {
  changePosAccountStatus,
  changePosProfileStatus,
  createPosAccount,
  createPosProfile,
  deletePosAccount,
  deletePosProfile,
  getPosAccount,
  getPosProfile,
  getPosProfilesByAccount,
  listPosCustomers,
  updatePosAccount,
  updatePosProfile,
} from "./customers.service.js";
import {
  changePosCustomerStatusBodySchema,
  createPosAccountBodySchema,
  createPosProfileBodySchema,
  listPosCustomersQuerySchema,
  posAccountIdParamsSchema,
  posCustomerIdParamsSchema,
  updatePosAccountBodySchema,
  updatePosProfileBodySchema,
} from "./customers.validation.js";

function createPosCustomerErrorResponse(
  c: Context<AppBindings>,
  error: PosCustomerError,
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

export async function listPosCustomersController(c: Context<AppBindings>) {
  const query = listPosCustomersQuerySchema.parse(c.req.query());
  const result = await listPosCustomers({
    authContext: c.get("authContext"),
    query,
  });

  return c.json(result);
}

export async function getPosProfileController(c: Context<AppBindings>) {
  const params = posCustomerIdParamsSchema.parse(c.req.param());

  try {
    const profile = await getPosProfile({
      authContext: c.get("authContext"),
      customerId: params.customerId,
    });

    return c.json(profile);
  } catch (error) {
    if (error instanceof PosCustomerError) {
      return createPosCustomerErrorResponse(c, error);
    }

    throw error;
  }
}

export async function updatePosProfileController(c: Context<AppBindings>) {
  const params = posCustomerIdParamsSchema.parse(c.req.param());
  const body = updatePosProfileBodySchema.parse(await c.req.json());

  try {
    const profile = await updatePosProfile({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      customerId: params.customerId,
      data: body,
    });

    return c.json(profile);
  } catch (error) {
    if (error instanceof PosCustomerError) {
      return createPosCustomerErrorResponse(c, error);
    }

    throw error;
  }
}

export async function changePosProfileStatusController(
  c: Context<AppBindings>,
) {
  const params = posCustomerIdParamsSchema.parse(c.req.param());
  const body = changePosCustomerStatusBodySchema.parse(await c.req.json());

  try {
    const profile = await changePosProfileStatus({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      customerId: params.customerId,
      data: body,
    });

    return c.json(profile);
  } catch (error) {
    if (error instanceof PosCustomerError) {
      return createPosCustomerErrorResponse(c, error);
    }

    throw error;
  }
}

export async function deletePosProfileController(c: Context<AppBindings>) {
  const params = posCustomerIdParamsSchema.parse(c.req.param());

  try {
    await deletePosProfile({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      customerId: params.customerId,
    });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof PosCustomerError) {
      return createPosCustomerErrorResponse(c, error);
    }

    throw error;
  }
}

// ---- account-scoped endpoints --------------------------------------------

export async function getPosAccountController(c: Context<AppBindings>) {
  const params = posAccountIdParamsSchema.parse(c.req.param());

  try {
    const account = await getPosAccount({
      authContext: c.get("authContext"),
      accountId: params.accountId,
    });

    return c.json(account);
  } catch (error) {
    if (error instanceof PosCustomerError) {
      return createPosCustomerErrorResponse(c, error);
    }

    throw error;
  }
}

export async function getPosProfilesByAccountController(
  c: Context<AppBindings>,
) {
  const params = posAccountIdParamsSchema.parse(c.req.param());

  try {
    const profiles = await getPosProfilesByAccount({
      authContext: c.get("authContext"),
      accountId: params.accountId,
    });

    return c.json({ data: profiles });
  } catch (error) {
    if (error instanceof PosCustomerError) {
      return createPosCustomerErrorResponse(c, error);
    }

    throw error;
  }
}

export async function createPosAccountController(c: Context<AppBindings>) {
  const body = createPosAccountBodySchema.parse(await c.req.json());

  try {
    const account = await createPosAccount({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      data: body,
    });

    return c.json(account, 201);
  } catch (error) {
    if (error instanceof PosCustomerError) {
      return createPosCustomerErrorResponse(c, error);
    }

    throw error;
  }
}

export async function createPosProfileUnderAccountController(
  c: Context<AppBindings>,
) {
  const params = posAccountIdParamsSchema.parse(c.req.param());
  const body = createPosProfileBodySchema.parse(await c.req.json());

  try {
    const profile = await createPosProfile({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      accountId: params.accountId,
      data: body,
    });

    return c.json(profile, 201);
  } catch (error) {
    if (error instanceof PosCustomerError) {
      return createPosCustomerErrorResponse(c, error);
    }

    throw error;
  }
}

export async function updatePosAccountController(c: Context<AppBindings>) {
  const params = posAccountIdParamsSchema.parse(c.req.param());
  const body = updatePosAccountBodySchema.parse(await c.req.json());

  try {
    const account = await updatePosAccount({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      accountId: params.accountId,
      data: body,
    });

    return c.json(account);
  } catch (error) {
    if (error instanceof PosCustomerError) {
      return createPosCustomerErrorResponse(c, error);
    }

    throw error;
  }
}

export async function changePosAccountStatusController(
  c: Context<AppBindings>,
) {
  const params = posAccountIdParamsSchema.parse(c.req.param());
  const body = changePosCustomerStatusBodySchema.parse(await c.req.json());

  try {
    const account = await changePosAccountStatus({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      accountId: params.accountId,
      data: body,
    });

    return c.json(account);
  } catch (error) {
    if (error instanceof PosCustomerError) {
      return createPosCustomerErrorResponse(c, error);
    }

    throw error;
  }
}

export async function deletePosAccountController(c: Context<AppBindings>) {
  const params = posAccountIdParamsSchema.parse(c.req.param());

  try {
    await deletePosAccount({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      accountId: params.accountId,
    });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof PosCustomerError) {
      return createPosCustomerErrorResponse(c, error);
    }

    throw error;
  }
}
