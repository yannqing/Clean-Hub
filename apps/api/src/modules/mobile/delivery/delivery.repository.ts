import { createId } from "@cleanhub/id";
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  gte,
  inArray,
  isNull,
  lt,
  notInArray,
  ne,
  sql,
} from "drizzle-orm";

import {
  deliveryProofs,
  deliveryTaskEvents,
  deliveryTasks,
  users,
  userProfiles,
  userRoles,
  roles,
  orders,
  serviceTickets,
  type Database,
} from "@cleanhub/db";

import type {
  DeliveryOrderSummary,
  DeliveryProof,
  DeliveryProofType,
  DeliveryTaskDetail,
  DeliveryTaskEvent,
  DeliveryTaskListItem,
  DeliveryTaskStatus,
  DeliveryTicketSummary,
} from "./delivery.types.js";

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toTaskListItem(
  row: typeof deliveryTasks.$inferSelect,
  assigneeName: string | null = null,
): DeliveryTaskListItem {
  return {
    id: row.id,
    tenantId: row.tenantId,
    branchId: row.branchId,
    appointmentId: row.appointmentId,
    assigneeUserId: row.assigneeUserId,
    assigneeName,
    type: row.type,
    status: row.status,
    expectedAt: toIsoString(row.expectedAt),
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    address: row.address,
    orderId: row.orderId,
    ticketId: row.ticketId,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function resolveAssigneeName(input: {
  assigneeDisplayName?: string | null;
  assigneeEmail?: string | null;
  assigneeUserId?: string | null;
}): string | null {
  return (
    input.assigneeDisplayName ??
    input.assigneeEmail ??
    input.assigneeUserId ??
    null
  );
}

function toTaskDetail(
  row: typeof deliveryTasks.$inferSelect,
  {
    timeline,
    proofs,
    order,
    ticket,
  }: {
    timeline: DeliveryTaskEvent[];
    proofs: DeliveryProof[];
    order: DeliveryOrderSummary | null;
    ticket: DeliveryTicketSummary | null;
  },
): DeliveryTaskDetail {
  return {
    ...toTaskListItem(row),
    customerId: row.customerId,
    notes: row.notes,
    exceptionReason: row.exceptionReason,
    cancellationReason: row.cancellationReason,
    dispatchedAt: toIsoString(row.dispatchedAt),
    dispatchedBy: row.dispatchedBy,
    cancelledAt: toIsoString(row.cancelledAt),
    cancelledBy: row.cancelledBy,
    timeline,
    proofs,
    order,
    ticket,
  };
}

function toEvent(
  row: typeof deliveryTaskEvents.$inferSelect,
): DeliveryTaskEvent {
  return {
    id: row.id,
    taskId: row.taskId,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    lat: row.lat,
    lng: row.lng,
    deviceId: row.deviceId,
    idempotencyKey: row.idempotencyKey,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

function toProof(row: typeof deliveryProofs.$inferSelect): DeliveryProof {
  return {
    id: row.id,
    taskId: row.taskId,
    type: row.type,
    mediaRef: row.mediaRef,
    deviceId: row.deviceId,
    idempotencyKey: row.idempotencyKey,
    capturedAt: toIsoString(row.capturedAt),
    createdAt: row.createdAt.toISOString(),
  };
}

function getStatusTimestamps(status: DeliveryTaskStatus, now: Date) {
  switch (status) {
    case "en_route":
      return { startedAt: now };
    case "arrived":
      return { arrivedAt: now };
    case "picked_up":
      return { pickedUpAt: now };
    case "signed":
      return { signedAt: now };
    case "exception":
      return { exceptionAt: now };
    case "cancelled":
      return { cancelledAt: now };
    default:
      return {};
  }
}

export class DeliveryRepository {
  constructor(private readonly db: Database) {}

  async listDriverTasks({
    tenantId,
    driverUserId,
    start,
    end,
  }: {
    tenantId: string;
    driverUserId: string;
    start?: Date;
    end?: Date;
  }): Promise<DeliveryTaskListItem[]> {
    const rows = await this.db
      .select({
        ...getTableColumns(deliveryTasks),
        assigneeDisplayName: userProfiles.displayName,
        assigneeEmail: users.email,
      })
      .from(deliveryTasks)
      .leftJoin(users, eq(users.id, deliveryTasks.assigneeUserId))
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(
        and(
          eq(deliveryTasks.tenantId, tenantId),
          eq(deliveryTasks.assigneeUserId, driverUserId),
          isNull(deliveryTasks.deletedAt),
          notInArray(deliveryTasks.status, ["signed", "cancelled"]),
          start ? gte(deliveryTasks.expectedAt, start) : undefined,
          end ? lt(deliveryTasks.expectedAt, end) : undefined,
        ),
      )
      .orderBy(asc(deliveryTasks.expectedAt), asc(deliveryTasks.createdAt));

    return rows.map((row) => toTaskListItem(row, resolveAssigneeName(row)));
  }

  async findOwnedTaskById({
    tenantId,
    driverUserId,
    taskId,
  }: {
    tenantId: string;
    driverUserId: string;
    taskId: string;
  }): Promise<typeof deliveryTasks.$inferSelect | null> {
    const rows = await this.db
      .select({ ...getTableColumns(deliveryTasks) })
      .from(deliveryTasks)
      .where(
        and(
          eq(deliveryTasks.id, taskId),
          eq(deliveryTasks.tenantId, tenantId),
          eq(deliveryTasks.assigneeUserId, driverUserId),
          isNull(deliveryTasks.deletedAt),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  async findTaskById({
    tenantId,
    taskId,
  }: {
    tenantId: string;
    taskId: string;
  }): Promise<typeof deliveryTasks.$inferSelect | null> {
    const rows = await this.db
      .select({ ...getTableColumns(deliveryTasks) })
      .from(deliveryTasks)
      .where(
        and(
          eq(deliveryTasks.id, taskId),
          eq(deliveryTasks.tenantId, tenantId),
          isNull(deliveryTasks.deletedAt),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  async getTaskDetailById({
    tenantId,
    taskId,
  }: {
    tenantId: string;
    taskId: string;
  }): Promise<DeliveryTaskDetail | null> {
    const task = await this.findTaskById({ tenantId, taskId });

    if (!task) {
      return null;
    }

    const [timeline, proofs, order, ticket] = await Promise.all([
      this.listTaskEvents({ tenantId, taskId }),
      this.listTaskProofs({ tenantId, taskId }),
      task.orderId
        ? this.findOrderSummary({ tenantId, orderId: task.orderId })
        : Promise.resolve(null),
      task.ticketId
        ? this.findTicketSummary({ tenantId, ticketId: task.ticketId })
        : Promise.resolve(null),
    ]);

    return toTaskDetail(task, { timeline, proofs, order, ticket });
  }

  async isTenantDriver({
    tenantId,
    userId,
  }: {
    tenantId: string;
    userId: string;
  }): Promise<boolean> {
    const rows = await this.db
      .select({ id: users.id })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(
        and(
          eq(users.id, userId),
          eq(users.tenantId, tenantId),
          eq(users.userType, "tenant"),
          eq(users.status, "active"),
          isNull(users.deletedAt),
          eq(userRoles.tenantId, tenantId),
          isNull(userRoles.revokedAt),
          eq(roles.scope, "tenant"),
          eq(roles.code, "driver"),
          eq(roles.status, "active"),
          isNull(roles.deletedAt),
        ),
      )
      .limit(1);

    return Boolean(rows[0]);
  }

  async getOwnedTaskDetail({
    tenantId,
    driverUserId,
    taskId,
  }: {
    tenantId: string;
    driverUserId: string;
    taskId: string;
  }): Promise<DeliveryTaskDetail | null> {
    const task = await this.findOwnedTaskById({
      tenantId,
      driverUserId,
      taskId,
    });

    if (!task) {
      return null;
    }

    const [timeline, proofs, order, ticket] = await Promise.all([
      this.listTaskEvents({ tenantId, taskId }),
      this.listTaskProofs({ tenantId, taskId }),
      task.orderId
        ? this.findOrderSummary({ tenantId, orderId: task.orderId })
        : Promise.resolve(null),
      task.ticketId
        ? this.findTicketSummary({ tenantId, ticketId: task.ticketId })
        : Promise.resolve(null),
    ]);

    return toTaskDetail(task, { timeline, proofs, order, ticket });
  }

  async findTaskEventByIdempotencyKey({
    tenantId,
    taskId,
    idempotencyKey,
  }: {
    tenantId: string;
    taskId: string;
    idempotencyKey: string;
  }): Promise<DeliveryTaskEvent | null> {
    const rows = await this.db
      .select({ ...getTableColumns(deliveryTaskEvents) })
      .from(deliveryTaskEvents)
      .where(
        and(
          eq(deliveryTaskEvents.tenantId, tenantId),
          eq(deliveryTaskEvents.taskId, taskId),
          eq(deliveryTaskEvents.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);

    return rows[0] ? toEvent(rows[0]) : null;
  }

  async findProofByIdempotencyKey({
    tenantId,
    taskId,
    idempotencyKey,
  }: {
    tenantId: string;
    taskId: string;
    idempotencyKey: string;
  }): Promise<DeliveryProof | null> {
    const rows = await this.db
      .select({ ...getTableColumns(deliveryProofs) })
      .from(deliveryProofs)
      .where(
        and(
          eq(deliveryProofs.tenantId, tenantId),
          eq(deliveryProofs.taskId, taskId),
          eq(deliveryProofs.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);

    return rows[0] ? toProof(rows[0]) : null;
  }

  async insertTaskEvent(input: {
    tenantId: string;
    taskId: string;
    fromStatus: DeliveryTaskStatus | null;
    toStatus: DeliveryTaskStatus;
    lat?: string;
    lng?: string;
    deviceId?: string;
    idempotencyKey: string;
    note?: string;
    createdBy: string;
  }): Promise<DeliveryTaskEvent> {
    const rows = await this.db
      .insert(deliveryTaskEvents)
      .values({
        id: createId(),
        tenantId: input.tenantId,
        taskId: input.taskId,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        lat: input.lat,
        lng: input.lng,
        deviceId: input.deviceId,
        idempotencyKey: input.idempotencyKey,
        note: input.note,
        createdBy: input.createdBy,
      })
      .onConflictDoNothing({
        target: [deliveryTaskEvents.taskId, deliveryTaskEvents.idempotencyKey],
      })
      .returning({ ...getTableColumns(deliveryTaskEvents) });

    if (rows[0]) {
      return toEvent(rows[0]);
    }

    const existing = await this.findTaskEventByIdempotencyKey({
      tenantId: input.tenantId,
      taskId: input.taskId,
      idempotencyKey: input.idempotencyKey,
    });

    if (!existing) {
      throw new Error("Delivery task event insert failed.");
    }

    return existing;
  }

  async insertProof(input: {
    tenantId: string;
    taskId: string;
    type: DeliveryProofType;
    mediaRef: string;
    deviceId?: string;
    idempotencyKey: string;
    capturedAt?: Date;
    createdBy: string;
  }): Promise<DeliveryProof> {
    const rows = await this.db
      .insert(deliveryProofs)
      .values({
        id: createId(),
        tenantId: input.tenantId,
        taskId: input.taskId,
        type: input.type,
        mediaRef: input.mediaRef,
        deviceId: input.deviceId,
        idempotencyKey: input.idempotencyKey,
        capturedAt: input.capturedAt,
        createdBy: input.createdBy,
      })
      .onConflictDoNothing({
        target: [deliveryProofs.taskId, deliveryProofs.idempotencyKey],
      })
      .returning({ ...getTableColumns(deliveryProofs) });

    if (rows[0]) {
      return toProof(rows[0]);
    }

    const existing = await this.findProofByIdempotencyKey({
      tenantId: input.tenantId,
      taskId: input.taskId,
      idempotencyKey: input.idempotencyKey,
    });

    if (!existing) {
      throw new Error("Delivery proof insert failed.");
    }

    return existing;
  }

  async updateTaskStatus(input: {
    taskId: string;
    tenantId: string;
    driverUserId: string;
    fromStatus: DeliveryTaskStatus;
    toStatus: DeliveryTaskStatus;
    exceptionReason?: string;
  }): Promise<boolean> {
    const now = new Date();
    const rows = await this.db
      .update(deliveryTasks)
      .set({
        status: input.toStatus,
        exceptionReason:
          input.toStatus === "exception" ? input.exceptionReason : undefined,
        cancellationReason: undefined,
        updatedAt: now,
        updatedBy: input.driverUserId,
        version: sql`${deliveryTasks.version} + 1`,
        ...getStatusTimestamps(input.toStatus, now),
      })
      .where(
        and(
          eq(deliveryTasks.id, input.taskId),
          eq(deliveryTasks.tenantId, input.tenantId),
          eq(deliveryTasks.assigneeUserId, input.driverUserId),
          eq(deliveryTasks.status, input.fromStatus),
          isNull(deliveryTasks.deletedAt),
        ),
      )
      .returning({ id: deliveryTasks.id });

    return Boolean(rows[0]);
  }

  async signTask(input: {
    tenantId: string;
    taskId: string;
    driverUserId: string;
    fromStatus: DeliveryTaskStatus;
    signatureMediaRef: string;
    deviceId?: string;
    idempotencyKey: string;
    capturedAt?: Date;
    lat?: string;
    lng?: string;
    signedByName?: string;
  }): Promise<{
    event: DeliveryTaskEvent;
    proof: DeliveryProof;
    appointmentId: string | null;
  } | null> {
    return this.db.transaction(async (tx) => {
      const repository = new DeliveryRepository(tx);
      const now = new Date();
      const updatedRows = await tx
        .update(deliveryTasks)
        .set({
          status: "signed",
          updatedAt: now,
          updatedBy: input.driverUserId,
          signedAt: now,
          version: sql`${deliveryTasks.version} + 1`,
        })
        .where(
          and(
            eq(deliveryTasks.id, input.taskId),
            eq(deliveryTasks.tenantId, input.tenantId),
            eq(deliveryTasks.assigneeUserId, input.driverUserId),
            eq(deliveryTasks.status, input.fromStatus),
            isNull(deliveryTasks.deletedAt),
          ),
        )
        .returning({
          id: deliveryTasks.id,
          appointmentId: deliveryTasks.appointmentId,
        });

      if (!updatedRows[0]) {
        return null;
      }

      const proof = await repository.insertProof({
        tenantId: input.tenantId,
        taskId: input.taskId,
        type: "signature",
        mediaRef: input.signatureMediaRef,
        deviceId: input.deviceId,
        idempotencyKey: input.idempotencyKey,
        capturedAt: input.capturedAt,
        createdBy: input.driverUserId,
      });
      const event = await repository.insertTaskEvent({
        tenantId: input.tenantId,
        taskId: input.taskId,
        fromStatus: input.fromStatus,
        toStatus: "signed",
        lat: input.lat,
        lng: input.lng,
        deviceId: input.deviceId,
        idempotencyKey: input.idempotencyKey,
        note: input.signedByName
          ? `Signed by ${input.signedByName.trim()}`
          : undefined,
        createdBy: input.driverUserId,
      });

      return { event, proof, appointmentId: updatedRows[0].appointmentId };
    });
  }

  async createAssignedTask(input: {
    tenantId: string;
    branchId: string;
    assigneeUserId?: string | null;
    customerId: string;
    type: "pickup" | "dropoff";
    customerName: string;
    address: string;
    createdBy: string;
    customerPhone?: string;
    orderId?: string;
    ticketId?: string;
    expectedAt?: Date;
    notes?: string;
    appointmentId?: string;
  }): Promise<string> {
    const rows = await this.db
      .insert(deliveryTasks)
      .values({
        id: createId(),
        tenantId: input.tenantId,
        branchId: input.branchId,
        assigneeUserId: input.assigneeUserId ?? null,
        appointmentId: input.appointmentId,
        customerId: input.customerId,
        type: input.type,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        address: input.address,
        orderId: input.orderId,
        ticketId: input.ticketId,
        expectedAt: input.expectedAt,
        notes: input.notes,
        createdBy: input.createdBy,
        updatedBy: input.createdBy,
        dispatchedAt: input.assigneeUserId ? new Date() : undefined,
        dispatchedBy: input.assigneeUserId ? input.createdBy : undefined,
      })
      .returning({ id: deliveryTasks.id });

    return rows[0]?.id ?? "";
  }

  async listPendingDispatchTasks(input: {
    tenantId: string;
    branchId: string;
  }): Promise<DeliveryTaskListItem[]> {
    const rows = await this.db
      .select({ ...getTableColumns(deliveryTasks) })
      .from(deliveryTasks)
      .where(
        and(
          eq(deliveryTasks.tenantId, input.tenantId),
          eq(deliveryTasks.branchId, input.branchId),
          eq(deliveryTasks.status, "pending_dispatch"),
          isNull(deliveryTasks.assigneeUserId),
          isNull(deliveryTasks.deletedAt),
        ),
      )
      .orderBy(asc(deliveryTasks.expectedAt), asc(deliveryTasks.createdAt));

    return rows.map((row) => toTaskListItem(row));
  }

  async listAssignedDispatchTasks(input: {
    tenantId: string;
    branchId: string;
    assigneeUserId?: string;
    status?: DeliveryTaskStatus;
    from?: Date;
    to?: Date;
  }): Promise<DeliveryTaskListItem[]> {
    const statusFilter = input.status
      ? eq(deliveryTasks.status, input.status)
      : inArray(deliveryTasks.status, [
          "pending_dispatch",
          "en_route",
          "arrived",
          "picked_up",
          "delivering",
          "signed",
          "exception",
          "cancelled",
        ]);
    const rows = await this.db
      .select({
        ...getTableColumns(deliveryTasks),
        assigneeDisplayName: userProfiles.displayName,
        assigneeEmail: users.email,
      })
      .from(deliveryTasks)
      .leftJoin(users, eq(users.id, deliveryTasks.assigneeUserId))
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(
        and(
          eq(deliveryTasks.tenantId, input.tenantId),
          eq(deliveryTasks.branchId, input.branchId),
          statusFilter,
          input.assigneeUserId
            ? eq(deliveryTasks.assigneeUserId, input.assigneeUserId)
            : sql`${deliveryTasks.assigneeUserId} is not null`,
          input.from ? gte(deliveryTasks.expectedAt, input.from) : undefined,
          input.to ? lt(deliveryTasks.expectedAt, input.to) : undefined,
          isNull(deliveryTasks.deletedAt),
        ),
      )
      .orderBy(asc(deliveryTasks.expectedAt), desc(deliveryTasks.updatedAt));

    return rows.map((row) => toTaskListItem(row, resolveAssigneeName(row)));
  }

  async dispatchTask(input: {
    tenantId: string;
    taskId: string;
    taskVersion: number;
    assigneeUserId: string;
    operatorUserId: string;
    idempotencyKey: string;
    note?: string;
  }): Promise<DeliveryTaskEvent | null> {
    return this.db.transaction(async (tx) => {
      const repository = new DeliveryRepository(tx);
      const now = new Date();
      const updatedRows = await tx
        .update(deliveryTasks)
        .set({
          assigneeUserId: input.assigneeUserId,
          dispatchedAt: now,
          dispatchedBy: input.operatorUserId,
          updatedAt: now,
          updatedBy: input.operatorUserId,
          version: sql`${deliveryTasks.version} + 1`,
        })
        .where(
          and(
            eq(deliveryTasks.id, input.taskId),
            eq(deliveryTasks.tenantId, input.tenantId),
            eq(deliveryTasks.status, "pending_dispatch"),
            eq(deliveryTasks.version, input.taskVersion),
            isNull(deliveryTasks.assigneeUserId),
            isNull(deliveryTasks.deletedAt),
          ),
        )
        .returning({ id: deliveryTasks.id });

      if (!updatedRows[0]) {
        return null;
      }

      return repository.insertTaskEvent({
        tenantId: input.tenantId,
        taskId: input.taskId,
        fromStatus: "pending_dispatch",
        toStatus: "pending_dispatch",
        idempotencyKey: input.idempotencyKey,
        note: input.note ?? `Dispatched to ${input.assigneeUserId}`,
        createdBy: input.operatorUserId,
      });
    });
  }

  async reassignTask(input: {
    tenantId: string;
    taskId: string;
    taskVersion: number;
    fromStatus: DeliveryTaskStatus;
    assigneeUserId: string;
    operatorUserId: string;
    idempotencyKey: string;
    note?: string;
  }): Promise<DeliveryTaskEvent | null> {
    return this.db.transaction(async (tx) => {
      const repository = new DeliveryRepository(tx);
      const now = new Date();
      const updatedRows = await tx
        .update(deliveryTasks)
        .set({
          assigneeUserId: input.assigneeUserId,
          dispatchedAt: now,
          dispatchedBy: input.operatorUserId,
          updatedAt: now,
          updatedBy: input.operatorUserId,
          version: sql`${deliveryTasks.version} + 1`,
        })
        .where(
          and(
            eq(deliveryTasks.id, input.taskId),
            eq(deliveryTasks.tenantId, input.tenantId),
            eq(deliveryTasks.status, input.fromStatus),
            eq(deliveryTasks.version, input.taskVersion),
            ne(deliveryTasks.status, "signed"),
            ne(deliveryTasks.status, "cancelled"),
            isNull(deliveryTasks.deletedAt),
          ),
        )
        .returning({ id: deliveryTasks.id });

      if (!updatedRows[0]) {
        return null;
      }

      return repository.insertTaskEvent({
        tenantId: input.tenantId,
        taskId: input.taskId,
        fromStatus: input.fromStatus,
        toStatus: input.fromStatus,
        idempotencyKey: input.idempotencyKey,
        note: input.note ?? `Reassigned to ${input.assigneeUserId}`,
        createdBy: input.operatorUserId,
      });
    });
  }

  async cancelTask(input: {
    tenantId: string;
    taskId: string;
    taskVersion: number;
    fromStatus: DeliveryTaskStatus;
    operatorUserId: string;
    idempotencyKey: string;
    reason: string;
  }): Promise<{
    event: DeliveryTaskEvent;
    appointmentId: string | null;
  } | null> {
    return this.db.transaction(async (tx) => {
      const repository = new DeliveryRepository(tx);
      const now = new Date();
      const updatedRows = await tx
        .update(deliveryTasks)
        .set({
          status: "cancelled",
          cancellationReason: input.reason,
          cancelledAt: now,
          cancelledBy: input.operatorUserId,
          updatedAt: now,
          updatedBy: input.operatorUserId,
          version: sql`${deliveryTasks.version} + 1`,
        })
        .where(
          and(
            eq(deliveryTasks.id, input.taskId),
            eq(deliveryTasks.tenantId, input.tenantId),
            eq(deliveryTasks.status, input.fromStatus),
            eq(deliveryTasks.version, input.taskVersion),
            ne(deliveryTasks.status, "signed"),
            ne(deliveryTasks.status, "cancelled"),
            isNull(deliveryTasks.deletedAt),
          ),
        )
        .returning({
          id: deliveryTasks.id,
          appointmentId: deliveryTasks.appointmentId,
        });

      if (!updatedRows[0]) {
        return null;
      }

      const event = await repository.insertTaskEvent({
        tenantId: input.tenantId,
        taskId: input.taskId,
        fromStatus: input.fromStatus,
        toStatus: "cancelled",
        idempotencyKey: input.idempotencyKey,
        note: input.reason,
        createdBy: input.operatorUserId,
      });

      return {
        event,
        appointmentId: updatedRows[0].appointmentId,
      };
    });
  }

  private async listTaskEvents({
    tenantId,
    taskId,
  }: {
    tenantId: string;
    taskId: string;
  }): Promise<DeliveryTaskEvent[]> {
    const rows = await this.db
      .select({ ...getTableColumns(deliveryTaskEvents) })
      .from(deliveryTaskEvents)
      .where(
        and(
          eq(deliveryTaskEvents.tenantId, tenantId),
          eq(deliveryTaskEvents.taskId, taskId),
        ),
      )
      .orderBy(asc(deliveryTaskEvents.createdAt));

    return rows.map(toEvent);
  }

  private async listTaskProofs({
    tenantId,
    taskId,
  }: {
    tenantId: string;
    taskId: string;
  }): Promise<DeliveryProof[]> {
    const rows = await this.db
      .select({ ...getTableColumns(deliveryProofs) })
      .from(deliveryProofs)
      .where(
        and(
          eq(deliveryProofs.tenantId, tenantId),
          eq(deliveryProofs.taskId, taskId),
        ),
      )
      .orderBy(desc(deliveryProofs.createdAt));

    return rows.map(toProof);
  }

  private async findOrderSummary({
    tenantId,
    orderId,
  }: {
    tenantId: string;
    orderId: string;
  }): Promise<DeliveryOrderSummary | null> {
    const rows = await this.db
      .select({
        id: orders.id,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        totalAmount: orders.totalAmount,
      })
      .from(orders)
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.tenantId, tenantId),
          isNull(orders.deletedAt),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  private async findTicketSummary({
    tenantId,
    ticketId,
  }: {
    tenantId: string;
    ticketId: string;
  }): Promise<DeliveryTicketSummary | null> {
    const rows = await this.db
      .select({
        id: serviceTickets.id,
        ticketNo: serviceTickets.ticketNo,
        ticketStatus: serviceTickets.ticketStatus,
        expectedPickupAt: serviceTickets.expectedPickupAt,
      })
      .from(serviceTickets)
      .where(
        and(
          eq(serviceTickets.id, ticketId),
          eq(serviceTickets.tenantId, tenantId),
          isNull(serviceTickets.deletedAt),
        ),
      )
      .limit(1);

    const row = rows[0];

    return row
      ? {
          ...row,
          expectedPickupAt: toIsoString(row.expectedPickupAt),
        }
      : null;
  }
}
