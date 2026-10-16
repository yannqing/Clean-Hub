import type { Context } from "hono";
import { z } from "zod";

import type { AppBindings } from "../../../http/types.js";
import type { MobileNotificationsService } from "./notifications.service.js";
import { MobileNotificationsError } from "./notifications.types.js";

const registerDeviceTokenBodySchema = z.object({
  token: z.string().trim().min(1).max(4096),
  platform: z.enum(["android", "ios", "web"]),
  deviceId: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .nullable()
    .optional()
    .transform((value) => (value === "" ? null : value)),
  locale: z
    .string()
    .trim()
    .min(1)
    .max(16)
    .nullable()
    .optional()
    .transform((value) => (value === "" ? null : value)),
});

const unregisterDeviceTokenBodySchema = z.object({
  token: z.string().trim().min(1).max(4096),
});

export type MobileNotificationsControllerOptions = {
  notificationsService: MobileNotificationsService;
};

async function readJson(c: Context<AppBindings>): Promise<unknown> {
  return c.req.json().catch(() => ({}));
}

function errorResponse(
  c: Context<AppBindings>,
  error: MobileNotificationsError,
) {
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

export function createMobileNotificationsController({
  notificationsService,
}: MobileNotificationsControllerOptions) {
  return {
    registerDeviceToken: async (c: Context<AppBindings>) => {
      const body = registerDeviceTokenBodySchema.parse(await readJson(c));

      try {
        return c.json(
          await notificationsService.registerDeviceToken(
            c.get("mobileAuthContext"),
            body,
          ),
          201,
        );
      } catch (error) {
        if (error instanceof MobileNotificationsError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },

    unregisterDeviceToken: async (c: Context<AppBindings>) => {
      const queryToken = c.req.query("token");
      const body = unregisterDeviceTokenBodySchema.parse(
        queryToken ? { token: queryToken } : await readJson(c),
      );

      try {
        return c.json(
          await notificationsService.unregisterDeviceToken(
            c.get("mobileAuthContext"),
            body,
          ),
        );
      } catch (error) {
        if (error instanceof MobileNotificationsError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },
  };
}
