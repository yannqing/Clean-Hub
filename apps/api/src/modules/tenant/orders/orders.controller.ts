import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { MediaError } from "../../media/media.types.js";
import { PosOrderError } from "../../pos/orders/orders.errors.js";
import {
  createTenantOrderComment,
  deleteTenantOrderComment,
  getTenantOrderTimeline,
  updateTenantOrderComment,
} from "./orders.timeline.service.js";
import {
  getTenantOrderDetail,
  getTenantOrderOverview,
  changeTenantOrderStatus,
  createTenantOrderItem,
  createTenantOrderPayment,
  createTenantOrderPaymentCorrection,
  createTenantOrderRefund,
  deleteTenantOrderItem,
  importTenantOrders,
  listTenantOrders,
  requestTenantOrderAttachmentUpload,
  updateTenantOrderItem,
} from "./orders.service.js";
import { TenantOrdersError } from "./orders.errors.js";
import {
  createTenantOrderCommentBodySchema,
  createTenantOrderItemBodySchema,
  createTenantOrderPaymentBodySchema,
  createTenantOrderPaymentCorrectionBodySchema,
  createTenantOrderRefundBodySchema,
  changeTenantOrderStatusBodySchema,
  deleteTenantOrderCommentBodySchema,
  deleteTenantOrderItemBodySchema,
  tenantOrderImportBodySchema,
  tenantOrderCommentParamsSchema,
  tenantOrderItemParamsSchema,
  tenantOrderAttachmentUploadBodySchema,
  tenantOrderListQuerySchema,
  tenantOrderOverviewQuerySchema,
  tenantOrderParamsSchema,
  tenantOrderTimelineQuerySchema,
  updateTenantOrderCommentBodySchema,
  updateTenantOrderItemBodySchema,
} from "./orders.validation.js";

function getRequestMeta(c: Context<AppBindings>) {
  return {
    ipAddress:
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
  };
}

function createPosOrderErrorResponse(
  c: Context<AppBindings>,
  error: PosOrderError,
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

function createTenantOrdersErrorResponse(
  c: Context<AppBindings>,
  error: TenantOrdersError,
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

export async function listTenantOrdersController(c: Context<AppBindings>) {
  const query = tenantOrderListQuerySchema.parse(c.req.query());
  const result = await listTenantOrders({
    authContext: c.get("authContext"),
    query,
  });

  return c.json(result);
}

export async function getTenantOrderOverviewController(
  c: Context<AppBindings>,
) {
  const query = tenantOrderOverviewQuerySchema.parse(c.req.query());
  const overview = await getTenantOrderOverview(c.get("authContext"), query);

  return c.json(overview);
}

export async function getTenantOrderDetailController(c: Context<AppBindings>) {
  const { orderId } = tenantOrderParamsSchema.parse(c.req.param());

  try {
    return c.json(await getTenantOrderDetail(c.get("authContext"), orderId));
  } catch (error) {
    if (error instanceof TenantOrdersError) {
      return createTenantOrdersErrorResponse(c, error);
    }
    if (error instanceof MediaError) {
      return createMediaErrorResponse(c, error);
    }

    throw error;
  }
}

export async function getTenantOrderTimelineController(
  c: Context<AppBindings>,
) {
  const { orderId } = tenantOrderParamsSchema.parse(c.req.param());
  const query = tenantOrderTimelineQuerySchema.parse(c.req.query());

  try {
    return c.json(
      await getTenantOrderTimeline({
        authContext: c.get("authContext"),
        orderId,
        query,
      }),
    );
  } catch (error) {
    if (error instanceof TenantOrdersError) {
      return createTenantOrdersErrorResponse(c, error);
    }
    if (error instanceof MediaError) {
      return createMediaErrorResponse(c, error);
    }

    throw error;
  }
}

export async function createTenantOrderCommentController(
  c: Context<AppBindings>,
) {
  const { orderId } = tenantOrderParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = createTenantOrderCommentBodySchema.parse(rawBody);

  try {
    return c.json(
      await createTenantOrderComment({
        authContext: c.get("authContext"),
        requestMeta: getRequestMeta(c),
        orderId,
        data,
      }),
      201,
    );
  } catch (error) {
    if (error instanceof TenantOrdersError) {
      return createTenantOrdersErrorResponse(c, error);
    }
    if (error instanceof MediaError) {
      return createMediaErrorResponse(c, error);
    }

    throw error;
  }
}

export async function requestTenantOrderAttachmentUploadController(
  c: Context<AppBindings>,
) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = tenantOrderAttachmentUploadBodySchema.parse(rawBody);

  try {
    return c.json(
      await requestTenantOrderAttachmentUpload(c.get("authContext"), data),
      201,
    );
  } catch (error) {
    if (error instanceof MediaError) {
      return createMediaErrorResponse(c, error);
    }
    throw error;
  }
}

export async function changeTenantOrderStatusController(
  c: Context<AppBindings>,
) {
  const { orderId } = tenantOrderParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = changeTenantOrderStatusBodySchema.parse(rawBody);

  try {
    return c.json(
      await changeTenantOrderStatus(
        c.get("authContext"),
        orderId,
        data,
        getRequestMeta(c),
      ),
    );
  } catch (error) {
    if (error instanceof TenantOrdersError) {
      return createTenantOrdersErrorResponse(c, error);
    }
    if (error instanceof MediaError) {
      return createMediaErrorResponse(c, error);
    }
    if (error instanceof PosOrderError) {
      return createPosOrderErrorResponse(c, error);
    }
    throw error;
  }
}

export async function createTenantOrderPaymentController(
  c: Context<AppBindings>,
) {
  const { orderId } = tenantOrderParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = createTenantOrderPaymentBodySchema.parse(rawBody);

  try {
    return c.json(
      await createTenantOrderPayment(
        c.get("authContext"),
        orderId,
        data,
        getRequestMeta(c),
      ),
      201,
    );
  } catch (error) {
    if (error instanceof TenantOrdersError) {
      return createTenantOrdersErrorResponse(c, error);
    }
    if (error instanceof PosOrderError) {
      return createPosOrderErrorResponse(c, error);
    }
    throw error;
  }
}

export async function createTenantOrderItemController(c: Context<AppBindings>) {
  const { orderId } = tenantOrderParamsSchema.parse(c.req.param());
  const data = createTenantOrderItemBodySchema.parse(
    await c.req.json().catch(() => ({})),
  );

  try {
    return c.json(
      await createTenantOrderItem(
        c.get("authContext"),
        orderId,
        data,
        getRequestMeta(c),
      ),
      201,
    );
  } catch (error) {
    if (error instanceof TenantOrdersError) {
      return createTenantOrdersErrorResponse(c, error);
    }
    if (error instanceof PosOrderError) {
      return createPosOrderErrorResponse(c, error);
    }
    throw error;
  }
}

export async function updateTenantOrderItemController(c: Context<AppBindings>) {
  const { orderId, itemId } = tenantOrderItemParamsSchema.parse(c.req.param());
  const data = updateTenantOrderItemBodySchema.parse(
    await c.req.json().catch(() => ({})),
  );

  try {
    return c.json(
      await updateTenantOrderItem(
        c.get("authContext"),
        orderId,
        itemId,
        data,
        getRequestMeta(c),
      ),
    );
  } catch (error) {
    if (error instanceof TenantOrdersError) {
      return createTenantOrdersErrorResponse(c, error);
    }
    if (error instanceof PosOrderError) {
      return createPosOrderErrorResponse(c, error);
    }
    throw error;
  }
}

export async function deleteTenantOrderItemController(c: Context<AppBindings>) {
  const { orderId, itemId } = tenantOrderItemParamsSchema.parse(c.req.param());
  const data = deleteTenantOrderItemBodySchema.parse(
    await c.req.json().catch(() => ({})),
  );

  try {
    return c.json(
      await deleteTenantOrderItem(
        c.get("authContext"),
        orderId,
        itemId,
        data,
        getRequestMeta(c),
      ),
    );
  } catch (error) {
    if (error instanceof TenantOrdersError) {
      return createTenantOrdersErrorResponse(c, error);
    }
    if (error instanceof PosOrderError) {
      return createPosOrderErrorResponse(c, error);
    }
    throw error;
  }
}

export async function createTenantOrderRefundController(
  c: Context<AppBindings>,
) {
  const { orderId } = tenantOrderParamsSchema.parse(c.req.param());
  const data = createTenantOrderRefundBodySchema.parse(
    await c.req.json().catch(() => ({})),
  );

  try {
    return c.json(
      await createTenantOrderRefund(
        c.get("authContext"),
        orderId,
        data,
        getRequestMeta(c),
      ),
      201,
    );
  } catch (error) {
    if (error instanceof TenantOrdersError) {
      return createTenantOrdersErrorResponse(c, error);
    }
    if (error instanceof PosOrderError) {
      return createPosOrderErrorResponse(c, error);
    }
    throw error;
  }
}

export async function createTenantOrderPaymentCorrectionController(
  c: Context<AppBindings>,
) {
  const { orderId } = tenantOrderParamsSchema.parse(c.req.param());
  const data = createTenantOrderPaymentCorrectionBodySchema.parse(
    await c.req.json().catch(() => ({})),
  );

  try {
    return c.json(
      await createTenantOrderPaymentCorrection(
        c.get("authContext"),
        orderId,
        data,
        getRequestMeta(c),
      ),
      201,
    );
  } catch (error) {
    if (error instanceof TenantOrdersError) {
      return createTenantOrdersErrorResponse(c, error);
    }
    if (error instanceof PosOrderError) {
      return createPosOrderErrorResponse(c, error);
    }
    throw error;
  }
}

export async function updateTenantOrderCommentController(
  c: Context<AppBindings>,
) {
  const { orderId, commentId } = tenantOrderCommentParamsSchema.parse(
    c.req.param(),
  );
  const rawBody = await c.req.json().catch(() => ({}));
  const data = updateTenantOrderCommentBodySchema.parse(rawBody);

  try {
    return c.json(
      await updateTenantOrderComment({
        authContext: c.get("authContext"),
        requestMeta: getRequestMeta(c),
        orderId,
        commentId,
        data,
      }),
    );
  } catch (error) {
    if (error instanceof TenantOrdersError) {
      return createTenantOrdersErrorResponse(c, error);
    }
    if (error instanceof MediaError) {
      return createMediaErrorResponse(c, error);
    }
    throw error;
  }
}

export async function deleteTenantOrderCommentController(
  c: Context<AppBindings>,
) {
  const { orderId, commentId } = tenantOrderCommentParamsSchema.parse(
    c.req.param(),
  );
  const rawBody = await c.req.json().catch(() => ({}));
  const data = deleteTenantOrderCommentBodySchema.parse(rawBody);

  try {
    await deleteTenantOrderComment({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      orderId,
      commentId,
      data,
    });
    return c.body(null, 204);
  } catch (error) {
    if (error instanceof TenantOrdersError) {
      return createTenantOrdersErrorResponse(c, error);
    }
    throw error;
  }
}

export async function importTenantOrdersController(c: Context<AppBindings>) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = tenantOrderImportBodySchema.parse(rawBody);

  return c.json(
    await importTenantOrders({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      data,
    }),
  );
}
