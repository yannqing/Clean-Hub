import { getDb, type Database } from "@cleanhub/db";

import { DeliveryRepository } from "./delivery.repository.js";
import type {
  DeliveryAssignTaskInput,
  DeliveryDriverContext,
  DeliveryError,
  DeliveryMutationResult,
  DeliveryProof,
  DeliveryTaskEvent,
  DeliveryTaskDetail,
  DeliveryTaskListItem,
  DeliveryTaskStatus,
  DeliveryUpdateStatusInput,
  DeliveryUploadProofInput,
  DeliverySignTaskInput,
} from "./delivery.types.js";
import { DeliveryError as MobileDeliveryError } from "./delivery.types.js";
import type { MobileAuthContext } from "../auth/auth.types.js";

export type DeliveryServiceOptions = {
  db?: Database;
  repository?: DeliveryRepositoryLike;
};

export type DeliveryRepositoryLike = {
  listTodayTasks(input: {
    tenantId: string;
    driverUserId: string;
    start: Date;
    end: Date;
  }): Promise<DeliveryTaskListItem[]>;
  findOwnedTaskById(input: {
    tenantId: string;
    driverUserId: string;
    taskId: string;
  }): Promise<{
    id: string;
    tenantId: string;
    branchId: string;
    assigneeUserId: string | null;
    customerId: string;
    orderId: string | null;
    ticketId: string | null;
    type: "pickup" | "dropoff";
    status: DeliveryTaskStatus;
  } | null>;
  getOwnedTaskDetail(input: {
    tenantId: string;
    driverUserId: string;
    taskId: string;
  }): Promise<DeliveryTaskDetail | null>;
  findTaskEventByIdempotencyKey(input: {
    taskId: string;
    idempotencyKey: string;
  }): Promise<DeliveryTaskEvent | null>;
  findProofByIdempotencyKey(input: {
    taskId: string;
    idempotencyKey: string;
  }): Promise<DeliveryProof | null>;
  insertTaskEvent(input: {
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
  }): Promise<DeliveryTaskEvent>;
  insertProof(input: {
    tenantId: string;
    taskId: string;
    type: "pickup" | "dropoff" | "signature";
    mediaRef: string;
    deviceId?: string;
    idempotencyKey: string;
    capturedAt?: Date;
    createdBy: string;
  }): Promise<DeliveryProof>;
  updateTaskStatus(input: {
    taskId: string;
    tenantId: string;
    driverUserId: string;
    fromStatus: DeliveryTaskStatus;
    toStatus: DeliveryTaskStatus;
    exceptionReason?: string;
  }): Promise<boolean>;
  createAssignedTask(input: {
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
  }): Promise<string>;
};

const TERMINAL_STATUSES = new Set<DeliveryTaskStatus>([
  "signed",
  "exception",
  "cancelled",
]);

export const DELIVERY_STATUS_TRANSITIONS: Record<
  DeliveryTaskStatus,
  DeliveryTaskStatus[]
> = {
  pending_dispatch: ["en_route", "exception"],
  en_route: ["arrived", "exception"],
  arrived: ["picked_up", "exception"],
  picked_up: ["delivering", "exception"],
  delivering: ["signed", "exception"],
  signed: [],
  exception: [],
  cancelled: [],
};

function assertDriverContext(
  authContext: MobileAuthContext,
): DeliveryDriverContext {
  if (authContext.subjectType !== "staff" || authContext.role !== "driver") {
    throw forbidden();
  }

  return authContext as DeliveryDriverContext;
}

function forbidden(): DeliveryError {
  return new MobileDeliveryError(
    "DELIVERY_FORBIDDEN",
    "Driver access is required.",
    403,
  );
}

function taskNotFound(): DeliveryError {
  return new MobileDeliveryError(
    "DELIVERY_TASK_NOT_FOUND",
    "Delivery task was not found.",
    404,
  );
}

function conflict(
  message: string,
  currentStatus: DeliveryTaskStatus,
  allowedTransitions: DeliveryTaskStatus[],
): DeliveryError {
  return new MobileDeliveryError("DELIVERY_TASK_CONFLICT", message, 409, {
    currentStatus,
    allowedTransitions,
  });
}

function validationError(message: string): DeliveryError {
  return new MobileDeliveryError(
    "DELIVERY_VALIDATION_ERROR",
    message,
    422,
  );
}

function getTodayBounds(now = new Date()): { start: Date; end: Date } {
  const start = new Date(now);

  start.setHours(0, 0, 0, 0);

  const end = new Date(start);

  end.setDate(end.getDate() + 1);

  return { start, end };
}

function assertValidTransition(
  currentStatus: DeliveryTaskStatus,
  requestedStatus: DeliveryTaskStatus,
): void {
  const allowedTransitions = DELIVERY_STATUS_TRANSITIONS[currentStatus];

  if (allowedTransitions.includes(requestedStatus)) {
    return;
  }

  const terminalMessage = TERMINAL_STATUSES.has(currentStatus)
    ? "Delivery task is already terminal and cannot be overwritten."
    : "Delivery task status transition is not allowed.";

  throw conflict(terminalMessage, currentStatus, allowedTransitions);
}

export class DeliveryService {
  private readonly repository: DeliveryRepositoryLike;

  constructor(options: DeliveryServiceOptions = {}) {
    this.repository =
      options.repository ?? new DeliveryRepository(options.db ?? getDb());
  }

  async listTodayTasks(
    authContext: MobileAuthContext,
  ): Promise<DeliveryTaskListItem[]> {
    const driver = assertDriverContext(authContext);
    const { start, end } = getTodayBounds();

    return this.repository.listTodayTasks({
      tenantId: driver.tenantId,
      driverUserId: driver.subjectId,
      start,
      end,
    });
  }

  async getTaskDetail(
    authContext: MobileAuthContext,
    taskId: string,
  ): Promise<DeliveryTaskDetail> {
    const driver = assertDriverContext(authContext);
    const detail = await this.repository.getOwnedTaskDetail({
      tenantId: driver.tenantId,
      driverUserId: driver.subjectId,
      taskId,
    });

    if (!detail) {
      throw taskNotFound();
    }

    return detail;
  }

  async updateStatus(
    input: DeliveryUpdateStatusInput,
  ): Promise<DeliveryMutationResult> {
    const driver = assertDriverContext(input.authContext);
    const task = await this.repository.findOwnedTaskById({
      tenantId: driver.tenantId,
      driverUserId: driver.subjectId,
      taskId: input.taskId,
    });

    if (!task) {
      throw taskNotFound();
    }

    const existingEvent = await this.repository.findTaskEventByIdempotencyKey({
      taskId: task.id,
      idempotencyKey: input.idempotencyKey,
    });

    if (existingEvent) {
      return {
        task: await this.getTaskDetail(driver, task.id),
        event: existingEvent,
        idempotent: true,
      };
    }

    if (input.toStatus === "signed") {
      assertValidTransition(task.status, input.toStatus);
      throw validationError("Use the signature endpoint to complete a task.");
    }

    assertValidTransition(task.status, input.toStatus);

    const updated = await this.repository.updateTaskStatus({
      taskId: task.id,
      tenantId: driver.tenantId,
      driverUserId: driver.subjectId,
      fromStatus: task.status,
      toStatus: input.toStatus,
      exceptionReason: input.exceptionReason,
    });

    if (!updated) {
      const currentTask = await this.repository.findOwnedTaskById({
        tenantId: driver.tenantId,
        driverUserId: driver.subjectId,
        taskId: task.id,
      });

      throw conflict(
        "Delivery task status changed while processing the request.",
        currentTask?.status ?? task.status,
        currentTask
          ? DELIVERY_STATUS_TRANSITIONS[currentTask.status]
          : DELIVERY_STATUS_TRANSITIONS[task.status],
      );
    }

    const event = await this.repository.insertTaskEvent({
      tenantId: driver.tenantId,
      taskId: task.id,
      fromStatus: task.status,
      toStatus: input.toStatus,
      lat: input.lat,
      lng: input.lng,
      deviceId: input.deviceId,
      idempotencyKey: input.idempotencyKey,
      note: input.note ?? input.exceptionReason,
      createdBy: driver.subjectId,
    });

    return {
      task: await this.getTaskDetail(driver, task.id),
      event,
      idempotent: false,
    };
  }

  async uploadProof(
    input: DeliveryUploadProofInput,
  ): Promise<DeliveryMutationResult> {
    const driver = assertDriverContext(input.authContext);
    const task = await this.repository.findOwnedTaskById({
      tenantId: driver.tenantId,
      driverUserId: driver.subjectId,
      taskId: input.taskId,
    });

    if (!task) {
      throw taskNotFound();
    }

    const existingProof = await this.repository.findProofByIdempotencyKey({
      taskId: task.id,
      idempotencyKey: input.idempotencyKey,
    });

    if (existingProof) {
      return {
        task: await this.getTaskDetail(driver, task.id),
        proof: existingProof,
        idempotent: true,
      };
    }

    const proof = await this.repository.insertProof({
      tenantId: driver.tenantId,
      taskId: task.id,
      type: input.type,
      mediaRef: input.mediaRef,
      deviceId: input.deviceId,
      idempotencyKey: input.idempotencyKey,
      capturedAt: input.capturedAt,
      createdBy: driver.subjectId,
    });

    return {
      task: await this.getTaskDetail(driver, task.id),
      proof,
      idempotent: false,
    };
  }

  async signTask(input: DeliverySignTaskInput): Promise<DeliveryMutationResult> {
    const driver = assertDriverContext(input.authContext);
    const task = await this.repository.findOwnedTaskById({
      tenantId: driver.tenantId,
      driverUserId: driver.subjectId,
      taskId: input.taskId,
    });

    if (!task) {
      throw taskNotFound();
    }

    const [existingEvent, existingProof] = await Promise.all([
      this.repository.findTaskEventByIdempotencyKey({
        taskId: task.id,
        idempotencyKey: input.idempotencyKey,
      }),
      this.repository.findProofByIdempotencyKey({
        taskId: task.id,
        idempotencyKey: input.idempotencyKey,
      }),
    ]);

    if (existingEvent || existingProof) {
      return {
        task: await this.getTaskDetail(driver, task.id),
        event: existingEvent ?? undefined,
        proof: existingProof ?? undefined,
        idempotent: true,
      };
    }

    assertValidTransition(task.status, "signed");

    const proof = await this.repository.insertProof({
      tenantId: driver.tenantId,
      taskId: task.id,
      type: "signature",
      mediaRef: input.signatureMediaRef,
      deviceId: input.deviceId,
      idempotencyKey: input.idempotencyKey,
      capturedAt: input.capturedAt,
      createdBy: driver.subjectId,
    });

    const updated = await this.repository.updateTaskStatus({
      taskId: task.id,
      tenantId: driver.tenantId,
      driverUserId: driver.subjectId,
      fromStatus: task.status,
      toStatus: "signed",
    });

    if (!updated) {
      const currentTask = await this.repository.findOwnedTaskById({
        tenantId: driver.tenantId,
        driverUserId: driver.subjectId,
        taskId: task.id,
      });

      throw conflict(
        "Delivery task status changed while processing the signature.",
        currentTask?.status ?? task.status,
        currentTask
          ? DELIVERY_STATUS_TRANSITIONS[currentTask.status]
          : DELIVERY_STATUS_TRANSITIONS[task.status],
      );
    }

    const event = await this.repository.insertTaskEvent({
      tenantId: driver.tenantId,
      taskId: task.id,
      fromStatus: task.status,
      toStatus: "signed",
      lat: input.lat,
      lng: input.lng,
      deviceId: input.deviceId,
      idempotencyKey: input.idempotencyKey,
      note: input.signedByName
        ? `Signed by ${input.signedByName.trim()}`
        : undefined,
      createdBy: driver.subjectId,
    });

    return {
      task: await this.getTaskDetail(driver, task.id),
      event,
      proof,
      idempotent: false,
    };
  }

  async createAssignedTask(
    input: DeliveryAssignTaskInput,
  ): Promise<DeliveryTaskDetail> {
    const driver = assertDriverContext(input.authContext);

    if (
      input.tenantId !== driver.tenantId ||
      input.assigneeUserId !== driver.subjectId
    ) {
      throw forbidden();
    }

    const taskId = await this.repository.createAssignedTask({
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
      createdBy: driver.subjectId,
    });

    return this.getTaskDetail(driver, taskId);
  }
}
