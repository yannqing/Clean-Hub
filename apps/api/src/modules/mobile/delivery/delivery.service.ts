import { getDb, type Database } from "@cleanhub/db";

import { MediaError, MediaService } from "../../media/index.js";
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
  mediaService?: DeliveryMediaServiceLike;
};

export type DeliveryMediaServiceLike = Pick<
  MediaService,
  "assertOwnedAndCommit" | "createDownloadLink"
>;

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
  } | null>;
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
  private readonly mediaService: DeliveryMediaServiceLike;

  constructor(options: DeliveryServiceOptions = {}) {
    this.repository =
      options.repository ?? new DeliveryRepository(options.db ?? getDb());
    this.mediaService = options.mediaService ?? new MediaService();
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
