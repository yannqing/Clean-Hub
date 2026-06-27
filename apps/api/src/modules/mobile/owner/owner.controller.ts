import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import type { OwnerService } from "./owner.service.js";
import { OwnerError } from "./owner.types.js";

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
  };
}
