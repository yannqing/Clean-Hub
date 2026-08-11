"use server";

import type { AuthContext } from "@cleanhub/api-client";
import { headers } from "next/headers";

import { getWebAdminHomePath } from "@/config/auth-routing";
import { webAdminApi } from "@/lib/api-client";

import {
  validateLoginForm,
  type LoginFormFieldErrors,
  type LoginFormValues,
} from "../validators/login-form.validator";
import { applyAuthCookies } from "./auth-cookie.helper";

type LoginActionResult =
  | {
      ok: true;
      data: AuthContext;
    }
  | {
      ok: false;
      errors: LoginFormFieldErrors;
      errorCode: "invalidForm" | "accessDenied" | "signInFailed";
      message: string;
    };

function getLoginErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Failed to sign in.";
}

/**
 * Server action for the web-admin login form.
 *
 * Validates the form with the shared `loginFormSchema` (the same schema the
 * client uses through `react-hook-form`), calls /auth/login, and returns a
 * structured result. The client component owns the bits that can only run in
 * the browser: generating the device id (localStorage), showing toasts, and
 * redirecting based on role.
 */
export async function loginAction(
  input: LoginFormValues & { deviceId: string },
): Promise<LoginActionResult> {
  // Re-validate server-side; the client also validates, but never trust it
  // alone. `loginFormSchema` is the single source of truth for the rules.
  const validationErrors = validateLoginForm(input);

  if (validationErrors) {
    return {
      ok: false,
      errors: validationErrors,
      errorCode: "invalidForm",
      message: "Please check the login form.",
    };
  }

  try {
    const incomingHeaders = await headers();
    const forwardedHeaders: Record<string, string> = {};
    const userAgent = incomingHeaders.get("user-agent");
    const forwardedFor = incomingHeaders.get("x-forwarded-for");

    if (userAgent) {
      forwardedHeaders["user-agent"] = userAgent;
    }

    if (forwardedFor) {
      forwardedHeaders["x-forwarded-for"] = forwardedFor;
    }

    let loginResponse: Response | undefined;
    const result = await webAdminApi.auth.login(
      {
        identifier: input.identifier,
        password: input.password,
        deviceId: input.deviceId,
      },
      {
        headers: forwardedHeaders,
        afterResponse: (response) => {
          loginResponse = response;
        },
      },
    );

    if (!getWebAdminHomePath(result.authContext)) {
      return {
        ok: false,
        errors: {},
        errorCode: "accessDenied",
        message:
          "This account cannot access CleanHub Web Admin. Sign in with an owner, manager, or platform administrator account.",
      };
    }

    if (!loginResponse) {
      throw new Error(
        "The API did not return an authenticated browser response.",
      );
    }

    const appliedCookieNames = await applyAuthCookies(loginResponse);

    if (
      !appliedCookieNames.has("cleanhub_access_token") ||
      !appliedCookieNames.has("cleanhub_refresh_token")
    ) {
      throw new Error(
        "The API did not establish an authenticated browser session.",
      );
    }

    return {
      ok: true,
      data: result.authContext,
    };
  } catch (error) {
    return {
      ok: false,
      errors: {},
      errorCode: "signInFailed",
      message: getLoginErrorMessage(error),
    };
  }
}
