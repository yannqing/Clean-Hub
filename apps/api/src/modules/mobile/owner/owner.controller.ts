import type { Context } from "hono";
import { z } from "zod";

import type { AppBindings } from "../../../http/types.js";
import type { OwnerService } from "./owner.service.js";
import { OwnerError } from "./owner.types.js";

const appointmentParamsSchema = z.object({
  appointmentId: z.string().trim().min(1).max(120),
});

const appointmentListQuerySchema = z.object({
  branchId: z.string().trim().min(1).max(120).optional(),
  status: z.enum(["pending", "accepted", "cancelled", "done"]).optional(),
});

const driverListQuerySchema = z.object({
  branchId: z.string().trim().min(1).max(120).optional(),
});

const acceptAppointmentBodySchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(120),
  assigneeUserId: z.string().trim().min(1).max(120).optional(),
  notes: z.string().trim().min(1).max(2000).optional(),
});

const rejectAppointmentBodySchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});

export type OwnerControllerOptions = {
  ownerService: OwnerService;
};

function errorResponse(c: Context<AppBindings>, error: OwnerError) {
  return c.json(
    {
      message: error.message,
      code: error.code,
      requestId: c.get("requestId"),
      ...(error.details ? { details: error.details } : {}),
    },
    error.status,
  );
}

async function readJson(c: Context<AppBindings>): Promise<unknown> {
  return c.req.json().catch(() => ({}));
}

export function createOwnerController({
  ownerService,
}: OwnerControllerOptions) {
  return {
    getTodaySummary: async (c: Context<AppBindings>) => {
      try {
        return c.json(
          await ownerService.getTodaySummary(c.get("mobileAuthContext")),
        );
      } catch (error) {
        if (error instanceof OwnerError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    listBranches: async (c: Context<AppBindings>) => {
      try {
        return c.json({
          data: await ownerService.listBranches(c.get("mobileAuthContext")),
        });
      } catch (error) {
        if (error instanceof OwnerError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    listDrivers: async (c: Context<AppBindings>) => {
      const query = driverListQuerySchema.parse(c.req.query());

      try {
        return c.json({
          data: await ownerService.listDrivers({
            authContext: c.get("mobileAuthContext"),
            branchId: query.branchId,
          }),
        });
      } catch (error) {
        if (error instanceof OwnerError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    listAppointments: async (c: Context<AppBindings>) => {
      const query = appointmentListQuerySchema.parse(c.req.query());

      try {
        return c.json({
          data: await ownerService.listAppointments({
            authContext: c.get("mobileAuthContext"),
            branchId: query.branchId,
            status: query.status,
          }),
        });
      } catch (error) {
        if (error instanceof OwnerError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    acceptAppointment: async (c: Context<AppBindings>) => {
      const { appointmentId } = appointmentParamsSchema.parse(c.req.param());
      const body = acceptAppointmentBodySchema.parse(await readJson(c));

      try {
        return c.json(
          await ownerService.acceptAppointment({
            authContext: c.get("mobileAuthContext"),
            appointmentId,
            idempotencyKey: body.idempotencyKey,
            assigneeUserId: body.assigneeUserId,
            notes: body.notes,
          }),
        );
      } catch (error) {
        if (error instanceof OwnerError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    rejectAppointment: async (c: Context<AppBindings>) => {
      const { appointmentId } = appointmentParamsSchema.parse(c.req.param());
      const body = rejectAppointmentBodySchema.parse(await readJson(c));

      try {
        return c.json(
          await ownerService.rejectAppointment({
            authContext: c.get("mobileAuthContext"),
            appointmentId,
            reason: body.reason,
          }),
        );
      } catch (error) {
        if (error instanceof OwnerError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },
  };
}
