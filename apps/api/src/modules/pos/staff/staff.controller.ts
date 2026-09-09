import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { getRequestMeta } from "../request-meta.helper.js";
import { PosStaffError } from "./staff.errors.js";
import {
  clockAction,
  createHandover,
  createShiftCashMovement,
  createRegisterCashMovement,
  closePosRegister,
  getCurrentShift,
  getCurrentShiftReconciliation,
  getCurrentRegisterState,
  getCurrentRegisterReconciliation,
  getPosStaff,
  getPosZReport,
  listPosStaff,
  listPosZReports,
  listCurrentShiftCashMovements,
  listCurrentRegisterCashMovements,
  openPosRegister,
} from "./staff.service.js";
import {
  closeRegisterRequestSchema,
  clockRequestSchema,
  createHandoverRequestSchema,
  createShiftCashMovementRequestSchema,
  openRegisterRequestSchema,
  posStaffListQuerySchema,
  posStaffParamsSchema,
  posZReportListQuerySchema,
  posZReportParamsSchema,
} from "./staff.validation.js";

function errorResponse(c: Context<AppBindings>, error: PosStaffError) {
  return c.json(
    { message: error.message, code: error.code, requestId: c.get("requestId") },
    error.status,
  );
}

export async function listPosStaffController(c: Context<AppBindings>) {
  const query = posStaffListQuerySchema.parse(c.req.query());
  try {
    return c.json({
      data: await listPosStaff({ authContext: c.get("authContext"), query }),
    });
  } catch (error) {
    if (error instanceof PosStaffError) return errorResponse(c, error);
    throw error;
  }
}

export async function getPosStaffController(c: Context<AppBindings>) {
  const { staffId } = posStaffParamsSchema.parse(c.req.param());
  try {
    return c.json(
      await getPosStaff({ authContext: c.get("authContext"), staffId }),
    );
  } catch (error) {
    if (error instanceof PosStaffError) return errorResponse(c, error);
    throw error;
  }
}

export async function getCurrentShiftController(c: Context<AppBindings>) {
  try {
    return c.json(await getCurrentShift(c.get("authContext")));
  } catch (error) {
    if (error instanceof PosStaffError) return errorResponse(c, error);
    throw error;
  }
}

export async function getCurrentRegisterController(c: Context<AppBindings>) {
  try {
    return c.json(await getCurrentRegisterState(c.get("authContext")));
  } catch (error) {
    if (error instanceof PosStaffError) return errorResponse(c, error);
    throw error;
  }
}

export async function openRegisterController(c: Context<AppBindings>) {
  const data = openRegisterRequestSchema.parse(
    await c.req.json().catch(() => ({})),
  );
  try {
    return c.json(
      await openPosRegister(
        c.get("authContext"),
        data,
        getRequestMeta(c),
      ),
      201,
    );
  } catch (error) {
    if (error instanceof PosStaffError) return errorResponse(c, error);
    throw error;
  }
}

export async function closeRegisterController(c: Context<AppBindings>) {
  const data = closeRegisterRequestSchema.parse(
    await c.req.json().catch(() => ({})),
  );
  try {
    return c.json(
      await closePosRegister(
        c.get("authContext"),
        data,
        getRequestMeta(c),
      ),
    );
  } catch (error) {
    if (error instanceof PosStaffError) return errorResponse(c, error);
    throw error;
  }
}

export async function getCurrentRegisterReconciliationController(
  c: Context<AppBindings>,
) {
  try {
    return c.json(
      await getCurrentRegisterReconciliation(c.get("authContext")),
    );
  } catch (error) {
    if (error instanceof PosStaffError) return errorResponse(c, error);
    throw error;
  }
}

export async function listCurrentRegisterCashMovementsController(
  c: Context<AppBindings>,
) {
  try {
    return c.json(
      await listCurrentRegisterCashMovements(c.get("authContext")),
    );
  } catch (error) {
    if (error instanceof PosStaffError) return errorResponse(c, error);
    throw error;
  }
}

export async function createRegisterCashMovementController(
  c: Context<AppBindings>,
) {
  const data = createShiftCashMovementRequestSchema.parse(
    await c.req.json().catch(() => ({})),
  );
  try {
    return c.json(
      await createRegisterCashMovement({
        authContext: c.get("authContext"),
        requestMeta: getRequestMeta(c),
        data,
      }),
      201,
    );
  } catch (error) {
    if (error instanceof PosStaffError) return errorResponse(c, error);
    throw error;
  }
}

export async function getCurrentShiftReconciliationController(
  c: Context<AppBindings>,
) {
  return c.json(await getCurrentShiftReconciliation(c.get("authContext")));
}

export async function listCurrentShiftCashMovementsController(
  c: Context<AppBindings>,
) {
  return c.json(await listCurrentShiftCashMovements(c.get("authContext")));
}

export async function createShiftCashMovementController(
  c: Context<AppBindings>,
) {
  const data = createShiftCashMovementRequestSchema.parse(
    await c.req.json().catch(() => ({})),
  );
  return c.json(
    await createShiftCashMovement({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      data,
    }),
    201,
  );
}

export async function clockActionController(c: Context<AppBindings>) {
  const data = clockRequestSchema.parse(await c.req.json().catch(() => ({})));
  try {
    return c.json(
      await clockAction({
        authContext: c.get("authContext"),
        requestMeta: getRequestMeta(c),
        data,
      }),
    );
  } catch (error) {
    if (error instanceof PosStaffError) return errorResponse(c, error);
    throw error;
  }
}

export async function createHandoverController(c: Context<AppBindings>) {
  const data = createHandoverRequestSchema.parse(
    await c.req.json().catch(() => ({})),
  );
  try {
    return c.json(
      await createHandover({
        authContext: c.get("authContext"),
        requestMeta: getRequestMeta(c),
        data,
      }),
      201,
    );
  } catch (error) {
    if (error instanceof PosStaffError) return errorResponse(c, error);
    throw error;
  }
}

export async function listPosZReportsController(c: Context<AppBindings>) {
  const query = posZReportListQuerySchema.parse(c.req.query());
  try {
    return c.json({
      data: await listPosZReports(c.get("authContext"), query),
    });
  } catch (error) {
    if (error instanceof PosStaffError) return errorResponse(c, error);
    throw error;
  }
}

export async function getPosZReportController(c: Context<AppBindings>) {
  const { zReportId } = posZReportParamsSchema.parse(c.req.param());
  try {
    return c.json(await getPosZReport(c.get("authContext"), zReportId));
  } catch (error) {
    if (error instanceof PosStaffError) return errorResponse(c, error);
    throw error;
  }
}
