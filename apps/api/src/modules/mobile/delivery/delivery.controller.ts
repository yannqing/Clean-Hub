import type { Context } from "hono";
import { z } from "zod";

import type { AppBindings } from "../../../http/types.js";
import { DeliveryError } from "./delivery.types.js";
import type { DeliveryProofType } from "./delivery.types.js";
import type { DeliveryService } from "./delivery.service.js";

const taskIdParamsSchema = z.object({
  taskId: z.string().trim().min(1).max(120),
});

const idempotencyKeySchema = z.string().trim().min(1).max(120);
const coordinateSchema = z
  .union([z.string().trim().min(1).max(32), z.number()])
  .optional()
  .transform((value) => (value === undefined ? undefined : String(value)));
const deviceIdSchema = z.string().trim().min(1).max(120).optional();
const noteSchema = z.string().trim().min(1).max(1000).optional();

const statusBodySchema = z.object({
  toStatus: z.enum([
    "pending_dispatch",
    "en_route",
    "arrived",
    "picked_up",
    "delivering",
    "signed",
    "exception",
    "cancelled",
  ]),
  idempotencyKey: idempotencyKeySchema,
  lat: coordinateSchema,
  lng: coordinateSchema,
  deviceId: deviceIdSchema,
  note: noteSchema,
  exceptionReason: noteSchema,
});

const proofBodySchema = z.object({
  type: z.enum(["pickup", "dropoff"]),
  idempotencyKey: idempotencyKeySchema,
  mediaRef: z.string().trim().min(1).max(20_000).optional(),
  base64: z.string().trim().min(1).max(20_000_000).optional(),
  mimeType: z.string().trim().min(1).max(120).optional(),
  deviceId: deviceIdSchema,
  capturedAt: z.string().datetime().optional(),
});

const signatureBodySchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  signatureMediaRef: z.string().trim().min(1).max(20_000).optional(),
  signatureBase64: z.string().trim().min(1).max(20_000_000).optional(),
  mimeType: z.string().trim().min(1).max(120).optional(),
  lat: coordinateSchema,
  lng: coordinateSchema,
  deviceId: deviceIdSchema,
  capturedAt: z.string().datetime().optional(),
  signedByName: z.string().trim().min(1).max(200).optional(),
});

const assignTaskBodySchema = z.object({
  tenantId: z.string().trim().min(1).max(120),
  branchId: z.string().trim().min(1).max(120),
  assigneeUserId: z.string().trim().min(1).max(120),
  customerId: z.string().trim().min(1).max(120),
  type: z.enum(["pickup", "dropoff"]),
  customerName: z.string().trim().min(1).max(200),
  customerPhone: z.string().trim().min(1).max(32).optional(),
  address: z.string().trim().min(1).max(2000),
  orderId: z.string().trim().min(1).max(120).optional(),
  ticketId: z.string().trim().min(1).max(120).optional(),
  expectedAt: z.string().datetime().optional(),
  notes: z.string().trim().min(1).max(2000).optional(),
});

export type DeliveryControllerOptions = {
  deliveryService: DeliveryService;
};

async function readJson(c: Context<AppBindings>): Promise<unknown> {
  return c.req.json().catch(() => ({}));
}

async function readBody(c: Context<AppBindings>): Promise<Record<string, unknown>> {
  const contentType = c.req.header("content-type") ?? "";

  if (contentType.toLowerCase().includes("multipart/form-data")) {
    return c.req.parseBody();
  }

  const body = await readJson(c);

  return typeof body === "object" && body !== null
    ? (body as Record<string, unknown>)
    : {};
}

function errorResponse(c: Context<AppBindings>, error: DeliveryError) {
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

function parseDate(value: string | undefined): Date | undefined {
  return value ? new Date(value) : undefined;
}

function isUploadFile(value: unknown): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    typeof (value as { arrayBuffer?: unknown }).arrayBuffer === "function"
  );
}

async function fileToDataUri(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";

  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

async function resolveMediaRef(input: {
  mediaRef?: string;
  base64?: string;
  mimeType?: string;
  file?: unknown;
  fallbackPrefix: "proof" | "signature";
}): Promise<string> {
  if (input.mediaRef) {
    return input.mediaRef;
  }

  if (isUploadFile(input.file)) {
    return fileToDataUri(input.file);
  }

  if (input.base64) {
    const mimeType = input.mimeType ?? "application/octet-stream";

    return `data:${mimeType};base64,${input.base64}`;
  }

  throw new DeliveryError(
    "DELIVERY_VALIDATION_ERROR",
    `${input.fallbackPrefix} media is required.`,
    422,
  );
}

export function createDeliveryController({
  deliveryService,
}: DeliveryControllerOptions) {
  return {
    listTodayTasks: async (c: Context<AppBindings>) => {
      try {
        const data = await deliveryService.listTodayTasks(
          c.get("mobileAuthContext"),
        );

        return c.json({ data });
      } catch (error) {
        if (error instanceof DeliveryError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    getTaskDetail: async (c: Context<AppBindings>) => {
      const { taskId } = taskIdParamsSchema.parse(c.req.param());

      try {
        return c.json(
          await deliveryService.getTaskDetail(
            c.get("mobileAuthContext"),
            taskId,
          ),
        );
      } catch (error) {
        if (error instanceof DeliveryError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    updateStatus: async (c: Context<AppBindings>) => {
      const { taskId } = taskIdParamsSchema.parse(c.req.param());
      const body = statusBodySchema.parse(await readBody(c));

      try {
        return c.json(
          await deliveryService.updateStatus({
            authContext: c.get("mobileAuthContext"),
            taskId,
            toStatus: body.toStatus,
            idempotencyKey: body.idempotencyKey,
            lat: body.lat,
            lng: body.lng,
            deviceId: body.deviceId,
            note: body.note,
            exceptionReason: body.exceptionReason,
          }),
        );
      } catch (error) {
        if (error instanceof DeliveryError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    uploadProof: async (c: Context<AppBindings>) => {
      const { taskId } = taskIdParamsSchema.parse(c.req.param());
      const rawBody = await readBody(c);
      const body = proofBodySchema.parse(rawBody);

      try {
        return c.json(
          await deliveryService.uploadProof({
            authContext: c.get("mobileAuthContext"),
            taskId,
            type: body.type as Exclude<DeliveryProofType, "signature">,
            mediaRef: await resolveMediaRef({
              mediaRef: body.mediaRef,
              base64: body.base64,
              mimeType: body.mimeType,
              file: rawBody.file ?? rawBody.photo ?? rawBody.media,
              fallbackPrefix: "proof",
            }),
            idempotencyKey: body.idempotencyKey,
            deviceId: body.deviceId,
            capturedAt: parseDate(body.capturedAt),
          }),
          201,
        );
      } catch (error) {
        if (error instanceof DeliveryError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    signTask: async (c: Context<AppBindings>) => {
      const { taskId } = taskIdParamsSchema.parse(c.req.param());
      const rawBody = await readBody(c);
      const body = signatureBodySchema.parse(rawBody);

      try {
        return c.json(
          await deliveryService.signTask({
            authContext: c.get("mobileAuthContext"),
            taskId,
            signatureMediaRef: await resolveMediaRef({
              mediaRef: body.signatureMediaRef,
              base64: body.signatureBase64,
              mimeType: body.mimeType,
              file: rawBody.file ?? rawBody.signature ?? rawBody.media,
              fallbackPrefix: "signature",
            }),
            idempotencyKey: body.idempotencyKey,
            lat: body.lat,
            lng: body.lng,
            deviceId: body.deviceId,
            capturedAt: parseDate(body.capturedAt),
            signedByName: body.signedByName,
          }),
        );
      } catch (error) {
        if (error instanceof DeliveryError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    createAssignedTask: async (c: Context<AppBindings>) => {
      const body = assignTaskBodySchema.parse(await readBody(c));

      try {
        return c.json(
          await deliveryService.createAssignedTask({
            authContext: c.get("mobileAuthContext"),
            tenantId: body.tenantId,
            branchId: body.branchId,
            assigneeUserId: body.assigneeUserId,
            customerId: body.customerId,
            type: body.type,
            customerName: body.customerName,
            customerPhone: body.customerPhone,
            address: body.address,
            orderId: body.orderId,
            ticketId: body.ticketId,
            expectedAt: parseDate(body.expectedAt),
            notes: body.notes,
          }),
          201,
        );
      } catch (error) {
        if (error instanceof DeliveryError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },
  };
}
