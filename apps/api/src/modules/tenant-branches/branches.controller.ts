import type { Context } from "hono";

import type { AppBindings } from "../../http/types.js";
import { TenantBranchesError } from "./branches.errors.js";
import {
  createTenantBranch,
  getTenantBranchDetail,
  listTenantBranches,
  updateTenantBranch,
  updateTenantBranchStatus,
} from "./branches.service.js";
import {
  branchListQuerySchema,
  branchParamsSchema,
  createBranchBodySchema,
  updateBranchBodySchema,
  updateBranchStatusBodySchema,
} from "./branches.validation.js";

function getRequestMeta(c: Context<AppBindings>) {
  return {
    ipAddress:
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
  };
}

function createTenantBranchesErrorResponse(
  c: Context<AppBindings>,
  error: TenantBranchesError,
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

export async function listTenantBranchesController(c: Context<AppBindings>) {
  const query = branchListQuerySchema.parse(c.req.query());

  return c.json(await listTenantBranches(c.get("authContext"), query));
}

export async function createTenantBranchController(c: Context<AppBindings>) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = createBranchBodySchema.parse(rawBody);

  return c.json(
    await createTenantBranch({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      data,
    }),
    201,
  );
}

export async function getTenantBranchController(c: Context<AppBindings>) {
  const { branchId } = branchParamsSchema.parse(c.req.param());

  try {
    return c.json(await getTenantBranchDetail(c.get("authContext"), branchId));
  } catch (error) {
    if (error instanceof TenantBranchesError) {
      return createTenantBranchesErrorResponse(c, error);
    }

    throw error;
  }
}

export async function updateTenantBranchController(c: Context<AppBindings>) {
  const { branchId } = branchParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = updateBranchBodySchema.parse(rawBody);

  try {
    return c.json(
      await updateTenantBranch(branchId, {
        authContext: c.get("authContext"),
        requestMeta: getRequestMeta(c),
        data,
      }),
    );
  } catch (error) {
    if (error instanceof TenantBranchesError) {
      return createTenantBranchesErrorResponse(c, error);
    }

    throw error;
  }
}

export async function updateTenantBranchStatusController(
  c: Context<AppBindings>,
) {
  const { branchId } = branchParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = updateBranchStatusBodySchema.parse(rawBody);

  try {
    return c.json(
      await updateTenantBranchStatus(branchId, {
        authContext: c.get("authContext"),
        requestMeta: getRequestMeta(c),
        data,
      }),
    );
  } catch (error) {
    if (error instanceof TenantBranchesError) {
      return createTenantBranchesErrorResponse(c, error);
    }

    throw error;
  }
}
