import type { PosBootstrapResponse } from "@cleanhub/api-client";

import { getOrCreatePosDeviceId } from "@/features/auth/utils/device-id";
import {
  invalidatePosTerminalSession,
  isPosTerminalSessionInvalidated,
} from "@/lib/pos-terminal-session";

import {
  fetchSetupAuthContext,
  fetchTerminalBootstrap,
} from "./api";

const HEALTH_CHECK_COOLDOWN_MS = 5_000;
const HEALTH_CHECK_TIMEOUT_MS = 5_000;

export type PosTerminalHealthResult = "ready" | "unavailable" | "invalid";

let healthCheckPromise: Promise<PosTerminalHealthResult> | null = null;
let lastHealthCheckAt = 0;
let lastHealthResult: PosTerminalHealthResult | null = null;

function isOperatingSession(bootstrap: PosBootstrapResponse): boolean {
  return bootstrap.status === "enrolled";
}

async function runHealthCheck(): Promise<PosTerminalHealthResult> {
  if (isPosTerminalSessionInvalidated()) {
    return "invalid";
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "unavailable";
  }

  try {
    const deviceId = await getOrCreatePosDeviceId();
    // Bootstrap intentionally treats an expired access token as anonymous.
    // Resolve `/auth/me` first so the shared client can refresh a legitimate
    // long-running cashier session before bootstrap makes its decision.
    await fetchSetupAuthContext({
      timeoutMs: HEALTH_CHECK_TIMEOUT_MS,
      metadata: { posTerminalHealthCheck: true },
    });
    const bootstrap = await fetchTerminalBootstrap(deviceId, {
      timeoutMs: HEALTH_CHECK_TIMEOUT_MS,
      metadata: { posTerminalHealthCheck: true },
    });

    if (isOperatingSession(bootstrap)) {
      return "ready";
    }

    invalidatePosTerminalSession();
    return "invalid";
  } catch {
    if (isPosTerminalSessionInvalidated()) {
      return "invalid";
    }

    // Network and transient server failures must not de-register a terminal.
    return "unavailable";
  }
}

/**
 * Coalesces visibility, pageshow, online and offline-replay checks into one
 * request. A short cooldown prevents mobile lifecycle events from producing a
 * burst of bootstrap requests when an app returns to the foreground.
 */
export function verifyPosTerminalSession(
  options: { force?: boolean } = {},
): Promise<PosTerminalHealthResult> {
  if (isPosTerminalSessionInvalidated()) {
    return Promise.resolve("invalid");
  }

  const now = Date.now();
  if (
    !options.force &&
    lastHealthResult &&
    now - lastHealthCheckAt < HEALTH_CHECK_COOLDOWN_MS
  ) {
    return Promise.resolve(lastHealthResult);
  }

  if (healthCheckPromise) {
    return healthCheckPromise;
  }

  healthCheckPromise = runHealthCheck()
    .then((result) => {
      lastHealthCheckAt = Date.now();
      lastHealthResult = result;
      return result;
    })
    .finally(() => {
      healthCheckPromise = null;
    });

  return healthCheckPromise;
}
