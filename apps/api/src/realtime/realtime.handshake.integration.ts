import assert from "node:assert/strict";
import { resolve } from "node:path";

import { config } from "dotenv";
import { and, desc, eq } from "drizzle-orm";
import { WebSocket } from "ws";

import {
  closeDbConnection,
  getDb,
  notificationDeliveries,
  notifications,
  posTerminalSettings,
  posTerminalStatusEvents,
  runWithSystemDatabaseContext,
} from "@cleanhub/db";
import { POS_REALTIME_PROTOCOL_VERSION } from "@cleanhub/domain/pos-terminal-status";

import { reconcileExpiredRealtimeLeases } from "./realtime.repository.js";

config({ path: resolve(process.cwd(), "../../.env") });

const httpBaseUrl =
  process.env.REALTIME_INTEGRATION_API_URL ?? "http://localhost:4000";
const wsBaseUrl = httpBaseUrl.replace(/^http/, "ws");
const origin =
  process.env.REALTIME_INTEGRATION_ORIGIN ?? "http://localhost:3000";
const identifier =
  process.env.REALTIME_INTEGRATION_IDENTIFIER ?? "tenant.admin1@cleanhub.local";
const password = process.env.REALTIME_INTEGRATION_PASSWORD ?? "123456";
const branchId =
  process.env.REALTIME_INTEGRATION_BRANCH_ID ?? "01KRERJN8G0000000000000040";
const deviceId =
  process.env.REALTIME_INTEGRATION_DEVICE_ID ??
  "cleanhub-realtime-integration-terminal";
const cashierPin = process.env.REALTIME_INTEGRATION_CASHIER_PIN ?? "111111";

type ServerMessage = {
  type: string;
  protocolVersion: number;
  sequence?: number;
  statusRevision?: number;
  serviceHealth?: string;
  state?: {
    terminalId: string;
    connectionState: string;
    statusRevision: number;
  };
};

function cookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";", 1)[0])
    .filter(Boolean)
    .join("; ");
}

function mergeCookies(...headers: string[]): string {
  const cookies = new Map<string, string>();
  for (const header of headers) {
    for (const cookie of header.split(";")) {
      const value = cookie.trim();
      const separator = value.indexOf("=");
      if (separator > 0) cookies.set(value.slice(0, separator), value);
    }
  }
  return [...cookies.values()].join("; ");
}

async function assertOk(response: Response): Promise<Response> {
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}: ${await response.text().catch(() => "")}`,
    );
  }
  return response;
}

class RealtimeTestClient {
  readonly socket: WebSocket;
  private readonly messages: ServerMessage[] = [];
  private readonly waiters = new Set<{
    predicate(message: ServerMessage): boolean;
    resolve(message: ServerMessage): void;
  }>();

  private constructor(socket: WebSocket) {
    this.socket = socket;
    socket.on("message", (value) => {
      const message = JSON.parse(value.toString()) as ServerMessage;
      assert.equal(message.protocolVersion, POS_REALTIME_PROTOCOL_VERSION);
      for (const waiter of this.waiters) {
        if (!waiter.predicate(message)) continue;
        this.waiters.delete(waiter);
        waiter.resolve(message);
        return;
      }
      this.messages.push(message);
    });
  }

  static connect(
    path: string,
    protocol: string,
    cookie: string,
  ): Promise<RealtimeTestClient> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(`${wsBaseUrl}${path}`, protocol, {
        headers: { Cookie: cookie, Origin: origin },
      });
      const timer = setTimeout(() => {
        socket.terminate();
        reject(new Error(`Realtime handshake for ${path} timed out.`));
      }, 5_000);
      socket.once("open", () => {
        clearTimeout(timer);
        resolve(new RealtimeTestClient(socket));
      });
      socket.once("error", reject);
      socket.once("unexpected-response", (_request, response) => {
        reject(
          new Error(
            `Realtime upgrade for ${path} failed with HTTP ${response.statusCode}.`,
          ),
        );
      });
    });
  }

  next(
    predicate: string | ((message: ServerMessage) => boolean),
  ): Promise<ServerMessage> {
    const matches =
      typeof predicate === "string"
        ? (message: ServerMessage) => message.type === predicate
        : predicate;
    const existingIndex = this.messages.findIndex(matches);
    if (existingIndex >= 0) {
      return Promise.resolve(this.messages.splice(existingIndex, 1)[0]!);
    }

    return new Promise((resolve, reject) => {
      const waiter = { predicate: matches, resolve };
      this.waiters.add(waiter);
      const timer = setTimeout(() => {
        this.waiters.delete(waiter);
        reject(new Error("Expected realtime message was not received."));
      }, 5_000);
      waiter.resolve = (message) => {
        clearTimeout(timer);
        resolve(message);
      };
    });
  }
}

function expectUpgradeRejected(
  cookie: string,
  requestOrigin = origin,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(
      `${wsBaseUrl}/realtime/tenant`,
      "cleanhub.tenant.v1",
      { headers: { Cookie: cookie, Origin: requestOrigin } },
    );
    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error("Rejected realtime upgrade timed out."));
    }, 5_000);
    socket.once("open", () => {
      clearTimeout(timer);
      socket.close();
      reject(new Error("Unauthorized realtime upgrade was accepted."));
    });
    socket.once("unexpected-response", (_request, response) => {
      clearTimeout(timer);
      assert.ok(
        response.statusCode === 401 || response.statusCode === 403,
        `Expected a 401/403 upgrade rejection, received ${response.statusCode}.`,
      );
      resolve();
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

const health = await fetch(`${httpBaseUrl}/health`);
assert.equal(
  health.status,
  200,
  "API must be running before this integration test",
);
await expectUpgradeRejected("");

const login = await assertOk(
  await fetch(`${httpBaseUrl}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
    },
    body: JSON.stringify({ identifier, password }),
  }),
);
const tenantCookie = cookieHeader(login);
assert.match(tenantCookie, /cleanhub_access_token=/);
await expectUpgradeRejected(tenantCookie, "https://invalid-origin.example");

let enrollment = await fetch(`${httpBaseUrl}/pos/auth/devices`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Cookie: tenantCookie,
    Origin: origin,
  },
  body: JSON.stringify({
    deviceId,
    label: "Realtime integration terminal",
    branchId,
    deviceType: "browser",
    platform: "integration-test",
    appVersion: "1.0.0-test",
  }),
});
if (enrollment.status === 409) {
  enrollment = await fetch(
    `${httpBaseUrl}/pos/auth/devices/${encodeURIComponent(deviceId)}/credential-rotation`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: tenantCookie,
        Origin: origin,
      },
      body: JSON.stringify({ reason: "Realtime integration test rotation" }),
    },
  );
}
await assertOk(enrollment);
const terminal = (await enrollment.json()) as { id: string; branchId: string };
const terminalCredentialCookie = cookieHeader(enrollment);
assert.match(terminalCredentialCookie, /cleanhub_pos_terminal_credential=/);

const pinLogin = await assertOk(
  await fetch(`${httpBaseUrl}/auth/pos-pin-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: terminalCredentialCookie,
      Origin: origin,
      "X-CleanHub-Auth-Client": "pos",
    },
    body: JSON.stringify({ pin: cashierPin, deviceId }),
  }),
);
const posCookie = mergeCookies(
  terminalCredentialCookie,
  cookieHeader(pinLogin),
);
assert.match(posCookie, /cleanhub_pos_access_token=/);

const tenantClient = await RealtimeTestClient.connect(
  "/realtime/tenant",
  "cleanhub.tenant.v1",
  tenantCookie,
);
assert.equal(
  (await tenantClient.next("connection.ack")).serviceHealth,
  "healthy",
);

const posClient = await RealtimeTestClient.connect(
  "/realtime/pos",
  "cleanhub.pos.v1",
  posCookie,
);
assert.equal((await posClient.next("connection.ack")).serviceHealth, "healthy");

await tenantClient.next(
  (message) =>
    message.type === "tenant.device.status.changed" &&
    message.state?.terminalId === terminal.id &&
    message.state.connectionState === "connected",
);

const statusReport = {
  type: "terminal.status.report",
  protocolVersion: POS_REALTIME_PROTOCOL_VERSION,
  sequence: 1,
  clientTime: new Date().toISOString(),
  syncState: "idle",
  pendingSalesCount: 0,
  pendingOperationsCount: 0,
  oldestPendingAt: null,
  lastSyncErrorCode: null,
  lastSyncErrorMessage: null,
  appVisibility: "foreground",
} as const;
posClient.socket.send(JSON.stringify(statusReport));
const statusAck = await posClient.next("terminal.status.ack");
assert.ok((statusAck.statusRevision ?? 0) > 0);

posClient.socket.send(JSON.stringify({ ...statusReport, sequence: 2 }));
const duplicateStatusAck = await posClient.next("terminal.status.ack");
assert.equal(
  duplicateStatusAck.statusRevision,
  statusAck.statusRevision,
  "An unchanged periodic status report must not increment the revision.",
);

posClient.socket.send(
  JSON.stringify({
    ...statusReport,
    sequence: 3,
    syncState: "error",
    pendingSalesCount: 1,
    pendingOperationsCount: 1,
    oldestPendingAt: new Date().toISOString(),
    lastSyncErrorCode: "INTEGRATION_SYNC_FAILURE",
    lastSyncErrorMessage: "Integration test synchronization failure.",
  }),
);
const syncErrorAck = await posClient.next("terminal.status.ack");
assert.ok(
  (syncErrorAck.statusRevision ?? 0) > (statusAck.statusRevision ?? 0),
  "A synchronization state transition must increment the revision.",
);

posClient.socket.close(1000, "integration_complete");
await tenantClient.next(
  (message) =>
    message.type === "tenant.device.status.changed" &&
    message.state?.terminalId === terminal.id &&
    message.state.connectionState === "disconnected",
);
tenantClient.socket.close(1000, "integration_complete");

try {
  await runWithSystemDatabaseContext(async () => {
    const alertDeliveries = await getDb()
      .select({ id: notificationDeliveries.id })
      .from(notificationDeliveries)
      .innerJoin(
        notifications,
        eq(notifications.id, notificationDeliveries.notificationId),
      )
      .where(
        and(
          eq(notifications.relatedType, "pos_terminal"),
          eq(notifications.relatedId, terminal.id),
          eq(notifications.priority, "critical"),
          eq(notificationDeliveries.channel, "app"),
        ),
      );
    assert.ok(
      alertDeliveries.length > 0,
      "A POS synchronization error must alert an owner or manager.",
    );

    const expiredAt = new Date(Date.now() - 60_000);
    await getDb()
      .update(posTerminalSettings)
      .set({
        connectionLeaseUntil: expiredAt,
        lastDisconnectedAt: null,
        lastDisconnectReason: null,
      })
      .where(eq(posTerminalSettings.id, terminal.id));

    const reconciled = await reconcileExpiredRealtimeLeases(new Set());
    assert.ok(
      reconciled.some((item) => item.state.terminalId === terminal.id),
      "An expired lease must be durably reconciled after an unclean shutdown.",
    );
    const events = await getDb()
      .select({ reason: posTerminalStatusEvents.reason })
      .from(posTerminalStatusEvents)
      .where(
        and(
          eq(posTerminalStatusEvents.terminalId, terminal.id),
          eq(posTerminalStatusEvents.eventType, "disconnected"),
        ),
      )
      .orderBy(desc(posTerminalStatusEvents.occurredAt))
      .limit(1);
    assert.equal(events[0]?.reason, "lease_expired");
  });
} finally {
  await closeDbConnection();
}

console.log(
  "Authenticated realtime handshake, deduplication, lease recovery, and broadcast integration passed.",
);
