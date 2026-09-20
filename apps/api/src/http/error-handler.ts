import { ZodError } from "zod";

import { AuthError } from "../modules/auth/auth.errors.js";
import type { AppBindings, ApiErrorResponse } from "./types.js";

function getAuthErrorStatus(error: AuthError): 400 | 401 | 403 | 422 | 500 {
  switch (error.code) {
    case "INVALID_CREDENTIALS":
    case "TOKEN_INVALID":
    case "TOKEN_EXPIRED":
    case "TOKEN_REUSE_DETECTED":
      return 401;
    case "USER_DISABLED":
    case "USER_SUSPENDED":
    case "FORBIDDEN":
    case "FEATURE_DISABLED":
    case "ACCOUNT_LOCKED":
    case "POS_TERMINAL_CREDENTIAL_INVALID":
    case "POS_TERMINAL_DISABLED":
    case "POS_TERMINAL_ENROLLMENT_REQUIRED":
    case "PASSWORD_CHANGE_REQUIRED":
      // PASSWORD_CHANGE_REQUIRED is 403, not 401: the session is valid, it is
      // simply not allowed anywhere else until the starter password is
      // replaced. A 401 would make the app sign the customer out instead of
      // sending them to the change-password screen.
      return 403;
    case "PASSWORD_POLICY_VIOLATION":
    case "TENANT_CODE_REQUIRED":
      return 422;
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
        ...(error.code === "ACCOUNT_LOCKED" &&
        error.lockedUntil &&
        Number.isFinite(error.lockedUntil.getTime())
          ? { lockedUntil: error.lockedUntil.toISOString() }
          : {}),
        requestId,
      },
      getAuthErrorStatus(error),
    );
  }

  // Surface the underlying cause (e.g. driver/connection errors wrapped by
  // Drizzle) so failures like pool connection timeouts are diagnosable instead
  // of being swallowed into an empty object.
  const cause = (error as { cause?: unknown }).cause;
  logger.error(
    {
      requestId,
      errName: error.name,
      errMessage: error.message,
      causeMessage: cause instanceof Error ? cause.message : undefined,
      causeCode:
        cause && typeof cause === "object" && "code" in cause
          ? (cause as { code?: unknown }).code
          : undefined,
      stack: error.stack,
    },
    "Unhandled API error",
  );

  return c.json<ApiErrorResponse>(
    {
      message: "Internal server error.",
      code: "INTERNAL_SERVER_ERROR",
      requestId,
    },
    500,
  );
}
