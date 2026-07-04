"use server";

import type { AuthContext } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

import {
  validateLoginForm,
  type LoginFormFieldErrors,
  type LoginFormValues,
} from "../validators/login-form.validator";

type LoginActionResult =
  | {
      ok: true;
      data: AuthContext;
    }
  | {
      ok: false;
      errors: LoginFormFieldErrors;
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
      message: "Please check the login form.",
    };
  }

  try {
    const result = await webAdminApi.auth.login({
      identifier: input.identifier,
      password: input.password,
      tenantCode: input.loginMode === "tenant" ? input.tenantCode.trim() : undefined,
      deviceId: input.deviceId,
    });

    return {
      ok: true,
      data: result.authContext,
    };
  } catch (error) {
    return {
      ok: false,
      errors: {},
      message: getLoginErrorMessage(error),
    };
  }
}
