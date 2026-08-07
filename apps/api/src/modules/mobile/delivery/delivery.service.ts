import { getDb, type Database } from "@cleanhub/db";
import { logger } from "@cleanhub/logger";
import {
  getDateOnlyInTimeZone,
  getUtcDayRangeInTimeZone,
} from "@cleanhub/domain/timezone";

import {
  deliveryStatusChangedEvent,
  orderCompletedEvent,
  type NotificationPublisher,
} from "../../notifications/index.js";
import type { AppointmentOperationsServiceLike } from "../owner/owner.service.js";
import { MediaError, MediaService } from "../../media/index.js";
import { DeliveryRepository } from "./delivery.repository.js";
import type {
  DeliveryAssignTaskInput,
  DeliveryCancelTaskInput,
  DeliveryDispatchBoard,
  DeliveryDispatchBoardQuery,
  DeliveryDispatchTaskInput,
  DeliveryDriverContext,
  DeliveryError,
  DeliveryMutationResult,
  DeliveryProof,
  DeliveryTaskEvent,
  DeliveryTaskDetail,
  DeliveryTaskListItem,
  DeliveryTaskStatus,
  DeliveryReassignTaskInput,
  DeliveryUpdateStatusInput,
  DeliveryUploadProofInput,
  DeliverySignTaskInput,
} from "./delivery.types.js";
import { DeliveryError as MobileDeliveryError } from "./delivery.types.js";
import type { MobileAuthContext } from "../auth/auth.types.js";

export type DeliveryServiceOptions = {
  db?: Database;
  repository?: DeliveryRepositoryLike;
  mediaService?: DeliveryMediaServiceLike;
  appointmentOperations?: AppointmentOperationsServiceLike;
  notificationPublisher?: NotificationPublisher;
};

export type DeliveryMediaServiceLike = Pick<
  MediaService,
  "assertOwnedAndCommit" | "createDownloadLink"
>;

type DeliveryTaskRecord = {
  id: string;
  tenantId: string;
  branchId: string;
  assigneeUserId: string | null;
  appointmentId: string | null;
  customerId: string;
  orderId: string | null;
  ticketId: string | null;
  type: "pickup" | "dropoff";
  status: DeliveryTaskStatus;
  expectedAt: Date | null;
  customerName: string;
  version: number;
};

export type DeliveryRepositoryLike = {
  listDriverTasks(input: {
    tenantId: string;
    driverUserId: string;
    start?: Date;
    end?: Date;
  }): Promise<DeliveryTaskListItem[]>;
  findOwnedTaskById(input: {
    tenantId: string;
    driverUserId: string;
    taskId: string;
  }): Promise<DeliveryTaskRecord | null>;
  findTaskById(input: {
    tenantId: string;
    taskId: string;
  }): Promise<DeliveryTaskRecord | null>;
  getOwnedTaskDetail(input: {
    tenantId: string;
    driverUserId: string;
    taskId: string;
  }): Promise<DeliveryTaskDetail | null>;
  getTaskDetailById(input: {
    tenantId: string;
    taskId: string;
  }): Promise<DeliveryTaskDetail | null>;
  isTenantDriver(input: {
    tenantId: string;
    userId: string;
  }): Promise<boolean>;
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
  signTask(input: {
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
  } | null>;
  createAssignedTask(input: {
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
  }): Promise<string>;
  listPendingDispatchTasks(input: {
    tenantId: string;
    branchId: string;
  }): Promise<DeliveryTaskListItem[]>;
  listAssignedDispatchTasks(input: {
    tenantId: string;
    branchId: string;
    assigneeUserId?: string;
    status?: DeliveryTaskStatus;
    from?: Date;
    to?: Date;
  }): Promise<DeliveryTaskListItem[]>;
  dispatchTask(input: {
    tenantId: string;
    taskId: string;
    taskVersion: number;
    assigneeUserId: string;
    operatorUserId: string;
    idempotencyKey: string;
    note?: string;
  }): Promise<DeliveryTaskEvent | null>;
  reassignTask(input: {
    tenantId: string;
    taskId: string;
    taskVersion: number;
    fromStatus: DeliveryTaskStatus;
    assigneeUserId: string;
    operatorUserId: string;
    idempotencyKey: string;
    note?: string;
  }): Promise<DeliveryTaskEvent | null>;
  cancelTask(input: {
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
  } | null>;
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

function assertOwnerContext(
  authContext: MobileAuthContext,
): MobileAuthContext & { subjectType: "staff"; role: "owner" } {
  if (authContext.subjectType !== "staff" || authContext.role !== "owner") {
    throw forbidden();
  }

  return authContext as MobileAuthContext & {
    subjectType: "staff";
    role: "owner";
  };
}

function forbidden(): DeliveryError {
  return new MobileDeliveryError(
    "DELIVERY_FORBIDDEN",
    "Delivery access is required.",
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

function getTodayBounds(
  timeZone: string,
  now = new Date(),
): { start: Date; end: Date } {
  const { from, to } = getUtcDayRangeInTimeZone(
    getDateOnlyInTimeZone(now, timeZone),
    timeZone,
  );

  return { start: from, end: to };
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
  private readonly mediaService: DeliveryMediaServiceLike;
  private readonly appointmentOperations?: AppointmentOperationsServiceLike;
  private readonly notificationPublisher?: NotificationPublisher;

  constructor(options: DeliveryServiceOptions = {}) {
    this.repository =
      options.repository ?? new DeliveryRepository(options.db ?? getDb());
    this.mediaService = options.mediaService ?? new MediaService();
    this.appointmentOperations = options.appointmentOperations;
    this.notificationPublisher = options.notificationPublisher;
  }

  async listTodayTasks(
    authContext: MobileAuthContext,
  ): Promise<DeliveryTaskListItem[]> {
    const driver = assertDriverContext(authContext);
    const { start, end } = getTodayBounds(driver.timezone ?? "UTC");

    return this.repository.listDriverTasks({
      tenantId: driver.tenantId,
      driverUserId: driver.subjectId,
      start,
      end,
    });
  }

  async listTasks(
    authContext: MobileAuthContext,
    range: { from?: Date; to?: Date } = {},
  ): Promise<DeliveryTaskListItem[]> {
    const driver = assertDriverContext(authContext);

    return this.repository.listDriverTasks({
      tenantId: driver.tenantId,
      driverUserId: driver.subjectId,
      start: range.from,
      end: range.to,
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

    return this.attachProofReadLinks(driver.tenantId, detail);
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

    await this.publishDeliveryStatusChanged({
      task,
      fromStatus: task.status,
      toStatus: input.toStatus,
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

    await this.commitMediaRef({
      tenantId: driver.tenantId,
      objectKey: input.mediaRef,
      expectedPurpose: "delivery_proof",
      expectedEntityId: task.id,
      expectedCreatedBy: driver.subjectId,
    });

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

    await this.commitMediaRef({
      tenantId: driver.tenantId,
      objectKey: input.signatureMediaRef,
      expectedPurpose: "delivery_signature",
      expectedEntityId: task.id,
      expectedCreatedBy: driver.subjectId,
    });

    const signed = await this.repository.signTask({
      tenantId: driver.tenantId,
      taskId: task.id,
      driverUserId: driver.subjectId,
      fromStatus: task.status,
      signatureMediaRef: input.signatureMediaRef,
      deviceId: input.deviceId,
      idempotencyKey: input.idempotencyKey,
      capturedAt: input.capturedAt,
      lat: input.lat,
      lng: input.lng,
      signedByName: input.signedByName,
    });

    if (!signed) {
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

    if (signed.appointmentId) {
      await this.appointmentOperations?.markDeliveryDone({
        tenantId: driver.tenantId,
        appointmentId: signed.appointmentId,
        taskId: task.id,
        operatorUserId: driver.subjectId,
      });
    }

    await this.publishDeliveryStatusChanged({
      task,
      fromStatus: task.status,
      toStatus: "signed",
    });

    return {
      task: await this.getTaskDetail(driver, task.id),
      event: signed.event,
      proof: signed.proof,
      idempotent: false,
    };
  }

  async createAssignedTask(
    input: DeliveryAssignTaskInput,
  ): Promise<DeliveryTaskDetail> {
    if (input.authContext.subjectType !== "staff") {
      throw forbidden();
    }

    if (input.tenantId !== input.authContext.tenantId) {
      throw forbidden();
    }

    if (input.authContext.role === "driver") {
      if (input.assigneeUserId !== input.authContext.subjectId) {
        throw forbidden();
      }
    } else if (input.authContext.role === "owner") {
      this.assertBranchAccess(input.authContext, input.branchId);

      if (input.assigneeUserId) {
        await this.assertTenantDriver(input.tenantId, input.assigneeUserId);
      }
    } else {
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
      createdBy: input.authContext.subjectId,
    });

    const detail = await this.repository.getTaskDetailById({
      tenantId: input.tenantId,
      taskId,
    });

    if (!detail) {
      throw taskNotFound();
    }

    await this.publishDeliveryStatusChanged({
      task: this.detailToTaskRecord(detail),
      fromStatus: null,
      toStatus: detail.status,
    });

    return this.attachProofReadLinks(input.tenantId, detail);
  }

  async getDispatchBoard(
    input: DeliveryDispatchBoardQuery,
  ): Promise<DeliveryDispatchBoard> {
    const owner = assertOwnerContext(input.authContext);

    this.assertBranchAccess(owner, input.branchId);

    const [pending, assigned] = await Promise.all([
      this.repository.listPendingDispatchTasks({
        tenantId: owner.tenantId,
        branchId: input.branchId,
      }),
      this.repository.listAssignedDispatchTasks({
        tenantId: owner.tenantId,
        branchId: input.branchId,
        assigneeUserId: input.assigneeUserId,
        status: input.status,
        from: input.from,
        to: input.to,
      }),
    ]);

    return { pending, assigned };
  }

  async dispatchTask(
    input: DeliveryDispatchTaskInput,
  ): Promise<DeliveryMutationResult> {
    const owner = assertOwnerContext(input.authContext);
    const task = await this.getDispatchableTask(owner.tenantId, input.taskId);

    this.assertBranchAccess(owner, task.branchId);
    await this.assertTenantDriver(owner.tenantId, input.assigneeUserId);

    const existingEvent = await this.repository.findTaskEventByIdempotencyKey({
      taskId: task.id,
      idempotencyKey: input.idempotencyKey,
    });

    if (existingEvent) {
      return {
        task: await this.getTaskDetailForOperator(owner.tenantId, task.id),
        event: existingEvent,
        idempotent: true,
      };
    }

    if (task.status !== "pending_dispatch" || task.assigneeUserId) {
      throw conflict(
        "Only unassigned pending dispatch tasks can be dispatched.",
        task.status,
        task.status === "pending_dispatch" ? ["pending_dispatch"] : [],
      );
    }

    const event = await this.repository.dispatchTask({
      tenantId: owner.tenantId,
      taskId: task.id,
      taskVersion: task.version,
      assigneeUserId: input.assigneeUserId,
      operatorUserId: owner.subjectId,
      idempotencyKey: input.idempotencyKey,
      note: input.note,
    });

    if (!event) {
      await this.throwTaskChanged(owner.tenantId, task.id, task.status);
    }

    logger.info(
      {
        tenantId: owner.tenantId,
        branchId: task.branchId,
        taskId: task.id,
        assigneeUserId: input.assigneeUserId,
        operatorUserId: owner.subjectId,
      },
      "Mobile delivery task dispatched",
    );

    return {
      task: await this.getTaskDetailForOperator(owner.tenantId, task.id),
      event: event ?? undefined,
      idempotent: false,
    };
  }

  async reassignTask(
    input: DeliveryReassignTaskInput,
  ): Promise<DeliveryMutationResult> {
    const owner = assertOwnerContext(input.authContext);
    const task = await this.getDispatchableTask(owner.tenantId, input.taskId);

    this.assertBranchAccess(owner, task.branchId);
    await this.assertTenantDriver(owner.tenantId, input.assigneeUserId);

    const existingEvent = await this.repository.findTaskEventByIdempotencyKey({
      taskId: task.id,
      idempotencyKey: input.idempotencyKey,
    });

    if (existingEvent) {
      return {
        task: await this.getTaskDetailForOperator(owner.tenantId, task.id),
        event: existingEvent,
        idempotent: true,
      };
    }

    if (!task.assigneeUserId) {
      throw conflict(
        "Only assigned delivery tasks can be reassigned.",
        task.status,
        ["pending_dispatch"],
      );
    }

    if (TERMINAL_STATUSES.has(task.status)) {
      throw conflict("Terminal delivery tasks cannot be reassigned.", task.status, []);
    }

    const event = await this.repository.reassignTask({
      tenantId: owner.tenantId,
      taskId: task.id,
      taskVersion: task.version,
      fromStatus: task.status,
      assigneeUserId: input.assigneeUserId,
      operatorUserId: owner.subjectId,
      idempotencyKey: input.idempotencyKey,
      note: input.note,
    });

    if (!event) {
      await this.throwTaskChanged(owner.tenantId, task.id, task.status);
    }

    logger.info(
      {
        tenantId: owner.tenantId,
        branchId: task.branchId,
        taskId: task.id,
        assigneeUserId: input.assigneeUserId,
        operatorUserId: owner.subjectId,
      },
      "Mobile delivery task reassigned",
    );

    return {
      task: await this.getTaskDetailForOperator(owner.tenantId, task.id),
      event: event ?? undefined,
      idempotent: false,
    };
  }

  async cancelTask(input: DeliveryCancelTaskInput): Promise<DeliveryMutationResult> {
    const owner = assertOwnerContext(input.authContext);
    const task = await this.getDispatchableTask(owner.tenantId, input.taskId);

    this.assertBranchAccess(owner, task.branchId);

    const existingEvent = await this.repository.findTaskEventByIdempotencyKey({
      taskId: task.id,
      idempotencyKey: input.idempotencyKey,
    });

    if (existingEvent) {
      return {
        task: await this.getTaskDetailForOperator(owner.tenantId, task.id),
        event: existingEvent,
        idempotent: true,
      };
    }

    if (TERMINAL_STATUSES.has(task.status)) {
      throw conflict("Terminal delivery tasks cannot be cancelled.", task.status, []);
    }

    const cancelled = await this.repository.cancelTask({
      tenantId: owner.tenantId,
      taskId: task.id,
      taskVersion: task.version,
      fromStatus: task.status,
      operatorUserId: owner.subjectId,
      idempotencyKey: input.idempotencyKey,
      reason: input.reason,
    });

    if (!cancelled) {
      await this.throwTaskChanged(owner.tenantId, task.id, task.status);
    }

    if (cancelled?.appointmentId) {
      await this.appointmentOperations?.markDeliveryCancelled({
        tenantId: owner.tenantId,
        appointmentId: cancelled.appointmentId,
        taskId: task.id,
        operatorUserId: owner.subjectId,
      });
    }

    await this.publishDeliveryStatusChanged({
      task,
      fromStatus: task.status,
      toStatus: "cancelled",
    });

    logger.info(
      {
        tenantId: owner.tenantId,
        branchId: task.branchId,
        taskId: task.id,
        operatorUserId: owner.subjectId,
      },
      "Mobile delivery task cancelled",
    );

    return {
      task: await this.getTaskDetailForOperator(owner.tenantId, task.id),
      event: cancelled?.event,
      idempotent: false,
    };
  }

  private async attachProofReadLinks(
    tenantId: string,
    detail: DeliveryTaskDetail,
  ): Promise<DeliveryTaskDetail> {
    const proofs = await Promise.all(
      detail.proofs.map(async (proof) => {
        try {
          const link = await this.mediaService.createDownloadLink({
            tenantId,
            objectKey: proof.mediaRef,
          });

          return {
            ...proof,
            mediaUrl: link.downloadUrl,
            mediaUrlExpiresAt: link.expiresAt,
          };
        } catch (error) {
          if (error instanceof MediaError && error.status === 404) {
            return proof;
          }

          throw this.mapMediaError(error);
        }
      }),
    );

    return {
      ...detail,
      proofs,
    };
  }

  private assertBranchAccess(
    authContext: MobileAuthContext,
    branchId: string,
  ): void {
    if (authContext.branchIds.length > 0 && !authContext.branchIds.includes(branchId)) {
      throw forbidden();
    }
  }

  private async assertTenantDriver(
    tenantId: string,
    userId: string,
  ): Promise<void> {
    if (!(await this.repository.isTenantDriver({ tenantId, userId }))) {
      throw forbidden();
    }
  }

  private async getDispatchableTask(
    tenantId: string,
    taskId: string,
  ): Promise<DeliveryTaskRecord> {
    const task = await this.repository.findTaskById({ tenantId, taskId });

    if (!task) {
      throw taskNotFound();
    }

    return task;
  }

  private async getTaskDetailForOperator(
    tenantId: string,
    taskId: string,
  ): Promise<DeliveryTaskDetail> {
    const detail = await this.repository.getTaskDetailById({ tenantId, taskId });

    if (!detail) {
      throw taskNotFound();
    }

    return this.attachProofReadLinks(tenantId, detail);
  }

  private async throwTaskChanged(
    tenantId: string,
    taskId: string,
    fallbackStatus: DeliveryTaskStatus,
  ): Promise<never> {
    const currentTask = await this.repository.findTaskById({ tenantId, taskId });

    throw conflict(
      "Delivery task changed while processing the request.",
      currentTask?.status ?? fallbackStatus,
      currentTask ? DELIVERY_STATUS_TRANSITIONS[currentTask.status] : [],
    );
  }

  private async commitMediaRef(input: {
    tenantId: string;
    objectKey: string;
    expectedPurpose: "delivery_proof" | "delivery_signature";
    expectedEntityId: string;
    expectedCreatedBy: string;
  }): Promise<void> {
    try {
      await this.mediaService.assertOwnedAndCommit(input);
    } catch (error) {
      throw this.mapMediaError(error);
    }
  }

  private async publishDeliveryStatusChanged(input: {
    task: DeliveryTaskRecord;
    fromStatus: DeliveryTaskStatus | null;
    toStatus: DeliveryTaskStatus;
  }): Promise<void> {
    if (!this.notificationPublisher) {
      return;
    }

    try {
      await this.notificationPublisher.publish(
        deliveryStatusChangedEvent({
          tenantId: input.task.tenantId,
          branchId: input.task.branchId,
          customerId: input.task.customerId,
          taskId: input.task.id,
          type: input.task.type,
          fromStatus: input.fromStatus,
          toStatus: input.toStatus,
          orderId: input.task.orderId,
          ticketId: input.task.ticketId,
          customerName: input.task.customerName,
          expectedAt: input.task.expectedAt?.toISOString() ?? null,
        }),
      );

      if (
        input.toStatus === "signed" &&
        input.task.type === "dropoff" &&
        input.task.orderId
      ) {
        await this.notificationPublisher.publish(
          orderCompletedEvent({
            tenantId: input.task.tenantId,
            branchId: input.task.branchId,
            customerId: input.task.customerId,
            orderId: input.task.orderId,
            orderNo: input.task.orderId,
          }),
        );
      }
    } catch (error) {
      logger.error(
        {
          error,
          tenantId: input.task.tenantId,
          taskId: input.task.id,
          fromStatus: input.fromStatus,
          toStatus: input.toStatus,
        },
        "Delivery notification event failed",
      );
    }
  }

  private detailToTaskRecord(detail: DeliveryTaskDetail): DeliveryTaskRecord {
    return {
      id: detail.id,
      tenantId: detail.tenantId,
      branchId: detail.branchId,
      assigneeUserId: detail.assigneeUserId,
      appointmentId: detail.appointmentId,
      customerId: detail.customerId,
      orderId: detail.orderId,
      ticketId: detail.ticketId,
      type: detail.type,
      status: detail.status,
      expectedAt: detail.expectedAt ? new Date(detail.expectedAt) : null,
      customerName: detail.customerName,
      version: 0,
    };
  }

  private mapMediaError(error: unknown): DeliveryError {
    if (error instanceof MediaError) {
      if (error.status === 404) {
        return new MobileDeliveryError(
          "DELIVERY_MEDIA_NOT_FOUND",
          "Delivery media object was not found.",
          404,
        );
      }

      if (error.status === 403) {
        return new MobileDeliveryError(
          "DELIVERY_FORBIDDEN",
          "Delivery media object is not accessible.",
          403,
        );
      }

      return validationError(error.message);
    }

    throw error;
  }
}
