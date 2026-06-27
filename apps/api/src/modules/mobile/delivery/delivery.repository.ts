import { createId } from "@cleanhub/id";
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  gte,
  isNull,
  lt,
  sql,
} from "drizzle-orm";

import {
  deliveryProofs,
  deliveryTaskEvents,
  deliveryTasks,
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
): DeliveryTaskListItem {
  return {
    id: row.id,
    tenantId: row.tenantId,
    branchId: row.branchId,
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
    default:
      return {};
  }
}

export class DeliveryRepository {
  constructor(private readonly db: Database) {}

  async listTodayTasks({
    tenantId,
    driverUserId,
    start,
    end,
  }: {
    tenantId: string;
    driverUserId: string;
    start: Date;
    end: Date;
  }): Promise<DeliveryTaskListItem[]> {
    const rows = await this.db
      .select({ ...getTableColumns(deliveryTasks) })
      .from(deliveryTasks)
      .where(
        and(
          eq(deliveryTasks.tenantId, tenantId),
          eq(deliveryTasks.assigneeUserId, driverUserId),
          isNull(deliveryTasks.deletedAt),
          gte(deliveryTasks.expectedAt, start),
          lt(deliveryTasks.expectedAt, end),
        ),
      )
      .orderBy(asc(deliveryTasks.expectedAt), asc(deliveryTasks.createdAt));

    return rows.map(toTaskListItem);
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
    taskId,
    idempotencyKey,
  }: {
    taskId: string;
    idempotencyKey: string;
  }): Promise<DeliveryTaskEvent | null> {
    const rows = await this.db
      .select({ ...getTableColumns(deliveryTaskEvents) })
      .from(deliveryTaskEvents)
      .where(
        and(
          eq(deliveryTaskEvents.taskId, taskId),
          eq(deliveryTaskEvents.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);

    return rows[0] ? toEvent(rows[0]) : null;
  }

  async findProofByIdempotencyKey({
    taskId,
    idempotencyKey,
  }: {
    taskId: string;
    idempotencyKey: string;
  }): Promise<DeliveryProof | null> {
    const rows = await this.db
      .select({ ...getTableColumns(deliveryProofs) })
      .from(deliveryProofs)
      .where(
        and(
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
        target: [
          deliveryTaskEvents.taskId,
          deliveryTaskEvents.idempotencyKey,
        ],
      })
      .returning({ ...getTableColumns(deliveryTaskEvents) });

    if (rows[0]) {
      return toEvent(rows[0]);
    }

    const existing = await this.findTaskEventByIdempotencyKey({
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
        .returning({ id: deliveryTasks.id });

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

      return { event, proof };
    });
  }

  async createAssignedTask(input: {
    tenantId: string;
    branchId: string;
    assigneeUserId: string;
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
  }): Promise<string> {
    const rows = await this.db
      .insert(deliveryTasks)
      .values({
        id: createId(),
        tenantId: input.tenantId,
        branchId: input.branchId,
        assigneeUserId: input.assigneeUserId,
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
      })
      .returning({ id: deliveryTasks.id });

    return rows[0]?.id ?? "";
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
