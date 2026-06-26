import type { Context } from "hono";
import { z } from "zod";

import type { AppBindings } from "../../../http/types.js";
import type { CustomerService } from "./customer.service.js";
import { CustomerError } from "./customer.types.js";

const idParamsSchema = z.object({
  id: z.string().trim().min(1).max(120),
});

const createAppointmentBodySchema = z.object({
  type: z.enum(["pickup", "dropoff"]),
  expectedAt: z.string().datetime(),
  address: z.string().trim().min(1).max(2000),
  branchId: z.string().trim().min(1).max(120).optional(),
  customerId: z.string().trim().min(1).max(120).optional(),
  notes: z.string().trim().min(1).max(2000).optional(),
});

export type CustomerControllerOptions = {
  customerService: CustomerService;
};

async function readJson(c: Context<AppBindings>): Promise<unknown> {
  return c.req.json().catch(() => ({}));
}

function errorResponse(c: Context<AppBindings>, error: CustomerError) {
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

export function createCustomerController({
  customerService,
}: CustomerControllerOptions) {
  return {
    getProfile: async (c: Context<AppBindings>) => {
      try {
        return c.json(
          await customerService.getProfile(c.get("mobileAuthContext")),
        );
      } catch (error) {
        if (error instanceof CustomerError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    listOrdersAndTickets: async (c: Context<AppBindings>) => {
      try {
        return c.json({
          data: await customerService.listOrdersAndTickets(
            c.get("mobileAuthContext"),
          ),
        });
      } catch (error) {
        if (error instanceof CustomerError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    getOrderDetail: async (c: Context<AppBindings>) => {
      const { id } = idParamsSchema.parse(c.req.param());

      try {
        return c.json(
          await customerService.getOrderDetail(c.get("mobileAuthContext"), id),
        );
      } catch (error) {
        if (error instanceof CustomerError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    getTicketDetail: async (c: Context<AppBindings>) => {
      const { id } = idParamsSchema.parse(c.req.param());

      try {
        return c.json(
          await customerService.getTicketDetail(c.get("mobileAuthContext"), id),
        );
      } catch (error) {
        if (error instanceof CustomerError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    createAppointment: async (c: Context<AppBindings>) => {
      const body = createAppointmentBodySchema.parse(await readJson(c));

      try {
        return c.json(
          await customerService.createAppointment({
            authContext: c.get("mobileAuthContext"),
            type: body.type,
            expectedAt: new Date(body.expectedAt),
            address: body.address,
            branchId: body.branchId,
            customerId: body.customerId,
            notes: body.notes,
          }),
          201,
        );
      } catch (error) {
        if (error instanceof CustomerError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    listAppointments: async (c: Context<AppBindings>) => {
      try {
        return c.json({
          data: await customerService.listAppointments(
            c.get("mobileAuthContext"),
          ),
        });
      } catch (error) {
        if (error instanceof CustomerError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    cancelAppointment: async (c: Context<AppBindings>) => {
      const { id } = idParamsSchema.parse(c.req.param());

      try {
        return c.json(
          await customerService.cancelAppointment(
            c.get("mobileAuthContext"),
            id,
          ),
        );
      } catch (error) {
        if (error instanceof CustomerError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },
  };
}
