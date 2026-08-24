import {
  and,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  notInArray,
  or,
} from "drizzle-orm";

import {
  getDb,
  notificationDeliveries,
  notifications,
  posTerminalSettings,
  posTerminalStatusEvents,
  roles,
  userProfiles,
  userRoles,
  users,
  type Database,
} from "@cleanhub/db";
import {
  derivePosTerminalOperationalStatus,
  POS_REALTIME_PROTOCOL_VERSION,
  type PosTerminalOperationalStatus,
  type PosTerminalRealtimeStatusReport,
  type PosTerminalRuntimeSyncState,
  type TenantDeviceRealtimeState,
} from "@cleanhub/domain/pos-terminal-status";
import { createId } from "@cleanhub/id";

import type { PosRealtimeIdentity } from "./realtime.types.js";

type TerminalRuntimeRow = typeof posTerminalSettings.$inferSelect;
type TerminalRuntimeUpdate = Partial<typeof posTerminalSettings.$inferInsert>;

export type RealtimeStatusPersistenceResult = {
  state: TenantDeviceRealtimeState;
  changed: boolean;
};

export type ExpiredRealtimeLease = {
  tenantId: string;
  state: TenantDeviceRealtimeState;
};

function syncErrorCopy(
  locale: string,
  terminalId: string,
  message: string | null,
) {
  if (locale.toLowerCase().startsWith("fr")) {
    return {
      locale: "fr",
      title: "Erreur de synchronisation POS",
      content: `Le terminal ${terminalId} ne peut pas synchroniser ses ventes.${message ? ` Erreur : ${message}` : ""}`,
    };
  }
  if (locale.toLowerCase().startsWith("zh")) {
    return {
      locale: "zh-CN",
      title: "POS 同步错误",
      content: `终端 ${terminalId} 无法同步销售数据。${message ? `错误：${message}` : ""}`,
    };
  }
  return {
    locale: "en",
    title: "POS synchronization error",
    content: `Terminal ${terminalId} cannot synchronize its sales.${message ? ` Error: ${message}` : ""}`,
  };
}

async function createSyncErrorAlerts(
  db: Database,
  input: {
    identity: Pick<PosRealtimeIdentity, "tenantId" | "branchId" | "terminalId">;
    state: TenantDeviceRealtimeState;
    message: string | null;
  },
): Promise<void> {
  const recipientRows = await db
    .select({
      userId: users.id,
      locale: userProfiles.language,
    })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .innerJoin(users, eq(users.id, userRoles.userId))
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(
      and(
        eq(userRoles.tenantId, input.identity.tenantId),
        isNull(userRoles.revokedAt),
        eq(roles.tenantId, input.identity.tenantId),
        eq(roles.scope, "tenant"),
        inArray(roles.code, ["owner", "manager"]),
        eq(roles.status, "active"),
        isNull(roles.deletedAt),
        eq(users.tenantId, input.identity.tenantId),
        eq(users.status, "active"),
        isNull(users.deletedAt),
        or(
          eq(roles.code, "owner"),
          isNull(userRoles.branchId),
          eq(userRoles.branchId, input.identity.branchId),
        )!,
      ),
    );

  const recipients = new Map(
    recipientRows.map((row) => [row.userId, row.locale ?? "en"]),
  );
  for (const [recipientUserId, locale] of recipients) {
    const notificationId = createId();
    const copy = syncErrorCopy(
      locale,
      input.identity.terminalId,
      input.message,
    );
    const idempotencyKey = `pos-sync-error:${input.identity.terminalId}:${input.state.statusRevision}:${recipientUserId}`;
    const inserted = await db
      .insert(notifications)
      .values({
        id: notificationId,
        tenantId: input.identity.tenantId,
        scope: "tenant",
        noticeType: "system",
        relatedType: "pos_terminal",
        relatedId: input.identity.terminalId,
        title: copy.title,
        content: copy.content,
        locale: copy.locale,
        payload: {
          branchId: input.identity.branchId,
          terminalId: input.identity.terminalId,
          href: "/tenant/point-of-sale/devices",
        },
        priority: "critical",
        idempotencyKey,
      })
      .onConflictDoNothing({
        target: [notifications.tenantId, notifications.idempotencyKey],
      })
      .returning({ id: notifications.id });
    if (!inserted[0]) continue;

    await db.insert(notificationDeliveries).values({
      id: createId(),
      tenantId: input.identity.tenantId,
      notificationId,
      channel: "app",
      recipientType: "user",
      recipientId: recipientUserId,
      senderType: "system",
      status: "sent",
      readStatus: "unread",
      priority: "critical",
      sentAt: new Date(),
      attemptCount: 1,
    });
  }
}

function toRuntimeSyncState(
  value: TerminalRuntimeRow["syncStatus"],
): PosTerminalRuntimeSyncState {
  switch (value) {
    case "synced":
      return "idle";
    case "syncing":
      return "syncing";
    case "error":
      return "error";
    default:
      return "never";
  }
}

function toStoredSyncState(
  value: PosTerminalRuntimeSyncState,
): TerminalRuntimeRow["syncStatus"] {
  switch (value) {
    case "idle":
      return "synced";
    case "pending":
    case "syncing":
      return "syncing";
    case "error":
      return "error";
    default:
      return "never";
  }
}

function hasFreshLease(row: TerminalRuntimeRow, now: Date): boolean {
  return Boolean(
    row.connectionLeaseUntil &&
    row.connectionLeaseUntil.getTime() >= now.getTime(),
  );
}

function toRealtimeState(
  row: TerminalRuntimeRow,
  now: Date,
  connectionOverride?: "connected" | "disconnected",
): TenantDeviceRealtimeState {
  const connectionState =
    connectionOverride ??
    (hasFreshLease(row, now) ? "connected" : "disconnected");
  const syncState = toRuntimeSyncState(row.syncStatus);
  const serviceHealth =
    connectionState === "connected" ? "healthy" : "unavailable";
  const facts = {
    administrativeStatus: row.status,
    connectionState,
    serviceHealth,
    syncState,
    pendingSalesCount: row.pendingSalesCount,
    pendingOperationsCount: row.pendingOperationsCount,
    hasEverConnected: Boolean(row.lastSeenAt),
  } as const;

  return {
    terminalId: row.id,
    branchId: row.branchId,
    ...facts,
    operationalStatus: derivePosTerminalOperationalStatus(facts),
    oldestPendingAt: row.oldestPendingAt?.toISOString() ?? null,
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    lastRealtimeSeenAt: row.lastRealtimeSeenAt?.toISOString() ?? null,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    lastSyncError: row.lastSyncError,
    statusRevision: row.statusRevision,
    observedAt: now.toISOString(),
  };
}

function resolveTransitionEventType(input: {
  previousStatus: PosTerminalOperationalStatus;
  nextStatus: PosTerminalOperationalStatus;
  previousSyncState: PosTerminalRuntimeSyncState;
  nextSyncState: PosTerminalRuntimeSyncState;
  connectionTransition?: "connected" | "disconnected";
}):
  | "connected"
  | "disconnected"
  | "sync_started"
  | "sync_completed"
  | "sync_error"
  | "sync_recovered"
  | null {
  if (input.connectionTransition) return input.connectionTransition;
  if (input.previousStatus === input.nextStatus) return null;
  if (input.nextSyncState === "error") return "sync_error";
  if (input.previousSyncState === "error") {
    return "sync_recovered";
  }
  if (input.nextSyncState === "pending" || input.nextSyncState === "syncing") {
    return "sync_started";
  }
  if (input.nextSyncState === "idle" && input.previousSyncState !== "idle") {
    return "sync_completed";
  }
  return null;
}

async function insertTransitionEvent(
  db: Database,
  input: {
    identity: Pick<
      PosRealtimeIdentity,
      "tenantId" | "branchId" | "terminalId"
    > & { connectionId: string | null };
    eventType: NonNullable<ReturnType<typeof resolveTransitionEventType>>;
    previousStatus: PosTerminalOperationalStatus;
    nextState: TenantDeviceRealtimeState;
    report?: PosTerminalRealtimeStatusReport;
    reason?: string;
  },
): Promise<void> {
  await db.insert(posTerminalStatusEvents).values({
    id: createId(),
    tenantId: input.identity.tenantId,
    branchId: input.identity.branchId,
    terminalId: input.identity.terminalId,
    eventType: input.eventType,
    fromStatus: input.previousStatus,
    toStatus: input.nextState.operationalStatus,
    connectionId: input.identity.connectionId,
    pendingSalesCount: input.nextState.pendingSalesCount,
    pendingOperationsCount: input.nextState.pendingOperationsCount,
    errorCode: input.report?.lastSyncErrorCode ?? null,
    errorMessage: input.report?.lastSyncErrorMessage ?? null,
    reason: input.reason,
    metadata: input.report
      ? {
          appVisibility: input.report.appVisibility,
          clientTime: input.report.clientTime,
          sequence: input.report.sequence,
        }
      : {},
  });
  if (input.eventType === "sync_error") {
    await createSyncErrorAlerts(db, {
      identity: input.identity,
      state: input.nextState,
      message: input.report?.lastSyncErrorMessage ?? null,
    });
  }
}

async function lockTerminal(
  db: Database,
  identity: PosRealtimeIdentity,
): Promise<TerminalRuntimeRow | null> {
  const rows = await db
    .select()
    .from(posTerminalSettings)
    .where(
      and(
        eq(posTerminalSettings.id, identity.terminalId),
        eq(posTerminalSettings.tenantId, identity.tenantId),
        eq(posTerminalSettings.branchId, identity.branchId),
        eq(posTerminalSettings.deviceId, identity.deviceId),
        eq(posTerminalSettings.credentialVersion, identity.credentialVersion),
        eq(posTerminalSettings.status, "active"),
      ),
    )
    .limit(1)
    .for("update");

  return rows[0] ?? null;
}

export async function persistRealtimeConnected(
  identity: PosRealtimeIdentity,
  leaseDurationMs: number,
): Promise<TenantDeviceRealtimeState | null> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const now = new Date();
    const current = await lockTerminal(tx, identity);
    if (!current) return null;

    const previousState = toRealtimeState(current, now);
    const rows = await tx
      .update(posTerminalSettings)
      .set({
        lastSeenAt: now,
        lastRealtimeSeenAt: now,
        connectionLeaseUntil: new Date(now.getTime() + leaseDurationMs),
        lastDisconnectReason: null,
        realtimeProtocolVersion: POS_REALTIME_PROTOCOL_VERSION,
        statusRevision: current.statusRevision + 1,
      })
      .where(
        and(
          eq(posTerminalSettings.id, current.id),
          eq(posTerminalSettings.tenantId, current.tenantId),
          eq(posTerminalSettings.statusRevision, current.statusRevision),
        ),
      )
      .returning();
    const updated = rows[0];
    if (!updated) return null;

    const nextState = toRealtimeState(updated, now, "connected");
    await insertTransitionEvent(tx, {
      identity,
      eventType: "connected",
      previousStatus: previousState.operationalStatus,
      nextState,
    });
    return nextState;
  });
}

export async function persistRealtimeStatusReport(
  identity: PosRealtimeIdentity,
  report: PosTerminalRealtimeStatusReport,
  leaseDurationMs: number,
): Promise<RealtimeStatusPersistenceResult | null> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const now = new Date();
    const current = await lockTerminal(tx, identity);
    if (!current) return null;

    const previousState = toRealtimeState(current, now);
    const previousSyncState = toRuntimeSyncState(current.syncStatus);
    const storedSyncStatus = toStoredSyncState(report.syncState);
    const reportOldestPendingAt = report.oldestPendingAt
      ? new Date(report.oldestPendingAt)
      : null;
    const reportLastSyncError =
      report.syncState === "error" ? report.lastSyncErrorMessage : null;
    const changed =
      current.pendingSalesCount !== report.pendingSalesCount ||
      current.pendingOperationsCount !== report.pendingOperationsCount ||
      current.oldestPendingAt?.getTime() !== reportOldestPendingAt?.getTime() ||
      current.syncStatus !== storedSyncStatus ||
      current.lastSyncError !== reportLastSyncError;
    const setValues: TerminalRuntimeUpdate = {
      lastSeenAt: now,
      lastRealtimeSeenAt: now,
      connectionLeaseUntil: new Date(now.getTime() + leaseDurationMs),
      realtimeProtocolVersion: POS_REALTIME_PROTOCOL_VERSION,
    };
    if (changed) {
      Object.assign(setValues, {
        pendingSalesCount: report.pendingSalesCount,
        pendingOperationsCount: report.pendingOperationsCount,
        oldestPendingAt: reportOldestPendingAt,
        syncStatus: storedSyncStatus,
        lastSyncedAt:
          report.syncState === "idle" && previousSyncState !== "idle"
            ? now
            : current.lastSyncedAt,
        lastSyncError: reportLastSyncError,
        statusRevision: current.statusRevision + 1,
      } satisfies TerminalRuntimeUpdate);
    }
    const rows = await tx
      .update(posTerminalSettings)
      .set(setValues)
      .where(
        and(
          eq(posTerminalSettings.id, current.id),
          eq(posTerminalSettings.tenantId, current.tenantId),
          eq(posTerminalSettings.statusRevision, current.statusRevision),
        ),
      )
      .returning();
    const updated = rows[0];
    if (!updated) return null;

    const nextState = toRealtimeState(updated, now, "connected");
    const eventType = resolveTransitionEventType({
      previousStatus: previousState.operationalStatus,
      nextStatus: nextState.operationalStatus,
      previousSyncState,
      nextSyncState: report.syncState,
    });
    if (eventType) {
      await insertTransitionEvent(tx, {
        identity,
        eventType,
        previousStatus: previousState.operationalStatus,
        nextState,
        report,
      });
    }
    return { state: nextState, changed };
  });
}

export async function persistRealtimeLease(
  identity: PosRealtimeIdentity,
  leaseDurationMs: number,
): Promise<TenantDeviceRealtimeState | null> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const now = new Date();
    const current = await lockTerminal(tx, identity);
    if (!current) return null;

    const rows = await tx
      .update(posTerminalSettings)
      .set({
        lastSeenAt: now,
        lastRealtimeSeenAt: now,
        connectionLeaseUntil: new Date(now.getTime() + leaseDurationMs),
        realtimeProtocolVersion: POS_REALTIME_PROTOCOL_VERSION,
      })
      .where(
        and(
          eq(posTerminalSettings.id, current.id),
          eq(posTerminalSettings.tenantId, current.tenantId),
          eq(posTerminalSettings.statusRevision, current.statusRevision),
        ),
      )
      .returning();

    return rows[0] ? toRealtimeState(rows[0], now, "connected") : null;
  });
}

/**
 * Persists disconnect transitions that could not be observed in-process, such
 * as a host reboot, power loss, or SIGKILL. Active terminals in this process
 * are excluded so a slow lease refresh cannot be reaped concurrently.
 */
export async function reconcileExpiredRealtimeLeases(
  activeTerminalIds: ReadonlySet<string>,
  limit = 100,
): Promise<ExpiredRealtimeLease[]> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const now = new Date();
    const filters = [
      eq(posTerminalSettings.status, "active"),
      isNotNull(posTerminalSettings.connectionLeaseUntil),
      lt(posTerminalSettings.connectionLeaseUntil, now),
      or(
        isNull(posTerminalSettings.lastDisconnectedAt),
        lt(
          posTerminalSettings.lastDisconnectedAt,
          posTerminalSettings.connectionLeaseUntil,
        ),
      )!,
    ];
    if (activeTerminalIds.size > 0) {
      filters.push(notInArray(posTerminalSettings.id, [...activeTerminalIds]));
    }

    const expired = await tx
      .select()
      .from(posTerminalSettings)
      .where(and(...filters))
      .limit(Math.max(1, Math.min(limit, 500)))
      .for("update", { skipLocked: true });
    const reconciled: ExpiredRealtimeLease[] = [];

    for (const current of expired) {
      const previousState = toRealtimeState(current, now, "connected");
      const rows = await tx
        .update(posTerminalSettings)
        .set({
          connectionLeaseUntil: now,
          lastDisconnectedAt: now,
          lastDisconnectReason: "lease_expired",
          statusRevision: current.statusRevision + 1,
        })
        .where(
          and(
            eq(posTerminalSettings.id, current.id),
            eq(posTerminalSettings.tenantId, current.tenantId),
            eq(posTerminalSettings.statusRevision, current.statusRevision),
          ),
        )
        .returning();
      const updated = rows[0];
      if (!updated) continue;

      const state = toRealtimeState(updated, now, "disconnected");
      await insertTransitionEvent(tx, {
        identity: {
          tenantId: current.tenantId,
          branchId: current.branchId,
          terminalId: current.id,
          connectionId: null,
        },
        eventType: "disconnected",
        previousStatus: previousState.operationalStatus,
        nextState: state,
        reason: "lease_expired",
      });
      reconciled.push({ tenantId: current.tenantId, state });
    }

    return reconciled;
  });
}

export async function persistRealtimeDisconnected(
  identity: PosRealtimeIdentity,
  reason: string,
): Promise<TenantDeviceRealtimeState | null> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const now = new Date();
    const current = await lockTerminal(tx, identity);
    if (!current) return null;

    const previousState = toRealtimeState(current, now, "connected");
    const rows = await tx
      .update(posTerminalSettings)
      .set({
        connectionLeaseUntil: now,
        lastDisconnectedAt: now,
        lastDisconnectReason: reason.slice(0, 64),
        statusRevision: current.statusRevision + 1,
      })
      .where(
        and(
          eq(posTerminalSettings.id, current.id),
          eq(posTerminalSettings.tenantId, current.tenantId),
          eq(posTerminalSettings.statusRevision, current.statusRevision),
        ),
      )
      .returning();
    const updated = rows[0];
    if (!updated) return null;

    const nextState = toRealtimeState(updated, now, "disconnected");
    await insertTransitionEvent(tx, {
      identity,
      eventType: "disconnected",
      previousStatus: previousState.operationalStatus,
      nextState,
      reason,
    });
    return nextState;
  });
}
