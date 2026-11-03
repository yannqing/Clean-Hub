import { isApiHttpError } from "@cleanhub/api-client";

import { posRoutes } from "@/config/routes";

const TERMINAL_SESSION_ERROR_CODES = new Set([
  "POS_TERMINAL_DISABLED",
  "POS_TERMINAL_CREDENTIAL_INVALID",
  "POS_TERMINAL_ENROLLMENT_REQUIRED",
]);

export const POS_TERMINAL_SESSION_INVALIDATED_EVENT =
  "cleanhub:pos-terminal-session-invalidated";

let terminalSessionInvalidated = false;
let loginRedirectStarted = false;

export function isPosTerminalSessionError(error: unknown): boolean {
  return (
    isApiHttpError(error) &&
    error.status === 403 &&
    typeof error.code === "string" &&
    TERMINAL_SESSION_ERROR_CODES.has(error.code)
  );
}

export function isPosTerminalSessionInvalidated(): boolean {
  return terminalSessionInvalidated;
}

export function redirectToPosLogin(): void {
  if (typeof window === "undefined" || loginRedirectStarted) {
    return;
  }

  loginRedirectStarted = true;
  if (window.location.pathname === posRoutes.login) {
    // A terminal can be disabled between bootstrap and PIN submission.
    // Reloading lets the login gate bootstrap again and also clears this
    // document's invalidated-session latch before any later successful login.
    window.location.reload();
    return;
  }

  window.location.replace(posRoutes.login);
}

/**
 * Stop all work for the current terminal before navigating. The navigation is
 * deliberately a hard replace so the next login render runs through the
 * server proxy and the bootstrap endpoint instead of reusing stale RSC state.
 */
export function invalidatePosTerminalSession(): void {
  // This module is also present in the Next.js server bundle. Never retain
  // request-specific terminal state in the shared server process.
  if (typeof window === "undefined") {
    return;
  }

  if (!terminalSessionInvalidated) {
    terminalSessionInvalidated = true;
    window.dispatchEvent(new Event(POS_TERMINAL_SESSION_INVALIDATED_EVENT));
  }

  redirectToPosLogin();
}
