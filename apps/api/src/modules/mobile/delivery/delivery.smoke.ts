import {
  DELIVERY_STATUS_TRANSITIONS,
  DeliveryService,
  type DeliveryMediaServiceLike,
  type DeliveryRepositoryLike,
} from "./delivery.service.js";
import { DeliveryError } from "./delivery.types.js";
import type {
  DeliveryProof,
  DeliveryTaskDetail,
  DeliveryTaskEvent,
  DeliveryTaskStatus,
} from "./delivery.types.js";
import type { MobileAuthContext } from "../auth/auth.types.js";

const driverContext: MobileAuthContext = {
  subjectType: "staff",
  subjectId: "driver_1",
  displayName: "Driver One",
  tenantId: "tenant_1",
  branchIds: ["branch_1"],
  role: "driver",
  roles: ["driver"],
  permissions: [],
  accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
};

const customerContext: MobileAuthContext = {
  ...driverContext,
  subjectType: "customer",
  subjectId: "customer_1",
  role: "customer",
  roles: ["customer"],
};

const ownerContext: MobileAuthContext = {
  ...driverContext,
  subjectId: "owner_1",
  displayName: "Owner One",
  branchIds: ["branch_1"],
  role: "owner",
  roles: ["owner"],
};

const restrictedOwnerContext: MobileAuthContext = {
  ...ownerContext,
  branchIds: ["branch_2"],
};

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertRejectsDelivery(
  action: () => Promise<unknown>,
  status: number,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    if (!(error instanceof DeliveryError)) {
      throw new Error("expected a DeliveryError");
    }

    assert(error.status === status, `expected status ${status}`);
    return;
  }

  throw new Error(`expected action to reject with ${status}`);
}

function canTransition(
  fromStatus: DeliveryTaskStatus,
  toStatus: DeliveryTaskStatus,
): boolean {
  return DELIVERY_STATUS_TRANSITIONS[fromStatus].includes(toStatus);
}

function makeDetail(
  status: DeliveryTaskStatus,
  overrides: Partial<DeliveryTaskDetail> = {},
): DeliveryTaskDetail {
  const now = new Date().toISOString();

  return {
    id: "task_1",
    tenantId: "tenant_1",
    branchId: "branch_1",
    appointmentId: null,
    assigneeUserId: "driver_1",
    type: "pickup",
    status,
    expectedAt: now,
    customerId: "customer_1",
    customerName: "Customer One",
    customerPhone: "+100000000",
    address: "1 Main St",
    notes: null,
    exceptionReason: null,
    cancellationReason: null,
    dispatchedAt: null,
    dispatchedBy: null,
    cancelledAt: null,
    cancelledBy: null,
    orderId: null,
    ticketId: null,
    updatedAt: now,
    timeline: [],
    proofs: [],
    order: null,
    ticket: null,
    ...overrides,
  };
}

function makeEvent(
  toStatus: DeliveryTaskStatus,
  idempotencyKey: string,
): DeliveryTaskEvent {
  return {
    id: `event_${idempotencyKey}`,
    taskId: "task_1",
    fromStatus: "pending_dispatch",
    toStatus,
    lat: null,
    lng: null,
    deviceId: null,
    idempotencyKey,
    note: null,
    createdAt: new Date().toISOString(),
  };
}

function makeProof(idempotencyKey: string): DeliveryProof {
  return {
    id: `proof_${idempotencyKey}`,
    taskId: "task_1",
    type: "pickup",
    mediaRef: "proof://one",
    deviceId: null,
    idempotencyKey,
    capturedAt: null,
    createdAt: new Date().toISOString(),
  };
}

function createRepository(options?: {
  status?: DeliveryTaskStatus;
  assigneeUserId?: string | null;
  appointmentId?: string | null;
  branchId?: string;
  tenantDriverIds?: string[];
  existingEvent?: DeliveryTaskEvent | null;
  existingProof?: DeliveryProof | null;
  updateSucceeds?: boolean;
  initialProofs?: DeliveryProof[];
}): DeliveryRepositoryLike {
  let status = options?.status ?? "pending_dispatch";
  let assigneeUserId =
    options && "assigneeUserId" in options
      ? options.assigneeUserId ?? null
      : "driver_1";
  let appointmentId =
    options && "appointmentId" in options ? options.appointmentId ?? null : null;
  const branchId = options?.branchId ?? "branch_1";
  const tenantDriverIds = new Set(options?.tenantDriverIds ?? ["driver_1", "driver_2"]);
  const events: DeliveryTaskEvent[] = [];
  const proofs: DeliveryProof[] = [...(options?.initialProofs ?? [])];

  function currentDetail(): DeliveryTaskDetail {
    return {
      ...makeDetail(status, {
        assigneeUserId,
        appointmentId,
        branchId,
      }),
      proofs,
    };
  }

  function currentTaskRecord() {
    return {
      id: "task_1",
      tenantId: "tenant_1",
      branchId,
      assigneeUserId,
      appointmentId,
      customerId: "customer_1",
      orderId: null,
      ticketId: null,
      type: "pickup" as const,
      status,
      version: 1,
    };
  }

  return {
    async listTodayTasks() {
      return [currentDetail()];
    },
    async findOwnedTaskById({ driverUserId }) {
      if (driverUserId !== assigneeUserId) {
        return null;
      }

      return currentTaskRecord();
    },
    async findTaskById() {
      return currentTaskRecord();
    },
    async getOwnedTaskDetail() {
      return currentDetail();
    },
    async getTaskDetailById() {
      return currentDetail();
    },
    async isTenantDriver({ tenantId, userId }) {
      return tenantId === "tenant_1" && tenantDriverIds.has(userId);
    },
    async findTaskEventByIdempotencyKey() {
      return options?.existingEvent ?? null;
    },
    async findProofByIdempotencyKey() {
      return options?.existingProof ?? null;
    },
    async insertTaskEvent(input) {
      const event = makeEvent(input.toStatus, input.idempotencyKey);

      events.push(event);
      return event;
    },
    async insertProof(input) {
      const proof = {
        ...makeProof(input.idempotencyKey),
        type: input.type,
        mediaRef: input.mediaRef,
      };

      proofs.push(proof);
      return proof;
    },
    async updateTaskStatus(input) {
      if (options?.updateSucceeds === false || input.fromStatus !== status) {
        return false;
      }

      status = input.toStatus;
      return true;
    },
    async signTask(input) {
      if (options?.updateSucceeds === false || input.fromStatus !== status) {
        return null;
      }

      status = "signed";

      const proof = {
        ...makeProof(input.idempotencyKey),
        type: "signature" as const,
        mediaRef: input.signatureMediaRef,
      };
      const event = makeEvent("signed", input.idempotencyKey);

      proofs.push(proof);
      events.push(event);

      return { event, proof, appointmentId };
    },
    async createAssignedTask(input) {
      assigneeUserId = input.assigneeUserId ?? null;
      appointmentId = input.appointmentId ?? null;
      status = "pending_dispatch";
      return "task_1";
    },
    async listPendingDispatchTasks() {
      return assigneeUserId ? [] : [currentDetail()];
    },
    async listAssignedDispatchTasks() {
      return assigneeUserId ? [currentDetail()] : [];
    },
    async dispatchTask(input) {
      if (options?.updateSucceeds === false) {
        return null;
      }

      assigneeUserId = input.assigneeUserId;
      status = "pending_dispatch";
      return makeEvent("pending_dispatch", input.idempotencyKey);
    },
    async reassignTask(input) {
      if (options?.updateSucceeds === false) {
        return null;
      }

      assigneeUserId = input.assigneeUserId;
      return makeEvent(input.fromStatus, input.idempotencyKey);
    },
    async cancelTask(input) {
      if (options?.updateSucceeds === false) {
        return null;
      }

      status = "cancelled";
      return {
        event: makeEvent("cancelled", input.idempotencyKey),
        appointmentId,
      };
    },
  };
}

function createMediaService(): DeliveryMediaServiceLike & {
  committed: string[];
} {
  const committed: string[] = [];

  return {
    committed,
    async assertOwnedAndCommit({ objectKey }) {
      committed.push(objectKey);
      return {
        id: `media_${committed.length}`,
        tenantId: "tenant_1",
        objectKey,
        contentType: "image/jpeg",
        sizeBytes: 128,
        status: "committed",
        purpose: objectKey.includes("delivery_signature")
          ? "delivery_signature"
          : "delivery_proof",
        createdBy: "driver_1",
        createdAt: new Date().toISOString(),
        committedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      };
    },
    async createDownloadLink({ objectKey }) {
      return {
        objectKey,
        downloadUrl: `https://media.local/${encodeURIComponent(objectKey)}`,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      };
    },
  };
}

export async function runDeliverySmokeChecks(): Promise<void> {
  assert(
    canTransition("pending_dispatch", "en_route"),
    "pending_dispatch should advance to en_route",
  );
  assert(
    canTransition("arrived", "picked_up"),
    "arrived should advance to picked_up",
  );
  assert(
    canTransition("delivering", "signed"),
    "delivering should advance to signed",
  );
  assert(
    !canTransition("pending_dispatch", "signed"),
    "pending_dispatch should not jump directly to signed",
  );
  assert(
    DELIVERY_STATUS_TRANSITIONS.signed.length === 0,
    "signed must be terminal",
  );

  const service = new DeliveryService({
    repository: createRepository(),
    mediaService: createMediaService(),
  });
  const updated = await service.updateStatus({
    authContext: driverContext,
    taskId: "task_1",
    toStatus: "en_route",
    idempotencyKey: "idem_1",
  });

  assert(updated.task.status === "en_route", "status update should apply");
  assert(!updated.idempotent, "first status update should not be idempotent");

  await assertRejectsDelivery(
    () =>
      service.updateStatus({
        authContext: customerContext,
        taskId: "task_1",
        toStatus: "arrived",
        idempotencyKey: "idem_2",
      }),
    403,
  );

  await assertRejectsDelivery(
    () =>
      new DeliveryService({
        repository: createRepository(),
        mediaService: createMediaService(),
      }).updateStatus({
        authContext: driverContext,
        taskId: "task_1",
        toStatus: "signed",
        idempotencyKey: "idem_3",
      }),
    409,
  );

  await assertRejectsDelivery(
    () =>
      new DeliveryService({
        repository: createRepository({ status: "delivering" }),
        mediaService: createMediaService(),
      }).updateStatus({
        authContext: driverContext,
        taskId: "task_1",
        toStatus: "signed",
        idempotencyKey: "idem_4",
      }),
    422,
  );

  const existingEvent = makeEvent("en_route", "idem_replay");
  const replayed = await new DeliveryService({
    repository: createRepository({ existingEvent }),
    mediaService: createMediaService(),
  }).updateStatus({
    authContext: driverContext,
    taskId: "task_1",
    toStatus: "en_route",
    idempotencyKey: "idem_replay",
  });

  assert(replayed.idempotent, "replayed status update should be idempotent");

  const mediaService = createMediaService();
  const proofResult = await new DeliveryService({
    repository: createRepository(),
    mediaService,
  }).uploadProof({
    authContext: driverContext,
    taskId: "task_1",
    type: "pickup",
    mediaRef: "tenant/tenant_1/delivery_proof/task_1/proof.jpg",
    idempotencyKey: "proof_key",
  });

  assert(
    mediaService.committed[0] ===
      "tenant/tenant_1/delivery_proof/task_1/proof.jpg",
    "proof upload should commit the media object",
  );
  assert(
    Boolean(proofResult.task.proofs[0]?.mediaUrl?.startsWith("https://media.local/")),
    "proof detail should include a download URL",
  );

  const replayMediaService = createMediaService();
  const existingProof = makeProof("proof_replay");
  const replayProof = await new DeliveryService({
    repository: createRepository({ existingProof }),
    mediaService: replayMediaService,
  }).uploadProof({
    authContext: driverContext,
    taskId: "task_1",
    type: "pickup",
    mediaRef: "tenant/tenant_1/delivery_proof/task_1/replay.jpg",
    idempotencyKey: "proof_replay",
  });

  assert(replayProof.idempotent, "replayed proof should be idempotent");
  assert(
    replayMediaService.committed.length === 0,
    "replayed proof should not recommit media",
  );

  await assertRejectsDelivery(
    () =>
      new DeliveryService({
        repository: createRepository({ status: "signed" }),
        mediaService: createMediaService(),
      }).updateStatus({
        authContext: driverContext,
        taskId: "task_1",
        toStatus: "arrived",
        idempotencyKey: "idem_old",
      }),
    409,
  );

  const dispatchService = new DeliveryService({
    repository: createRepository({ assigneeUserId: null }),
    mediaService: createMediaService(),
  });
  const dispatched = await dispatchService.dispatchTask({
    authContext: ownerContext,
    taskId: "task_1",
    assigneeUserId: "driver_1",
    idempotencyKey: "dispatch_1",
  });

  assert(!dispatched.idempotent, "first dispatch should not be idempotent");
  assert(
    dispatched.task.assigneeUserId === "driver_1",
    "dispatch should assign the task",
  );

  const board = await dispatchService.getDispatchBoard({
    authContext: ownerContext,
    branchId: "branch_1",
  });
  assert(board.pending.length === 0, "assigned tasks should leave pending list");
  assert(board.assigned.length === 1, "assigned board should include dispatch");

  const replayedDispatch = await new DeliveryService({
    repository: createRepository({
      assigneeUserId: "driver_1",
      existingEvent: makeEvent("pending_dispatch", "dispatch_replay"),
    }),
    mediaService: createMediaService(),
  }).dispatchTask({
    authContext: ownerContext,
    taskId: "task_1",
    assigneeUserId: "driver_1",
    idempotencyKey: "dispatch_replay",
  });
  assert(replayedDispatch.idempotent, "replayed dispatch should be idempotent");

  await assertRejectsDelivery(
    () =>
      new DeliveryService({
        repository: createRepository({
          assigneeUserId: null,
          updateSucceeds: false,
        }),
        mediaService: createMediaService(),
      }).dispatchTask({
        authContext: ownerContext,
        taskId: "task_1",
        assigneeUserId: "driver_1",
        idempotencyKey: "dispatch_race",
      }),
    409,
  );

  await assertRejectsDelivery(
    () =>
      new DeliveryService({
        repository: createRepository({ assigneeUserId: null }),
        mediaService: createMediaService(),
      }).dispatchTask({
        authContext: restrictedOwnerContext,
        taskId: "task_1",
        assigneeUserId: "driver_1",
        idempotencyKey: "dispatch_forbidden",
      }),
    403,
  );

  await assertRejectsDelivery(
    () =>
      new DeliveryService({
        repository: createRepository({
          assigneeUserId: null,
          tenantDriverIds: [],
        }),
        mediaService: createMediaService(),
      }).dispatchTask({
        authContext: ownerContext,
        taskId: "task_1",
        assigneeUserId: "driver_1",
        idempotencyKey: "dispatch_bad_driver",
      }),
    403,
  );

  const reassigned = await new DeliveryService({
    repository: createRepository({ status: "en_route", assigneeUserId: "driver_1" }),
    mediaService: createMediaService(),
  }).reassignTask({
    authContext: ownerContext,
    taskId: "task_1",
    assigneeUserId: "driver_2",
    idempotencyKey: "reassign_1",
  });
  assert(
    reassigned.task.assigneeUserId === "driver_2",
    "reassign should replace assignee",
  );

  let cancelledAppointmentId: string | null = null;
  const cancelled = await new DeliveryService({
    repository: createRepository({
      status: "en_route",
      assigneeUserId: "driver_1",
      appointmentId: "appointment_1",
    }),
    mediaService: createMediaService(),
    appointmentOperations: {
      async markDeliveryDone() {},
      async markDeliveryCancelled({ appointmentId }) {
        cancelledAppointmentId = appointmentId;
      },
    },
  }).cancelTask({
    authContext: ownerContext,
    taskId: "task_1",
    idempotencyKey: "cancel_1",
    reason: "Customer unavailable",
  });
  assert(cancelled.task.status === "cancelled", "cancel should terminalize task");
  assert(
    cancelledAppointmentId === "appointment_1",
    "cancel should call appointment linkage",
  );

  const ownerCreated = await new DeliveryService({
    repository: createRepository({ assigneeUserId: null }),
    mediaService: createMediaService(),
  }).createAssignedTask({
    authContext: ownerContext,
    tenantId: "tenant_1",
    branchId: "branch_1",
    assigneeUserId: "driver_2",
    customerId: "customer_1",
    type: "pickup",
    customerName: "Customer One",
    address: "1 Main St",
  });
  assert(
    ownerCreated.assigneeUserId === "driver_2",
    "owner should be able to create an assigned task",
  );

  await assertRejectsDelivery(
    () =>
      new DeliveryService({
        repository: createRepository({ assigneeUserId: null }),
        mediaService: createMediaService(),
      }).createAssignedTask({
        authContext: driverContext,
        tenantId: "tenant_1",
        branchId: "branch_1",
        assigneeUserId: "driver_2",
        customerId: "customer_1",
        type: "pickup",
        customerName: "Customer One",
        address: "1 Main St",
      }),
    403,
  );
}

if (process.argv[1]?.endsWith("delivery.smoke.ts")) {
  await runDeliverySmokeChecks();
}
