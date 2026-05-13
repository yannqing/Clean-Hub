import { ZodError } from "zod";

import { AuthError } from "../modules/auth/auth.errors.js";
import type { AppBindings, ApiErrorResponse } from "./types.js";

function getAuthErrorStatus(error: AuthError): 400 | 401 | 403 | 500 {
  switch (error.code) {
    case "INVALID_CREDENTIALS":
    case "TOKEN_INVALID":
    case "TOKEN_EXPIRED":
    case "TOKEN_REUSE_DETECTED":
      return 401;
    case "USER_DISABLED":
    case "USER_SUSPENDED":
    case "FORBIDDEN":
      return 403;
    case "AUTH_CONFIG_INVALID":
      return 500;
    default:
      return 400;
  }
}

export function handleApiError(error: Error, c: import("hono").Context<AppBindings>) {
  const requestId = c.get("requestId");
  const logger = c.get("logger");

  if (error instanceof ZodError) {
    return c.json<ApiErrorResponse>(
      {
        message: "Request validation failed.",
        code: "VALIDATION_ERROR",
        requestId,
        validationErrors: error.flatten(),
      },
      422,
    );
  }

  if (error instanceof AuthError) {
    return c.json<ApiErrorResponse>(
      {
        message: error.message,
        code: error.code,
        requestId,
      },
      getAuthErrorStatus(error),
    );
  }

  logger.error({ error, requestId }, "Unhandled API error");

  return c.json<ApiErrorResponse>(
    {
      message: "Internal server error.",
      code: "INTERNAL_SERVER_ERROR",
      requestId,
    },
    500,
  );
}
