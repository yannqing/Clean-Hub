import { Hono, type Context } from "hono";
import { z } from "zod";

import { getRequestMeta } from "../../../http/request-meta.js";
import type { AppBindings } from "../../../http/types.js";
import {
  getSaasUserDetail,
  updateSaasSelfProfile,
} from "../users/saas-users.service.js";
import { updateSaasUserBodySchema } from "../users/saas-users.validation.js";
import { SaasUsersError } from "../users/saas-users.errors.js";
import { changeSaasSelfPassword, SaasProfileError } from "./profile.service.js";

const changePasswordBodySchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(1).max(128),
  })
  .strict();

function respondWithError(
  c: Context<AppBindings>,
  error: SaasProfileError | SaasUsersError,
) {
  return c.json(
    { message: error.message, code: error.code, requestId: c.get("requestId") },
    error.status,
  );
}

export function createSaasProfileRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", async (c) => {
    try {
      return c.json(
        await getSaasUserDetail({
          authContext: c.get("authContext"),
          userId: c.get("authContext").userId,
        }),
      );
    } catch (error) {
      if (error instanceof SaasUsersError) return respondWithError(c, error);
      throw error;
    }
  });

  routes.patch("/", async (c) => {
    const data = updateSaasUserBodySchema.parse(
      await c.req.json().catch(() => ({})),
    );
    try {
      return c.json(
        await updateSaasSelfProfile({
          authContext: c.get("authContext"),
          requestMeta: getRequestMeta(c),
          data,
        }),
      );
    } catch (error) {
      if (error instanceof SaasUsersError) return respondWithError(c, error);
      throw error;
    }
  });

  routes.patch("/password", async (c) => {
    const data = changePasswordBodySchema.parse(
      await c.req.json().catch(() => ({})),
    );
    try {
      return c.json(
        await changeSaasSelfPassword({
          authContext: c.get("authContext"),
          requestMeta: getRequestMeta(c),
          ...data,
        }),
      );
    } catch (error) {
      if (error instanceof SaasProfileError) return respondWithError(c, error);
      throw error;
    }
  });

  return routes;
}
