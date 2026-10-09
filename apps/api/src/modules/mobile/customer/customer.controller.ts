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

const nullableTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value === "" ? null : value));

const updateProfileBodySchema = z
  .object({
    accountName: z.string().trim().min(1).max(200).optional(),
    phone: nullableTrimmed(32),
    email: z
      .string()
      .trim()
      .email()
      .max(320)
      .nullable()
      .optional()
      .transform((value) => (value === "" ? null : value?.toLowerCase())),
  })
  .refine(
    (value) =>
      value.accountName !== undefined ||
      value.phone !== undefined ||
      value.email !== undefined,
    { message: "At least one profile field is required." },
  );

const contactBodySchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  phone: nullableTrimmed(32),
  email: z
    .string()
    .trim()
    .email()
    .max(320)
    .nullable()
    .optional()
    .transform((value) => (value === "" ? null : value?.toLowerCase())),
  relationship: nullableTrimmed(80),
  address: nullableTrimmed(2000),
});

const addressBodySchema = z.object({
  customerId: nullableTrimmed(120),
  label: z.string().trim().min(1).max(80),
  contactName: nullableTrimmed(200),
  contactPhone: nullableTrimmed(32),
  addressLine1: z.string().trim().min(1).max(2000),
  addressLine2: nullableTrimmed(2000),
  city: nullableTrimmed(120),
  province: nullableTrimmed(120),
  postalCode: nullableTrimmed(32),
  country: z.string().trim().length(2).optional(),
  latitude: nullableTrimmed(32),
  longitude: nullableTrimmed(32),
  isDefault: z.boolean().optional(),
  notes: nullableTrimmed(2000),
});

const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1).max(1024),
  newPassword: z.string().min(1).max(1024),
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

    updateProfile: async (c: Context<AppBindings>) => {
      const body = updateProfileBodySchema.parse(await readJson(c));

      try {
        return c.json(
          await customerService.updateProfile(c.get("mobileAuthContext"), body),
        );
      } catch (error) {
        if (error instanceof CustomerError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    createContact: async (c: Context<AppBindings>) => {
      const body = contactBodySchema.parse(await readJson(c));

      try {
        return c.json(
          await customerService.createContact(c.get("mobileAuthContext"), body),
          201,
        );
      } catch (error) {
        if (error instanceof CustomerError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    updateContact: async (c: Context<AppBindings>) => {
      const { id } = idParamsSchema.parse(c.req.param());
      const body = contactBodySchema.parse(await readJson(c));

      try {
        return c.json(
          await customerService.updateContact(
            c.get("mobileAuthContext"),
            id,
            body,
          ),
        );
      } catch (error) {
        if (error instanceof CustomerError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    deleteContact: async (c: Context<AppBindings>) => {
      const { id } = idParamsSchema.parse(c.req.param());

      try {
        return c.json(
          await customerService.deleteContact(c.get("mobileAuthContext"), id),
        );
      } catch (error) {
        if (error instanceof CustomerError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    listAddresses: async (c: Context<AppBindings>) => {
      try {
        return c.json({
          data: await customerService.listAddresses(c.get("mobileAuthContext")),
        });
      } catch (error) {
        if (error instanceof CustomerError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    listBranches: async (c: Context<AppBindings>) => {
      try {
        return c.json({
          data: await customerService.listBranches(c.get("mobileAuthContext")),
        });
      } catch (error) {
        if (error instanceof CustomerError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    createAddress: async (c: Context<AppBindings>) => {
      const body = addressBodySchema.parse(await readJson(c));

      try {
        return c.json(
          await customerService.createAddress(c.get("mobileAuthContext"), body),
          201,
        );
      } catch (error) {
        if (error instanceof CustomerError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    updateAddress: async (c: Context<AppBindings>) => {
      const { id } = idParamsSchema.parse(c.req.param());
      const body = addressBodySchema.parse(await readJson(c));

      try {
        return c.json(
          await customerService.updateAddress(
            c.get("mobileAuthContext"),
            id,
            body,
          ),
        );
      } catch (error) {
        if (error instanceof CustomerError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    deleteAddress: async (c: Context<AppBindings>) => {
      const { id } = idParamsSchema.parse(c.req.param());

      try {
        return c.json(
          await customerService.deleteAddress(c.get("mobileAuthContext"), id),
        );
      } catch (error) {
        if (error instanceof CustomerError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    setDefaultAddress: async (c: Context<AppBindings>) => {
      const { id } = idParamsSchema.parse(c.req.param());

      try {
        return c.json(
          await customerService.setDefaultAddress(
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

    changePassword: async (c: Context<AppBindings>) => {
      const body = changePasswordBodySchema.parse(await readJson(c));

      try {
        return c.json(
          await customerService.changePassword(
            c.get("mobileAuthContext"),
            body,
          ),
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
