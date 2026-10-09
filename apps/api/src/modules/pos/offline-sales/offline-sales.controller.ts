import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { getRequestMeta } from "../request-meta.helper.js";
import {
  acknowledgeRecoveredOfflineSaleException,
  getPosOfflineSaleException,
  listPosOfflineSaleExceptions,
  reportPosOfflineSaleException,
  resolvePosOfflineSaleException,
} from "./offline-sales.service.js";
import {
  listPosOfflineSaleExceptionsQuerySchema,
  posOfflineSaleExceptionParamsSchema,
  reportPosOfflineSaleExceptionBodySchema,
  resolvePosOfflineSaleExceptionBodySchema,
} from "./offline-sales.validation.js";

export async function reportOfflineSaleExceptionController(
  c: Context<AppBindings>,
) {
  const data = reportPosOfflineSaleExceptionBodySchema.parse(
    await c.req.json(),
  );
  const result = await reportPosOfflineSaleException({
    authContext: c.get("authContext"),
    requestMeta: getRequestMeta(c),
    data,
  });
  return c.json(result, 201);
}

export async function listOfflineSaleExceptionsController(
  c: Context<AppBindings>,
) {
  const query = listPosOfflineSaleExceptionsQuerySchema.parse(c.req.query());
  return c.json(
    await listPosOfflineSaleExceptions(c.get("authContext"), query),
  );
}

export async function getOfflineSaleExceptionController(
  c: Context<AppBindings>,
) {
  const { commandId } = posOfflineSaleExceptionParamsSchema.parse(
    c.req.param(),
  );
  const result = await getPosOfflineSaleException(
    c.get("authContext"),
    commandId,
  );
  return result ? c.json(result) : c.json({ message: "Not found" }, 404);
}

export async function resolveOfflineSaleExceptionController(
  c: Context<AppBindings>,
) {
  const { commandId } = posOfflineSaleExceptionParamsSchema.parse(
    c.req.param(),
  );
  const data = resolvePosOfflineSaleExceptionBodySchema.parse(
    await c.req.json(),
  );
  return c.json(
    await resolvePosOfflineSaleException(commandId, {
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      data,
    }),
  );
}

export async function acknowledgeRecoveredOfflineSaleExceptionController(
  c: Context<AppBindings>,
) {
  const { commandId } = posOfflineSaleExceptionParamsSchema.parse(
    c.req.param(),
  );
  return c.json(
    await acknowledgeRecoveredOfflineSaleException(commandId, {
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      data: {},
    }),
  );
}
