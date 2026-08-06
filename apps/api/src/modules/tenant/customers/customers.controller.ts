import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { MediaError } from "../../media/media.types.js";
import { TenantCustomersError } from "./customers.errors.js";
import {
  createTenantCustomerComment,
  deleteTenantCustomerComment,
  getTenantCustomerTimeline,
  requestTenantCustomerAttachmentUpload,
  updateTenantCustomerComment,
} from "./customers.timeline.service.js";
import {
  getTenantCustomerAccountDetail,
  getTenantCustomerAccountOverview,
  getTenantCustomerDetail,
  getTenantCustomerOverview,
  listTenantCustomerAccountCustomers,
  listTenantCustomerAccounts,
  listTenantCustomers,
  updateTenantCustomerAccount,
} from "./customers.service.js";
import {
  createTenantCustomerCommentBodySchema,
  deleteTenantCustomerCommentBodySchema,
  tenantCustomerAttachmentUploadBodySchema,
  tenantCustomerAccountCustomersQuerySchema,
  tenantCustomerAccountListQuerySchema,
  tenantCustomerAccountParamsSchema,
  tenantCustomerCommentParamsSchema,
  tenantCustomerListQuerySchema,
  tenantCustomerOverviewQuerySchema,
  tenantCustomerParamsSchema,
  tenantCustomerTimelineQuerySchema,
  updateTenantCustomerCommentBodySchema,
  updateTenantCustomerAccountBodySchema,
} from "./customers.validation.js";

function getRequestMeta(c: Context<AppBindings>) {
  return {
    ipAddress:
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
  };
}

function createTenantCustomersErrorResponse(
  c: Context<AppBindings>,
  error: TenantCustomersError,
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

function createMediaErrorResponse(c: Context<AppBindings>, error: MediaError) {
  return c.json(
    {
      message: error.message,
      code: error.code,
      requestId: c.get("requestId"),
    },
    error.status,
  );
}

export async function listTenantCustomersController(c: Context<AppBindings>) {
  const query = tenantCustomerListQuerySchema.parse(c.req.query());
  const result = await listTenantCustomers({
    authContext: c.get("authContext"),
    query,
  });

  return c.json(result);
}

export async function getTenantCustomerOverviewController(
  c: Context<AppBindings>,
) {
  const query = tenantCustomerOverviewQuerySchema.parse(c.req.query());
  const result = await getTenantCustomerOverview({
    authContext: c.get("authContext"),
    query,
  });

  return c.json(result);
}

export async function getTenantCustomerDetailController(
  c: Context<AppBindings>,
) {
  const { customerId } = tenantCustomerParamsSchema.parse(c.req.param());

  try {
    return c.json(
      await getTenantCustomerDetail(c.get("authContext"), customerId),
    );
  } catch (error) {
    if (error instanceof TenantCustomersError) {
      return createTenantCustomersErrorResponse(c, error);
    }
    throw error;
  }
}

export async function listTenantCustomerAccountsController(
  c: Context<AppBindings>,
) {
  const query = tenantCustomerAccountListQuerySchema.parse(c.req.query());
  return c.json(
    await listTenantCustomerAccounts({
      authContext: c.get("authContext"),
      query,
    }),
  );
}

export async function getTenantCustomerAccountOverviewController(
  c: Context<AppBindings>,
) {
  return c.json(
    await getTenantCustomerAccountOverview({
      authContext: c.get("authContext"),
    }),
  );
}

export async function getTenantCustomerAccountDetailController(
  c: Context<AppBindings>,
) {
  const { accountId } = tenantCustomerAccountParamsSchema.parse(c.req.param());
  try {
    return c.json(
      await getTenantCustomerAccountDetail({
        authContext: c.get("authContext"),
        accountId,
      }),
    );
  } catch (error) {
    if (error instanceof TenantCustomersError) {
      return createTenantCustomersErrorResponse(c, error);
    }
    throw error;
  }
}

export async function listTenantCustomerAccountCustomersController(
  c: Context<AppBindings>,
) {
  const { accountId } = tenantCustomerAccountParamsSchema.parse(c.req.param());
  const query = tenantCustomerAccountCustomersQuerySchema.parse(c.req.query());
  try {
    return c.json(
      await listTenantCustomerAccountCustomers({
        authContext: c.get("authContext"),
        accountId,
        query,
      }),
    );
  } catch (error) {
    if (error instanceof TenantCustomersError) {
      return createTenantCustomersErrorResponse(c, error);
    }
    throw error;
  }
}

export async function updateTenantCustomerAccountController(
  c: Context<AppBindings>,
) {
  const { accountId } = tenantCustomerAccountParamsSchema.parse(c.req.param());
  const data = updateTenantCustomerAccountBodySchema.parse(
    await c.req.json().catch(() => ({})),
  );
  try {
    return c.json(
      await updateTenantCustomerAccount({
        authContext: c.get("authContext"),
        requestMeta: getRequestMeta(c),
        accountId,
        data,
      }),
    );
  } catch (error) {
    if (error instanceof TenantCustomersError) {
      return createTenantCustomersErrorResponse(c, error);
    }
    throw error;
  }
}

export async function getTenantCustomerTimelineController(
  c: Context<AppBindings>,
) {
  const { customerId } = tenantCustomerParamsSchema.parse(c.req.param());
  const query = tenantCustomerTimelineQuerySchema.parse(c.req.query());
  try {
    return c.json(
      await getTenantCustomerTimeline({
        authContext: c.get("authContext"),
        customerId,
        query,
      }),
    );
  } catch (error) {
    if (error instanceof TenantCustomersError) {
      return createTenantCustomersErrorResponse(c, error);
    }
    if (error instanceof MediaError) return createMediaErrorResponse(c, error);
    throw error;
  }
}

export async function createTenantCustomerCommentController(
  c: Context<AppBindings>,
) {
  const { customerId } = tenantCustomerParamsSchema.parse(c.req.param());
  const data = createTenantCustomerCommentBodySchema.parse(
    await c.req.json().catch(() => ({})),
  );
  try {
    return c.json(
      await createTenantCustomerComment({
        authContext: c.get("authContext"),
        requestMeta: getRequestMeta(c),
        customerId,
        data,
      }),
      201,
    );
  } catch (error) {
    if (error instanceof TenantCustomersError) {
      return createTenantCustomersErrorResponse(c, error);
    }
    if (error instanceof MediaError) return createMediaErrorResponse(c, error);
    throw error;
  }
}

export async function requestTenantCustomerAttachmentUploadController(
  c: Context<AppBindings>,
) {
  const { customerId } = tenantCustomerParamsSchema.parse(c.req.param());
  const data = tenantCustomerAttachmentUploadBodySchema.parse(
    await c.req.json().catch(() => ({})),
  );
  try {
    return c.json(
      await requestTenantCustomerAttachmentUpload(
        c.get("authContext"),
        customerId,
        data,
      ),
      201,
    );
  } catch (error) {
    if (error instanceof TenantCustomersError) {
      return createTenantCustomersErrorResponse(c, error);
    }
    if (error instanceof MediaError) return createMediaErrorResponse(c, error);
    throw error;
  }
}

export async function updateTenantCustomerCommentController(
  c: Context<AppBindings>,
) {
  const { customerId, commentId } = tenantCustomerCommentParamsSchema.parse(
    c.req.param(),
  );
  const data = updateTenantCustomerCommentBodySchema.parse(
    await c.req.json().catch(() => ({})),
  );
  try {
    return c.json(
      await updateTenantCustomerComment({
        authContext: c.get("authContext"),
        requestMeta: getRequestMeta(c),
        customerId,
        commentId,
        data,
      }),
    );
  } catch (error) {
    if (error instanceof TenantCustomersError) {
      return createTenantCustomersErrorResponse(c, error);
    }
    if (error instanceof MediaError) return createMediaErrorResponse(c, error);
    throw error;
  }
}

export async function deleteTenantCustomerCommentController(
  c: Context<AppBindings>,
) {
  const { customerId, commentId } = tenantCustomerCommentParamsSchema.parse(
    c.req.param(),
  );
  const data = deleteTenantCustomerCommentBodySchema.parse(
    await c.req.json().catch(() => ({})),
  );
  try {
    await deleteTenantCustomerComment({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      customerId,
      commentId,
      data,
    });
    return c.body(null, 204);
  } catch (error) {
    if (error instanceof TenantCustomersError) {
      return createTenantCustomersErrorResponse(c, error);
    }
    throw error;
  }
}
