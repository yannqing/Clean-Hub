import type { Context } from "hono";
import { z } from "zod";

import type { AppBindings } from "../../../http/types.js";
import type { PaymentService } from "./payment.service.js";
import { PaymentError } from "./payment.types.js";
import type { PaymentGatewayName } from "./payment.types.js";

const amountSchema = z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/);
const idempotencyKeySchema = z.string().trim().min(1).max(120);

const orderParamsSchema = z.object({
  orderId: z.string().trim().min(1).max(120),
});

const paymentParamsSchema = z.object({
  paymentId: z.string().trim().min(1).max(120),
});

const refundParamsSchema = z.object({
  refundRequestId: z.string().trim().min(1).max(120),
});

const webhookParamsSchema = z.object({
  gateway: z.enum(["mock"]),
});

const createPaymentBodySchema = z.object({
  amount: amountSchema,
  idempotencyKey: idempotencyKeySchema,
});

const createRefundBodySchema = z.object({
  amount: amountSchema,
  reason: z.string().trim().min(1).max(1000),
});

const simulateMockPaymentBodySchema = z.object({
  status: z.enum(["paid", "failed"]),
});

const rejectRefundBodySchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});

const refundListQuerySchema = z.object({
  status: z
    .enum(["pending", "approved", "processing", "rejected", "refunded", "failed"])
    .optional(),
});

export type PaymentControllerOptions = {
  paymentService: PaymentService;
};

async function readJson(c: Context<AppBindings>): Promise<unknown> {
  return c.req.json().catch(() => ({}));
}

async function readObject(c: Context<AppBindings>): Promise<Record<string, unknown>> {
  const body = await readJson(c);

  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

function errorResponse(c: Context<AppBindings>, error: PaymentError) {
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

function collectHeaders(c: Context<AppBindings>): Record<string, string | undefined> {
  return {
    "x-cleanhub-mock-signature": c.req.header("x-cleanhub-mock-signature"),
  };
}

export function createPaymentController({
  paymentService,
}: PaymentControllerOptions) {
  return {
    createPayment: async (c: Context<AppBindings>) => {
      const params = orderParamsSchema.parse(c.req.param());
      const body = createPaymentBodySchema.parse(await readObject(c));

      try {
        return c.json(
          await paymentService.createPayment({
            authContext: c.get("mobileAuthContext"),
            orderId: params.orderId,
            amount: body.amount,
            idempotencyKey: body.idempotencyKey,
          }),
          201,
        );
      } catch (error) {
        if (error instanceof PaymentError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    getPaymentStatus: async (c: Context<AppBindings>) => {
      const params = paymentParamsSchema.parse(c.req.param());

      try {
        return c.json(
          await paymentService.getPaymentStatus({
            authContext: c.get("mobileAuthContext"),
            paymentId: params.paymentId,
          }),
        );
      } catch (error) {
        if (error instanceof PaymentError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    simulateMockPayment: async (c: Context<AppBindings>) => {
      const params = paymentParamsSchema.parse(c.req.param());
      const body = simulateMockPaymentBodySchema.parse(await readObject(c));

      try {
        return c.json(
          await paymentService.simulateMockPayment({
            authContext: c.get("mobileAuthContext"),
            paymentId: params.paymentId,
            status: body.status,
          }),
        );
      } catch (error) {
        if (error instanceof PaymentError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    createRefundRequest: async (c: Context<AppBindings>) => {
      const params = orderParamsSchema.parse(c.req.param());
      const body = createRefundBodySchema.parse(await readObject(c));

      try {
        return c.json(
          await paymentService.createRefundRequest({
            authContext: c.get("mobileAuthContext"),
            orderId: params.orderId,
            amount: body.amount,
            reason: body.reason,
          }),
          201,
        );
      } catch (error) {
        if (error instanceof PaymentError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    listRefundRequests: async (c: Context<AppBindings>) => {
      const query = refundListQuerySchema.parse(c.req.query());

      try {
        return c.json({
          data: await paymentService.listRefundRequests({
            authContext: c.get("mobileAuthContext"),
            status: query.status,
          }),
        });
      } catch (error) {
        if (error instanceof PaymentError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    getRefundOrderDetail: async (c: Context<AppBindings>) => {
      const params = refundParamsSchema.parse(c.req.param());

      try {
        return c.json(
          await paymentService.getRefundOrderDetail(
            c.get("mobileAuthContext"),
            params.refundRequestId,
          ),
        );
      } catch (error) {
        if (error instanceof PaymentError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    approveRefundRequest: async (c: Context<AppBindings>) => {
      const params = refundParamsSchema.parse(c.req.param());

      try {
        return c.json(
          await paymentService.approveRefundRequest({
            authContext: c.get("mobileAuthContext"),
            refundRequestId: params.refundRequestId,
          }),
        );
      } catch (error) {
        if (error instanceof PaymentError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    rejectRefundRequest: async (c: Context<AppBindings>) => {
      const params = refundParamsSchema.parse(c.req.param());
      const body = rejectRefundBodySchema.parse(await readObject(c));

      try {
        return c.json(
          await paymentService.rejectRefundRequest({
            authContext: c.get("mobileAuthContext"),
            refundRequestId: params.refundRequestId,
            reason: body.reason,
          }),
        );
      } catch (error) {
        if (error instanceof PaymentError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    handleWebhook: async (c: Context<AppBindings>) => {
      const params = webhookParamsSchema.parse(c.req.param());
      const payload = await readObject(c);

      try {
        return c.json(
          await paymentService.handleWebhook({
            gateway: params.gateway as PaymentGatewayName,
            payload,
            headers: collectHeaders(c),
          }),
        );
      } catch (error) {
        if (error instanceof PaymentError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },
  };
}
