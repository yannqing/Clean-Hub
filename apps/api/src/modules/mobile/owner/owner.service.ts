import { getDb, type Database } from "@cleanhub/db";
import { logger } from "@cleanhub/logger";
import {
  getDateOnlyInTimeZone,
  getUtcDayRangeInTimeZone,
} from "@cleanhub/domain/timezone";

import type { MobileAuthContext } from "../auth/auth.types.js";
import { DeliveryRepository } from "../delivery/delivery.repository.js";
import {
  appointmentAcceptedEvent,
  appointmentRejectedEvent,
  type NotificationPublisher,
} from "../../notifications/index.js";
import { OwnerRepository } from "./owner.repository.js";
import type {
  OwnerAppointment,
  OwnerAppointmentAcceptResult,
  OwnerAppointmentStatus,
  OwnerBranchOption,
  OwnerDriverOption,
  OwnerMobileContext,
  OwnerTodaySummary,
} from "./owner.types.js";
import { OwnerError } from "./owner.types.js";

export type OwnerRepositoryLike = {
  listBranches(input: {
    tenantId: string;
    allowedBranchIds?: string[];
  }): Promise<OwnerBranchOption[]>;
  listDrivers(input: {
    tenantId: string;
    branchId?: string;
    allowedBranchIds?: string[];
  }): Promise<OwnerDriverOption[]>;
  findTenantBase(tenantId: string): Promise<Pick<
    OwnerTodaySummary,
    "tenantId" | "tenantName" | "tenantStatus" | "currency" | "featureFlags"
  > | null>;
  countTodayOrders(input: {
    tenantId: string;
    start: Date;
    end: Date;
  }): Promise<number>;
  sumTodayRevenue(input: {
    tenantId: string;
    start: Date;
    end: Date;
  }): Promise<number>;
  countPendingPickup(tenantId: string): Promise<number>;
  countInProgressOrders(tenantId: string): Promise<number>;
  getAppointmentSummary(input: {
    tenantId: string;
    start: Date;
    end: Date;
  }): Promise<OwnerTodaySummary["appointmentSummary"]>;
  getDeliverySummary(input: {
    tenantId: string;
    start: Date;
    end: Date;
  }): Promise<OwnerTodaySummary["deliverySummary"]>;
  listAppointments(input: {
    tenantId: string;
    branchId?: string;
    status?: OwnerAppointmentStatus;
  }): Promise<OwnerAppointment[]>;
  findAppointmentById(input: {
    tenantId: string;
    appointmentId: string;
  }): Promise<OwnerAppointment | null>;
  acceptAppointmentAndCreateTask(input: {
    tenantId: string;
    appointmentId: string;
    operatorUserId: string;
    assigneeUserId?: string;
    notes?: string;
  }): Promise<{ appointment: OwnerAppointment; taskId: string } | null>;
  rejectPendingAppointment(input: {
    tenantId: string;
    appointmentId: string;
    operatorUserId: string;
    reason: string;
  }): Promise<OwnerAppointment | null>;
  markAppointmentDoneFromDelivery(input: {
    tenantId: string;
    appointmentId: string;
    taskId: string;
    operatorUserId: string;
  }): Promise<void>;
  reopenAppointmentFromCancelledDelivery(input: {
    tenantId: string;
    appointmentId: string;
    taskId: string;
    operatorUserId: string;
  }): Promise<void>;
};

export type OwnerDeliveryRepositoryLike = Pick<
  DeliveryRepository,
  "getTaskDetailById" | "isTenantDriver"
>;

export type AppointmentOperationsServiceLike = {
  markDeliveryDone(input: {
    tenantId: string;
    appointmentId: string;
    taskId: string;
    operatorUserId: string;
  }): Promise<void>;
  markDeliveryCancelled(input: {
    tenantId: string;
    appointmentId: string;
    taskId: string;
    operatorUserId: string;
  }): Promise<void>;
};

export type OwnerServiceOptions = {
  db?: Database;
  repository?: OwnerRepositoryLike;
  deliveryRepository?: OwnerDeliveryRepositoryLike;
  notificationPublisher?: NotificationPublisher;
};

function forbidden(): OwnerError {
  return new OwnerError(
    "OWNER_FORBIDDEN",
    "Owner mobile access is required.",
    403,
  );
}

function appointmentNotFound(): OwnerError {
  return new OwnerError(
    "OWNER_APPOINTMENT_NOT_FOUND",
    "Appointment was not found.",
    404,
  );
}

function appointmentConflict(
  message: string,
  currentStatus: OwnerAppointmentStatus,
): OwnerError {
  return new OwnerError("OWNER_APPOINTMENT_CONFLICT", message, 409, {
    currentStatus,
  });
}

function assertOwnerContext(authContext: MobileAuthContext): OwnerMobileContext {
  if (authContext.subjectType !== "staff" || authContext.role !== "owner") {
    throw forbidden();
  }

  return authContext as OwnerMobileContext;
}

function assertBranchAccess(authContext: OwnerMobileContext, branchId: string): void {
  if (authContext.branchIds.length > 0 && !authContext.branchIds.includes(branchId)) {
    throw forbidden();
  }
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

export class OwnerService implements AppointmentOperationsServiceLike {
  private readonly repository: OwnerRepositoryLike;
  private readonly deliveryRepository: OwnerDeliveryRepositoryLike;
  private readonly notificationPublisher?: NotificationPublisher;

  constructor(options: OwnerServiceOptions = {}) {
    this.notificationPublisher = options.notificationPublisher;

    if (options.repository && options.deliveryRepository) {
      this.repository = options.repository;
      this.deliveryRepository = options.deliveryRepository;
      return;
    }

    const db = options.db ?? getDb();

    this.repository = options.repository ?? new OwnerRepository(db);
    this.deliveryRepository =
      options.deliveryRepository ?? new DeliveryRepository(db);
  }

  async getTodaySummary(
    authContext: MobileAuthContext,
  ): Promise<OwnerTodaySummary> {
    const owner = assertOwnerContext(authContext);
    const { start, end } = getTodayBounds(owner.timezone ?? "UTC");
    const tenantBase = await this.repository.findTenantBase(owner.tenantId);

    if (!tenantBase) {
      throw new OwnerError(
        "OWNER_SUMMARY_NOT_FOUND",
        "Owner summary is not available for the current tenant.",
        404,
      );
    }

    const [
      todayOrderCount,
      todayRevenueAmount,
      pendingPickupCount,
      inProgressOrderCount,
      appointmentSummary,
      deliverySummary,
    ] = await Promise.all([
      this.repository.countTodayOrders({
        tenantId: owner.tenantId,
        start,
        end,
      }),
      this.repository.sumTodayRevenue({
        tenantId: owner.tenantId,
        start,
        end,
      }),
      this.repository.countPendingPickup(owner.tenantId),
      this.repository.countInProgressOrders(owner.tenantId),
      this.repository.getAppointmentSummary({
        tenantId: owner.tenantId,
        start,
        end,
      }),
      this.repository.getDeliverySummary({
        tenantId: owner.tenantId,
        start,
        end,
      }),
    ]);

    return {
      ...tenantBase,
      businessDate: start.toISOString(),
      todayOrderCount,
      todayRevenueAmount,
      pendingPickupCount,
      inProgressOrderCount,
      appointmentSummary,
      deliverySummary,
    };
  }

  async listBranches(
    authContext: MobileAuthContext,
  ): Promise<OwnerBranchOption[]> {
    const owner = assertOwnerContext(authContext);

    return this.repository.listBranches({
      tenantId: owner.tenantId,
      allowedBranchIds:
        owner.branchIds.length > 0 ? owner.branchIds : undefined,
    });
  }

  async listDrivers(input: {
    authContext: MobileAuthContext;
    branchId?: string;
  }): Promise<OwnerDriverOption[]> {
    const owner = assertOwnerContext(input.authContext);

    if (input.branchId) {
      assertBranchAccess(owner, input.branchId);
    }

    return this.repository.listDrivers({
      tenantId: owner.tenantId,
      branchId: input.branchId,
      allowedBranchIds:
        owner.branchIds.length > 0 ? owner.branchIds : undefined,
    });
  }

  async listAppointments(input: {
    authContext: MobileAuthContext;
    branchId?: string;
    status?: OwnerAppointmentStatus;
  }): Promise<OwnerAppointment[]> {
    const owner = assertOwnerContext(input.authContext);

    if (input.branchId) {
      assertBranchAccess(owner, input.branchId);
    }

    return this.repository.listAppointments({
      tenantId: owner.tenantId,
      branchId: input.branchId,
      status: input.status,
    });
  }

  async acceptAppointment(input: {
    authContext: MobileAuthContext;
    appointmentId: string;
    idempotencyKey: string;
    assigneeUserId?: string;
    notes?: string;
  }): Promise<OwnerAppointmentAcceptResult> {
    const owner = assertOwnerContext(input.authContext);
    const existing = await this.repository.findAppointmentById({
      tenantId: owner.tenantId,
      appointmentId: input.appointmentId,
    });

    if (!existing) {
      throw appointmentNotFound();
    }

    assertBranchAccess(owner, existing.branchId);

    if (input.assigneeUserId) {
      await this.assertTenantDriver(owner.tenantId, input.assigneeUserId);
    }

    if (existing.deliveryTaskId && existing.status === "accepted") {
      const task = await this.deliveryRepository.getTaskDetailById({
        tenantId: owner.tenantId,
        taskId: existing.deliveryTaskId,
      });

      if (!task) {
        throw appointmentConflict(
          "Linked delivery task was not found.",
          existing.status,
        );
      }

      return { appointment: existing, task, idempotent: true };
    }

    if (existing.status !== "pending") {
      throw appointmentConflict(
        "Only pending appointments can be accepted.",
        existing.status,
      );
    }

    const accepted = await this.repository.acceptAppointmentAndCreateTask({
      tenantId: owner.tenantId,
      appointmentId: input.appointmentId,
      operatorUserId: owner.subjectId,
      assigneeUserId: input.assigneeUserId,
      notes: input.notes,
    });

    if (!accepted) {
      throw appointmentConflict(
        "Appointment status changed while processing acceptance.",
        existing.status,
      );
    }

    const task = await this.deliveryRepository.getTaskDetailById({
      tenantId: owner.tenantId,
      taskId: accepted.taskId,
    });

    if (!task) {
      throw new OwnerError(
        "OWNER_VALIDATION_ERROR",
        "Accepted appointment delivery task could not be loaded.",
        422,
      );
    }

    await this.publishAppointmentAccepted({
      appointment: accepted.appointment,
      taskId: accepted.taskId,
    });

    return {
      appointment: accepted.appointment,
      task,
      idempotent: false,
    };
  }

  async rejectAppointment(input: {
    authContext: MobileAuthContext;
    appointmentId: string;
    reason: string;
  }): Promise<OwnerAppointment> {
    const owner = assertOwnerContext(input.authContext);
    const existing = await this.repository.findAppointmentById({
      tenantId: owner.tenantId,
      appointmentId: input.appointmentId,
    });

    if (!existing) {
      throw appointmentNotFound();
    }

    assertBranchAccess(owner, existing.branchId);

    if (existing.status !== "pending") {
      throw appointmentConflict(
        "Only pending appointments can be rejected.",
        existing.status,
      );
    }

    const rejected = await this.repository.rejectPendingAppointment({
      tenantId: owner.tenantId,
      appointmentId: input.appointmentId,
      operatorUserId: owner.subjectId,
      reason: input.reason,
    });

    if (!rejected) {
      throw appointmentConflict(
        "Appointment status changed while processing rejection.",
        existing.status,
      );
    }

    await this.publishAppointmentRejected(rejected);

    return rejected;
  }

  async markDeliveryDone(input: {
    tenantId: string;
    appointmentId: string;
    taskId: string;
    operatorUserId: string;
  }): Promise<void> {
    await this.repository.markAppointmentDoneFromDelivery(input);
  }

  async markDeliveryCancelled(input: {
    tenantId: string;
    appointmentId: string;
    taskId: string;
    operatorUserId: string;
  }): Promise<void> {
    await this.repository.reopenAppointmentFromCancelledDelivery(input);
  }

  private async assertTenantDriver(
    tenantId: string,
    userId: string,
  ): Promise<void> {
    if (!(await this.deliveryRepository.isTenantDriver({ tenantId, userId }))) {
      throw forbidden();
    }
  }

  private async publishAppointmentAccepted(input: {
    appointment: OwnerAppointment;
    taskId: string;
  }): Promise<void> {
    if (!this.notificationPublisher) {
      return;
    }

    try {
      await this.notificationPublisher.publish(
        appointmentAcceptedEvent({
          tenantId: input.appointment.tenantId,
          branchId: input.appointment.branchId,
          customerId: input.appointment.customerId,
          appointmentId: input.appointment.id,
          customerName: input.appointment.customerName,
          appointmentType: input.appointment.type,
          expectedAt: input.appointment.expectedAt,
          address: input.appointment.address,
          taskId: input.taskId,
        }),
      );
    } catch (error) {
      logger.error(
        {
          error,
          tenantId: input.appointment.tenantId,
          appointmentId: input.appointment.id,
        },
        "Appointment accepted notification event failed",
      );
    }
  }

  private async publishAppointmentRejected(
    appointment: OwnerAppointment,
  ): Promise<void> {
    if (!this.notificationPublisher) {
      return;
    }

    try {
      await this.notificationPublisher.publish(
        appointmentRejectedEvent({
          tenantId: appointment.tenantId,
          branchId: appointment.branchId,
          customerId: appointment.customerId,
          appointmentId: appointment.id,
          customerName: appointment.customerName,
          appointmentType: appointment.type,
          expectedAt: appointment.expectedAt,
          address: appointment.address,
          reason: appointment.cancellationReason,
        }),
      );
    } catch (error) {
      logger.error(
        {
          error,
          tenantId: appointment.tenantId,
          appointmentId: appointment.id,
        },
        "Appointment rejected notification event failed",
      );
    }
  }
}
