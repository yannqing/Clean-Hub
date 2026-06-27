import { OwnerService, type OwnerRepositoryLike } from "./owner.service.js";
import { OwnerError, type OwnerTodaySummary } from "./owner.types.js";
import type { MobileAuthContext } from "../auth/auth.types.js";

const ownerContext: MobileAuthContext = {
  subjectType: "staff",
  subjectId: "owner_1",
  displayName: "Owner One",
  tenantId: "tenant_1",
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

function createRepository(options?: {
  missingTenant?: boolean;
}): OwnerRepositoryLike {
  function assertTenant(tenantId: string): void {
    assert(tenantId === "tenant_1", "summary must be tenant scoped");
  }

  return {
    async findTenantBase(tenantId) {
      assertTenant(tenantId);

      if (options?.missingTenant) {
        return null;
      }

      return {
        tenantId,
        tenantName: "Demo Tenant",
        tenantStatus: "active",
        featureFlags: {
          laundryEnabled: true,
          carWashEnabled: false,
          retailProductsEnabled: false,
          deliveryEnabled: true,
          notificationsEnabled: true,
        },
      } satisfies Pick<
        OwnerTodaySummary,
        "tenantId" | "tenantName" | "tenantStatus" | "featureFlags"
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
  };
}

export async function runOwnerSmokeChecks(): Promise<void> {
  const service = new OwnerService({ repository: createRepository() });
  const summary = await service.getTodaySummary(ownerContext);

  assert(summary.tenantId === "tenant_1", "summary should use token tenant");
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

  await assertRejectsOwner(
    () => service.getTodaySummary(driverContext),
    403,
  );

  await assertRejectsOwner(
    () =>
      new OwnerService({
        repository: createRepository({ missingTenant: true }),
      }).getTodaySummary(ownerContext),
    404,
  );
}

if (process.argv[1]?.endsWith("owner.smoke.ts")) {
  await runOwnerSmokeChecks();
}
