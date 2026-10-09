import { upgradeWebSocket } from "@hono/node-server";
import { and, eq, isNull } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { getCookie } from "hono/cookie";
import { ZodError } from "zod";

import {
  branches,
  getDb,
  runWithSystemDatabaseContext,
  runWithTenantDatabaseContext,
} from "@cleanhub/db";
import {
  POS_REALTIME_PROTOCOL_VERSION,
  type PosRealtimeErrorMessage,
  type PosRealtimePong,
  type PosRealtimeStatusAck,
  type PosTerminalRealtimeStatusReport,
  type TenantRealtimePong,
} from "@cleanhub/domain/pos-terminal-status";

import type { ApiEnv } from "../config/env.js";
import { resolveCredentialedCorsOrigin } from "../http/cors-origin.js";
import type { AppBindings } from "../http/types.js";
import { resolveAllowedBranchIds } from "../modules/auth/branch-scope.helper.js";
import {
  ACCESS_COOKIE_NAME,
  POS_ACCESS_COOKIE_NAME,
} from "../modules/auth/cookie.service.js";
import { AuthError } from "../modules/auth/auth.errors.js";
import {
  assertActiveTenant,
  requireTenantRole,
} from "../modules/auth/permission.helper.js";
import type { AuthService } from "../modules/auth/auth.service.js";
import { requirePosTerminalContext } from "../modules/pos/access-control.helper.js";
import { persistRealtimeStatusReport } from "./realtime.repository.js";
import {
  createRealtimeConnectionId,
  parseAccessTokenExpiry,
  RealtimeHub,
} from "./realtime.hub.js";
import {
  REALTIME_HEARTBEAT_INTERVAL_MS,
  REALTIME_LEASE_DURATION_MS,
  type PosRealtimeIdentity,
  type TenantRealtimeIdentity,
} from "./realtime.types.js";
import {
  parseRealtimeJsonMessage,
  posRealtimeClientMessageSchema,
  RealtimeMessageValidationError,
  tenantRealtimePingSchema,
} from "./realtime.validation.js";

const POS_REALTIME_SUBPROTOCOL = "cleanhub.pos.v1";
const TENANT_REALTIME_SUBPROTOCOL = "cleanhub.tenant.v1";
const MAX_MESSAGES_PER_SECOND = 10;
const MAX_HANDSHAKES_PER_MINUTE_PER_IP = 120;

type CreateRealtimeRoutesOptions = {
  authService: AuthService;
  env: ApiEnv;
  hub: RealtimeHub;
};

function assertRealtimeOrigin(
  c: Parameters<typeof resolveCredentialedCorsOrigin>[0],
) {
  if (!resolveCredentialedCorsOrigin(c)) {
    throw new AuthError("FORBIDDEN", "Realtime request origin is not allowed.");
  }
}

function assertSubprotocol(value: string | undefined, expected: string): void {
  const protocols = value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!protocols?.includes(expected)) {
    throw new AuthError(
      "FORBIDDEN",
      `Realtime subprotocol ${expected} is required.`,
    );
  }
}

function realtimeError(
  code: string,
  message: string,
  retryable: boolean,
): PosRealtimeErrorMessage {
  return {
    type: "realtime.error",
    protocolVersion: POS_REALTIME_PROTOCOL_VERSION,
    code,
    message,
    retryable,
    serverTime: new Date().toISOString(),
  };
}

function createRateLimiter() {
  let windowStartedAt = Date.now();
  let count = 0;
  return () => {
    const now = Date.now();
    if (now - windowStartedAt >= 1_000) {
      windowStartedAt = now;
      count = 0;
    }
    count += 1;
    return count <= MAX_MESSAGES_PER_SECOND;
  };
}

async function authenticatePosRealtime(
  c: Context<AppBindings>,
  authService: AuthService,
): Promise<PosRealtimeIdentity> {
  const accessToken = getCookie(c, POS_ACCESS_COOKIE_NAME);
  if (!accessToken) {
    throw new AuthError("TOKEN_INVALID", "POS access token is required.");
  }

  const authContext = await runWithSystemDatabaseContext(() =>
    authService.getAuthContext(accessToken),
  );
  const terminal = requirePosTerminalContext(authContext);
  return {
    kind: "pos",
    connectionId: createRealtimeConnectionId(),
    authContext,
    tenantId: terminal.tenantId,
    branchId: terminal.branchId,
    terminalId: terminal.terminalId,
    deviceId: terminal.deviceId,
    credentialVersion: terminal.credentialVersion,
    accessTokenExpiresAt: parseAccessTokenExpiry(
      authContext.accessTokenExpiresAt,
    ),
  };
}

async function authenticateTenantRealtime(
  c: Context<AppBindings>,
  authService: AuthService,
): Promise<TenantRealtimeIdentity> {
  const accessToken = getCookie(c, ACCESS_COOKIE_NAME);
  if (!accessToken) {
    throw new AuthError("TOKEN_INVALID", "Tenant access token is required.");
  }

  const authContext = await runWithSystemDatabaseContext(() =>
    authService.getAuthContext(accessToken),
  );
  requireTenantRole(authContext, ["owner", "manager"]);
  const tenantId = authContext.tenantId!;
  const branchIds = await runWithTenantDatabaseContext(tenantId, async () => {
    await assertActiveTenant(authContext);
    const allowed = await resolveAllowedBranchIds(authContext);
    if (allowed !== "all") return allowed;

    return getDb()
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.tenantId, tenantId), isNull(branches.deletedAt)))
      .then((rows) => rows.map((row) => row.id));
  });

  return {
    kind: "tenant",
    connectionId: createRealtimeConnectionId(),
    authContext,
    tenantId,
    branchIds: new Set(branchIds),
    accessTokenExpiresAt: parseAccessTokenExpiry(
      authContext.accessTokenExpiresAt,
    ),
  };
}

export function createRealtimeRoutes({
  authService,
  env,
  hub,
}: CreateRealtimeRoutesOptions) {
  const routes = new Hono<AppBindings>();
  const handshakeWindows = new Map<
    string,
    { startedAt: number; count: number }
  >();

  const assertHandshakeRate = (c: Context<AppBindings>) => {
    const now = Date.now();
    const forwardedFor = c.req
      .header("x-forwarded-for")
      ?.split(",", 1)[0]
      ?.trim();
    const clientKey =
      forwardedFor || c.req.header("x-real-ip") || "direct-client";
    const current = handshakeWindows.get(clientKey);
    if (!current || now - current.startedAt >= 60_000) {
      handshakeWindows.set(clientKey, { startedAt: now, count: 1 });
    } else {
      current.count += 1;
      if (current.count > MAX_HANDSHAKES_PER_MINUTE_PER_IP) {
        throw new AuthError(
          "FORBIDDEN",
          "Realtime connection rate limit exceeded.",
        );
      }
    }

    if (handshakeWindows.size > 10_000) {
      for (const [key, window] of handshakeWindows) {
        if (now - window.startedAt >= 60_000) handshakeWindows.delete(key);
      }
    }
  };

  routes.get(
    "/pos",
    upgradeWebSocket(
      async (c) => {
        assertHandshakeRate(c);
        assertRealtimeOrigin({
          origin: c.req.header("origin"),
          allowedOrigins: env.corsOrigins,
          enforceSameOrigin: env.corsEnforceSameOrigin,
          requestUrl: c.req.url,
          forwardedProto: c.req.header("x-forwarded-proto"),
          forwardedHost: c.req.header("x-forwarded-host"),
        });
        assertSubprotocol(
          c.req.header("sec-websocket-protocol"),
          POS_REALTIME_SUBPROTOCOL,
        );
        const identity = await authenticatePosRealtime(c, authService);
        const allowMessage = createRateLimiter();
        let invalidMessageCount = 0;
        let processing = Promise.resolve();
        let finalized = false;
        const finalize = (reason: string) => {
          if (finalized) return;
          finalized = true;
          void processing.finally(() => {
            hub.unregister(identity.connectionId, reason);
          });
        };

        return {
          onOpen: (_event, socket) => {
            if (!hub.register(identity, socket)) return;
            hub.send(identity.connectionId, {
              type: "connection.ack",
              protocolVersion: POS_REALTIME_PROTOCOL_VERSION,
              connectionId: identity.connectionId,
              terminalId: identity.terminalId,
              serverTime: new Date().toISOString(),
              heartbeatIntervalMs: REALTIME_HEARTBEAT_INTERVAL_MS,
              leaseDurationMs: REALTIME_LEASE_DURATION_MS,
              serviceHealth: hub.getServiceHealth(),
            });
          },
          onMessage: (event, socket) => {
            processing = processing
              .then(async () => {
                if (!allowMessage()) {
                  socket.close(4408, "message_rate_limit_exceeded");
                  return;
                }

                try {
                  const data = posRealtimeClientMessageSchema.parse(
                    parseRealtimeJsonMessage(event.data),
                  );
                  if (
                    !hub.acceptSequence(identity.connectionId, data.sequence)
                  ) {
                    hub.send(
                      identity.connectionId,
                      realtimeError(
                        "STALE_SEQUENCE",
                        "Realtime message sequence is stale or duplicated.",
                        false,
                      ),
                    );
                    return;
                  }

                  if (data.type === "terminal.ping") {
                    const pong: PosRealtimePong = {
                      type: "terminal.pong",
                      protocolVersion: POS_REALTIME_PROTOCOL_VERSION,
                      connectionId: identity.connectionId,
                      sequence: data.sequence,
                      serverTime: new Date().toISOString(),
                      serviceHealth: hub.getServiceHealth(),
                    };
                    hub.send(identity.connectionId, pong);
                    return;
                  }

                  const result = await runWithTenantDatabaseContext(
                    identity.tenantId,
                    () =>
                      persistRealtimeStatusReport(
                        identity,
                        data as PosTerminalRealtimeStatusReport,
                        REALTIME_LEASE_DURATION_MS,
                      ),
                  );
                  if (!result) {
                    socket.close(4403, "terminal_session_invalid");
                    return;
                  }

                  hub.markServiceHealthy();
                  const ack: PosRealtimeStatusAck = {
                    type: "terminal.status.ack",
                    protocolVersion: POS_REALTIME_PROTOCOL_VERSION,
                    connectionId: identity.connectionId,
                    sequence: data.sequence,
                    statusRevision: result.state.statusRevision,
                    serverTime: new Date().toISOString(),
                    serviceHealth: hub.getServiceHealth(),
                  };
                  hub.send(identity.connectionId, ack);
                  if (result.changed) {
                    hub.broadcastDeviceState(identity.tenantId, result.state);
                  }
                } catch (error) {
                  if (
                    !(error instanceof ZodError) &&
                    !(error instanceof RealtimeMessageValidationError)
                  ) {
                    throw error;
                  }
                  invalidMessageCount += 1;
                  const message =
                    error instanceof ZodError
                      ? "Realtime message validation failed."
                      : error instanceof Error
                        ? error.message
                        : "Realtime message could not be processed.";
                  hub.send(
                    identity.connectionId,
                    realtimeError("INVALID_MESSAGE", message, false),
                  );
                  if (invalidMessageCount >= 3) {
                    socket.close(4400, "invalid_realtime_messages");
                  }
                }
              })
              .catch((error) => {
                hub.markServiceDegraded();
                c.get("logger").error(
                  {
                    err: error,
                    tenantId: identity.tenantId,
                    terminalId: identity.terminalId,
                    connectionId: identity.connectionId,
                  },
                  "POS realtime message processing failed",
                );
                hub.send(
                  identity.connectionId,
                  realtimeError(
                    "PROCESSING_FAILED",
                    "Realtime status could not be persisted.",
                    true,
                  ),
                );
              });
          },
          onClose: (event) => {
            finalize(event.reason || `socket_closed_${event.code}`);
          },
          onError: () => {
            finalize("socket_error");
          },
        };
      },
      { onError: () => undefined },
    ),
  );

  routes.get(
    "/tenant",
    upgradeWebSocket(
      async (c) => {
        assertHandshakeRate(c);
        assertRealtimeOrigin({
          origin: c.req.header("origin"),
          allowedOrigins: env.corsOrigins,
          enforceSameOrigin: env.corsEnforceSameOrigin,
          requestUrl: c.req.url,
          forwardedProto: c.req.header("x-forwarded-proto"),
          forwardedHost: c.req.header("x-forwarded-host"),
        });
        assertSubprotocol(
          c.req.header("sec-websocket-protocol"),
          TENANT_REALTIME_SUBPROTOCOL,
        );
        const identity = await authenticateTenantRealtime(c, authService);
        const allowMessage = createRateLimiter();
        let invalidMessageCount = 0;
        let finalized = false;
        const finalize = (reason: string) => {
          if (finalized) return;
          finalized = true;
          hub.unregister(identity.connectionId, reason);
        };

        return {
          onOpen: (_event, socket) => {
            if (!hub.register(identity, socket)) return;
            hub.send(identity.connectionId, {
              type: "connection.ack",
              protocolVersion: POS_REALTIME_PROTOCOL_VERSION,
              connectionId: identity.connectionId,
              serverTime: new Date().toISOString(),
              heartbeatIntervalMs: REALTIME_HEARTBEAT_INTERVAL_MS,
              leaseDurationMs: REALTIME_LEASE_DURATION_MS,
              serviceHealth: hub.getServiceHealth(),
            });
          },
          onMessage: (event, socket) => {
            if (!allowMessage()) {
              socket.close(4408, "message_rate_limit_exceeded");
              return;
            }
            try {
              const data = tenantRealtimePingSchema.parse(
                parseRealtimeJsonMessage(event.data),
              );
              if (!hub.acceptSequence(identity.connectionId, data.sequence)) {
                return;
              }
              const pong: TenantRealtimePong = {
                type: "tenant.pong",
                protocolVersion: POS_REALTIME_PROTOCOL_VERSION,
                connectionId: identity.connectionId,
                sequence: data.sequence,
                serverTime: new Date().toISOString(),
                serviceHealth: hub.getServiceHealth(),
              };
              hub.send(identity.connectionId, pong);
            } catch {
              invalidMessageCount += 1;
              hub.send(
                identity.connectionId,
                realtimeError(
                  "INVALID_MESSAGE",
                  "Realtime message validation failed.",
                  false,
                ),
              );
              if (invalidMessageCount >= 3) {
                socket.close(4400, "invalid_realtime_messages");
              }
            }
          },
          onClose: (event) => {
            finalize(event.reason || `socket_closed_${event.code}`);
          },
          onError: () => {
            finalize("socket_error");
          },
        };
      },
      { onError: () => undefined },
    ),
  );

  return routes;
}
