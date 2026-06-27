import { getDb, type Database } from "@cleanhub/db";

import type { MobileAuthContext } from "../auth/auth.types.js";
import { OwnerRepository } from "./owner.repository.js";
import type { OwnerMobileContext, OwnerTodaySummary } from "./owner.types.js";
import { OwnerError } from "./owner.types.js";

export type OwnerServiceOptions = {
  db?: Database;
  repository?: OwnerRepositoryLike;
};

export type OwnerRepositoryLike = {
  findTenantBase(tenantId: string): Promise<Pick<
    OwnerTodaySummary,
    "tenantId" | "tenantName" | "tenantStatus" | "featureFlags"
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
};

function forbidden(): OwnerError {
  return new OwnerError(
    "OWNER_FORBIDDEN",
    "Owner mobile access is required.",
    403,
  );
}

function assertOwnerContext(authContext: MobileAuthContext): OwnerMobileContext {
  if (authContext.subjectType !== "staff" || authContext.role !== "owner") {
    throw forbidden();
  }

  return authContext as OwnerMobileContext;
}

function getTodayBounds(now = new Date()): { start: Date; end: Date } {
  const start = new Date(now);

  start.setHours(0, 0, 0, 0);

  const end = new Date(start);

  end.setDate(end.getDate() + 1);

  return { start, end };
}

export class OwnerService {
  private readonly repository: OwnerRepositoryLike;

  constructor(options: OwnerServiceOptions = {}) {
    this.repository =
      options.repository ?? new OwnerRepository(options.db ?? getDb());
  }

  async getTodaySummary(
    authContext: MobileAuthContext,
  ): Promise<OwnerTodaySummary> {
    const owner = assertOwnerContext(authContext);
    const { start, end } = getTodayBounds();
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
}
