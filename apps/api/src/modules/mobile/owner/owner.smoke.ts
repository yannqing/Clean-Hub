import {
  OwnerService,
  type OwnerDeliveryRepositoryLike,
  type OwnerRepositoryLike,
} from "./owner.service.js";
import {
  OwnerError,
  type OwnerAppointment,
  type OwnerTodaySummary,
} from "./owner.types.js";
import type { MobileAuthContext } from "../auth/auth.types.js";

const ownerContext: MobileAuthContext = {
  subjectType: "staff",
  subjectId: "owner_1",
  displayName: "Owner One",
  tenantId: "tenant_1",
  currency: "XOF",
  branchIds: [],
  role: "owner",
  roles: ["owner"],
  permissions: [],
  accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
};

const driverContext: MobileAuthContext = {
  ...ownerContext,
  subjectId: "driver_1",
  role: "driver",
  roles: ["driver"],
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

async function assertRejectsOwner(
  action: () => Promise<unknown>,
  status: number,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    if (!(error instanceof OwnerError)) {
      throw new Error("expected an OwnerError");
    }

    assert(error.status === status, `expected status ${status}`);
    return;
  }

  throw new Error(`expected action to reject with ${status}`);
}

function makeAppointment(
  status: OwnerAppointment["status"] = "pending",
): OwnerAppointment {
  const now = new Date().toISOString();

  return {
    id: "appointment_1",
    tenantId: "tenant_1",
    branchId: "branch_1",
    customerId: "customer_1",
    customerName: "Customer One",
    customerPhone: null,
    type: "pickup",
    status,
    expectedAt: now,
    address: "1 Main St",
    notes: null,
    deliveryTaskId: status === "accepted" ? "task_1" : null,
    assigneeUserId: status === "accepted" ? "driver_1" : null,
    assigneeName: status === "accepted" ? "Driver One" : null,
    acceptedAt: status === "accepted" ? now : null,
    acceptedBy: status === "accepted" ? "owner_1" : null,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    doneAt: null,
    doneBy: null,
    createdAt: now,
    updatedAt: now,
  };
}

function createRepository(options?: {
  missingTenant?: boolean;
  appointmentStatus?: OwnerAppointment["status"];
  branchId?: string;
  deliveryTaskId?: string | null;
}): OwnerRepositoryLike {
  let appointment = {
    ...makeAppointment(options?.appointmentStatus ?? "pending"),
    branchId: options?.branchId ?? "branch_1",
    deliveryTaskId:
      options && "deliveryTaskId" in options
        ? options.deliveryTaskId ?? null
        : makeAppointment(options?.appointmentStatus ?? "pending").deliveryTaskId,
  };
  function assertTenant(tenantId: string): void {
    assert(tenantId === "tenant_1", "summary must be tenant scoped");
  }

  return {
    async listBranches({ tenantId, allowedBranchIds }) {
      assertTenant(tenantId);

      const branches = [
        {
          id: "branch_1",
          name: "Main Branch",
          address: "1 Main St",
          status: "active" as const,
        },
        {
          id: "branch_2",
          name: "Second Branch",
          address: "2 Main St",
          status: "active" as const,
        },
      ];

      return allowedBranchIds
        ? branches.filter((branch) => allowedBranchIds.includes(branch.id))
        : branches;
    },
    async listDrivers({ tenantId, branchId, allowedBranchIds }) {
      assertTenant(tenantId);

      const drivers = [
        {
          id: "driver_1",
          displayName: "Driver One",
          email: "driver@example.com",
          phone: "+100000001",
          status: "active" as const,
          branchIds: ["branch_1"],
        },
        {
          id: "driver_2",
          displayName: "Driver Two",
          email: "driver2@example.com",
          phone: "+100000002",
          status: "active" as const,
          branchIds: ["branch_2"],
        },
      ];

      return drivers.filter((driver) => {
        const scopedByBranch = branchId
          ? driver.branchIds.includes(branchId)
          : true;
        const scopedByOwner = allowedBranchIds
          ? driver.branchIds.some((id) => allowedBranchIds.includes(id))
          : true;

        return scopedByBranch && scopedByOwner;
      });
    },
    async findTenantBase(tenantId) {
      assertTenant(tenantId);

      if (options?.missingTenant) {
        return null;
      }

      return {
        tenantId,
        tenantName: "Demo Tenant",
        tenantStatus: "active",
        currency: "XOF",
        featureFlags: {
          laundryEnabled: true,
          carWashEnabled: false,
          retailProductsEnabled: false,
          deliveryEnabled: true,
          notificationsEnabled: true,
        },
      } satisfies Pick<
        OwnerTodaySummary,
        "tenantId" | "tenantName" | "tenantStatus" | "currency" | "featureFlags"
      >;
    },
    async countTodayOrders({ tenantId }) {
      assertTenant(tenantId);
      return 8;
    },
    async sumTodayRevenue({ tenantId }) {
      assertTenant(tenantId);
      return 12500;
    },
    async countPendingPickup(tenantId) {
      assertTenant(tenantId);
      return 3;
    },
    async countInProgressOrders(tenantId) {
      assertTenant(tenantId);
      return 4;
    },
    async getAppointmentSummary({ tenantId }) {
      assertTenant(tenantId);
      return {
        pending: 2,
        accepted: 1,
        cancelled: 0,
        done: 5,
      };
    },
    async getDeliverySummary({ tenantId }) {
      assertTenant(tenantId);
      return {
        pendingDispatch: 1,
        inProgress: 2,
        signed: 3,
        exception: 0,
      };
    },
    async listAppointments({ tenantId }) {
      assertTenant(tenantId);
      return [appointment];
    },
    async findAppointmentById({ tenantId, appointmentId }) {
      assertTenant(tenantId);
      return appointmentId === "appointment_1" ? appointment : null;
    },
    async acceptAppointmentAndCreateTask({ tenantId, appointmentId }) {
      assertTenant(tenantId);

      if (appointmentId !== "appointment_1" || appointment.status !== "pending") {
        return null;
      }

      appointment = {
        ...appointment,
        status: "accepted",
        deliveryTaskId: "task_1",
        acceptedAt: new Date().toISOString(),
        acceptedBy: "owner_1",
      };

      return { appointment, taskId: "task_1" };
    },
    async rejectPendingAppointment({ tenantId, appointmentId, reason }) {
      assertTenant(tenantId);

      if (appointmentId !== "appointment_1" || appointment.status !== "pending") {
        return null;
      }

      appointment = {
        ...appointment,
        status: "cancelled",
        cancellationReason: reason,
        cancelledAt: new Date().toISOString(),
        cancelledBy: "owner_1",
      };

      return appointment;
    },
    async markAppointmentDoneFromDelivery({ appointmentId, taskId }) {
      if (appointment.id !== appointmentId || appointment.deliveryTaskId !== taskId) {
        return;
      }

      appointment = {
        ...appointment,
        status: "done",
        doneAt: new Date().toISOString(),
        doneBy: "driver_1",
      };
    },
    async reopenAppointmentFromCancelledDelivery({ appointmentId, taskId }) {
      if (appointment.id !== appointmentId || appointment.deliveryTaskId !== taskId) {
        return;
      }

      appointment = {
        ...appointment,
        status: "accepted",
        deliveryTaskId: null,
      };
    },
  };
}

function createDeliveryRepository(options?: {
  driverIds?: string[];
}): OwnerDeliveryRepositoryLike {
  const driverIds = new Set(options?.driverIds ?? ["driver_1"]);

  return {
    async isTenantDriver({ tenantId, userId }) {
      return tenantId === "tenant_1" && driverIds.has(userId);
    },
    async getTaskDetailById({ tenantId, taskId }) {
      const now = new Date().toISOString();

      if (tenantId !== "tenant_1" || taskId !== "task_1") {
        return null;
      }

      return {
        id: "task_1",
        tenantId,
        branchId: "branch_1",
        appointmentId: "appointment_1",
        assigneeUserId: "driver_1",
        assigneeName: "Driver One",
        type: "pickup",
        status: "pending_dispatch",
        expectedAt: now,
        customerId: "customer_1",
        customerName: "Customer One",
        customerPhone: null,
        address: "1 Main St",
        notes: null,
        exceptionReason: null,
        cancellationReason: null,
        dispatchedAt: now,
        dispatchedBy: "owner_1",
        cancelledAt: null,
        cancelledBy: null,
        orderId: null,
        ticketId: null,
        updatedAt: now,
        timeline: [],
        proofs: [],
        order: null,
        ticket: null,
      };
    },
  };
}

export async function runOwnerSmokeChecks(): Promise<void> {
  const service = new OwnerService({
    repository: createRepository(),
    deliveryRepository: createDeliveryRepository(),
  });
  const summary = await service.getTodaySummary(ownerContext);

  assert(summary.tenantId === "tenant_1", "summary should use token tenant");
  assert(summary.currency === "XOF", "summary should include tenant currency");
  assert(summary.todayOrderCount === 8, "summary should include order count");
  assert(
    summary.todayRevenueAmount === 12500,
    "summary should include revenue",
  );
  assert(
    summary.appointmentSummary.pending === 2,
    "summary should include appointments",
  );
  assert(
    summary.deliverySummary.inProgress === 2,
    "summary should include deliveries",
  );

  const branches = await service.listBranches(ownerContext);
  assert(branches.length === 2, "tenant owner should list tenant branches");

  const drivers = await service.listDrivers({
    authContext: ownerContext,
    branchId: "branch_1",
  });
  assert(drivers.length === 1, "owner should list branch drivers");
  assert(drivers[0]?.id === "driver_1", "branch driver should match filter");

  const appointments = await service.listAppointments({
    authContext: ownerContext,
    branchId: "branch_1",
  });
  assert(appointments.length === 1, "owner should list appointments");

  const accepted = await service.acceptAppointment({
    authContext: ownerContext,
    appointmentId: "appointment_1",
    idempotencyKey: "accept_1",
    assigneeUserId: "driver_1",
  });
  assert(accepted.appointment.status === "accepted", "appointment accepts");
  assert(accepted.task.id === "task_1", "accepted appointment returns task");

  const replayedAccept = await service.acceptAppointment({
    authContext: ownerContext,
    appointmentId: "appointment_1",
    idempotencyKey: "accept_1",
    assigneeUserId: "driver_1",
  });
  assert(replayedAccept.idempotent, "accepted appointment should replay idempotently");
  assert(
    replayedAccept.task.id === "task_1",
    "accepted appointment replay should return existing task",
  );

  const rejected = await new OwnerService({
    repository: createRepository(),
    deliveryRepository: createDeliveryRepository(),
  }).rejectAppointment({
    authContext: ownerContext,
    appointmentId: "appointment_1",
    reason: "No slot",
  });
  assert(rejected.status === "cancelled", "pending appointment rejects");
  assert(rejected.cancellationReason === "No slot", "reject should store reason");

  await assertRejectsOwner(
    () =>
      new OwnerService({
        repository: createRepository({ appointmentStatus: "done" }),
        deliveryRepository: createDeliveryRepository(),
      }).acceptAppointment({
        authContext: ownerContext,
        appointmentId: "appointment_1",
        idempotencyKey: "accept_done",
      }),
    409,
  );

  await assertRejectsOwner(
    () =>
      new OwnerService({
        repository: createRepository({ branchId: "branch_1" }),
        deliveryRepository: createDeliveryRepository(),
      }).listAppointments({
        authContext: restrictedOwnerContext,
        branchId: "branch_1",
      }),
    403,
  );

  const restrictedBranches = await service.listBranches(restrictedOwnerContext);
  assert(
    restrictedBranches.every((branch) => branch.id === "branch_2"),
    "restricted owner should only list allowed branches",
  );

  await assertRejectsOwner(
    () =>
      new OwnerService({
        repository: createRepository(),
        deliveryRepository: createDeliveryRepository(),
      }).listDrivers({
        authContext: restrictedOwnerContext,
        branchId: "branch_1",
      }),
    403,
  );

  await assertRejectsOwner(
    () =>
      new OwnerService({
        repository: createRepository(),
        deliveryRepository: createDeliveryRepository({ driverIds: [] }),
      }).acceptAppointment({
        authContext: ownerContext,
        appointmentId: "appointment_1",
        idempotencyKey: "accept_bad_driver",
        assigneeUserId: "driver_1",
      }),
    403,
  );

  const linkageRepository = createRepository({
    appointmentStatus: "accepted",
    deliveryTaskId: "task_1",
  });
  const linkageService = new OwnerService({
    repository: linkageRepository,
    deliveryRepository: createDeliveryRepository(),
  });
  await linkageService.markDeliveryDone({
    tenantId: "tenant_1",
    appointmentId: "appointment_1",
    taskId: "task_1",
    operatorUserId: "driver_1",
  });
  const doneAppointment = await linkageService.listAppointments({
    authContext: ownerContext,
    branchId: "branch_1",
  });
  assert(
    doneAppointment[0]?.status === "done",
    "signed delivery should mark appointment done",
  );

  await linkageService.markDeliveryCancelled({
    tenantId: "tenant_1",
    appointmentId: "appointment_1",
    taskId: "task_1",
    operatorUserId: "owner_1",
  });
  const reopenedAppointment = await linkageService.listAppointments({
    authContext: ownerContext,
    branchId: "branch_1",
  });
  assert(
    reopenedAppointment[0]?.status === "accepted" &&
      reopenedAppointment[0].deliveryTaskId === null,
    "cancelled delivery should reopen appointment for redispatch",
  );

  await assertRejectsOwner(
    () => service.getTodaySummary(driverContext),
    403,
  );

  await assertRejectsOwner(
    () =>
      new OwnerService({
        repository: createRepository({ missingTenant: true }),
        deliveryRepository: createDeliveryRepository(),
      }).getTodaySummary(ownerContext),
    404,
  );
}

if (process.argv[1]?.endsWith("owner.smoke.ts")) {
  await runOwnerSmokeChecks();
}
