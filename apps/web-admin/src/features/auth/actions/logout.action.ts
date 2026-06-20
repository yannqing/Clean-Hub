"use server";

import { webAdminApi } from "@/lib/api-client";

type LogoutActionResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
    };

function getLogoutErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Failed to sign out cleanly.";
}

/**
 * Server action for web-admin logout. Calls /auth/logout to clear the server
 * session. The client component handles the toast and redirect regardless of
 * the result (logging out should always return the user to the login page).
 */
export async function logoutAction(): Promise<LogoutActionResult> {
  try {
    await webAdminApi.auth.logout();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: getLogoutErrorMessage(error),
    };
  }
}
