import { CustomerService, type CustomerRepositoryLike } from "./customer.service.js";
import { CustomerError } from "./customer.types.js";
import type {
  CustomerAddress,
  CustomerAppointment,
  CustomerBranchOption,
  CustomerProfile,
} from "./customer.types.js";
import type { MobileAuthContext } from "../auth/auth.types.js";

const customerContext: MobileAuthContext = {
  subjectType: "customer",
  subjectId: "account_1",
  displayName: "Customer One",
  tenantId: "tenant_1",
  currency: "XOF",
  branchIds: [],
  role: "customer",
  roles: ["customer"],
  permissions: [],
  accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
};

const driverContext: MobileAuthContext = {
  ...customerContext,
  subjectType: "staff",
  subjectId: "driver_1",
  role: "driver",
  roles: ["driver"],
};

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertRejectsCustomer(
  action: () => Promise<unknown>,
  status: number,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    if (!(error instanceof CustomerError)) {
      throw new Error("expected a CustomerError");
    }

    assert(error.status === status, `expected status ${status}`);
    return;
  }

  throw new Error(`expected action to reject with ${status}`);
}

function makeProfile(): CustomerProfile {
  return {
    account: {
      id: "account_1",
      tenantId: "tenant_1",
      accountName: "Customer One",
      phone: "+100000000",
      email: "customer@example.com",
      status: "active",
    },
    addresses: [
      {
        customerId: "customer_1",
        fullName: "Customer One",
        phone: "+100000000",
        email: "customer@example.com",
        relationship: null,
        address: "1 Main St",
        status: "active",
      },
    ],
  };
}

function makeAppointment(
  status: CustomerAppointment["status"],
): CustomerAppointment {
  const now = new Date().toISOString();

  return {
    id: "appointment_1",
    tenantId: "tenant_1",
    branchId: "branch_1",
    customerId: "customer_1",
    type: "pickup",
    status,
    expectedAt: now,
    address: "1 Main St",
    notes: null,
    acceptedAt: status === "accepted" ? now : null,
    cancelledAt: status === "cancelled" ? now : null,
    doneAt: status === "done" ? now : null,
    createdAt: now,
    updatedAt: now,
  };
}

function makeAddress(overrides: Partial<CustomerAddress> = {}): CustomerAddress {
  const now = new Date().toISOString();

  return {
    id: "address_1",
    tenantId: "tenant_1",
    customerAccountId: "account_1",
    customerId: "customer_1",
    label: "Home",
    contactName: "Customer One",
    contactPhone: "+100000000",
    addressLine1: "1 Main St",
    addressLine2: null,
    city: "Bangkok",
    province: null,
    postalCode: null,
    country: "TH",
    latitude: null,
    longitude: null,
    isDefault: true,
    notes: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeBranchOption(): CustomerBranchOption {
  return {
    id: "branch_1",
    name: "Main Branch",
    address: "1 Main St",
    status: "active",
  };
}

function createRepository(options?: {
  appointmentStatus?: CustomerAppointment["status"];
  denyCustomer?: boolean;
}): CustomerRepositoryLike {
  const appointmentStatus = options?.appointmentStatus ?? "pending";

  return {
    async getProfile({ tenantId, customerAccountId }) {
      assert(tenantId === "tenant_1", "profile must be tenant scoped");
      assert(
        customerAccountId === "account_1",
        "profile must be account scoped",
      );
      return makeProfile();
    },
    async updateProfile({ tenantId, customerAccountId, accountName }) {
      assert(tenantId === "tenant_1", "profile update must be tenant scoped");
      assert(
        customerAccountId === "account_1",
        "profile update must be account scoped",
      );

      return {
        ...makeProfile(),
        account: {
          ...makeProfile().account,
          accountName: accountName ?? makeProfile().account.accountName,
        },
      };
    },
    async createContact({ tenantId, customerAccountId, data }) {
      assert(tenantId === "tenant_1", "contact create must be tenant scoped");
      assert(
        customerAccountId === "account_1",
        "contact create must be account scoped",
      );

      return {
        customerId: "customer_2",
        fullName: data.fullName,
        phone: data.phone ?? null,
        email: data.email ?? null,
        relationship: data.relationship ?? null,
        address: data.address ?? null,
        status: "active",
      };
    },
    async updateContact({ tenantId, customerAccountId, customerId, data }) {
      assert(tenantId === "tenant_1", "contact update must be tenant scoped");
      assert(
        customerAccountId === "account_1",
        "contact update must be account scoped",
      );

      return customerId === "customer_1"
        ? {
            customerId,
            fullName: data.fullName,
            phone: data.phone ?? null,
            email: data.email ?? null,
            relationship: data.relationship ?? null,
            address: data.address ?? null,
            status: "active",
          }
        : null;
    },
    async softDeleteContact({ tenantId, customerAccountId, customerId }) {
      assert(tenantId === "tenant_1", "contact delete must be tenant scoped");
      assert(
        customerAccountId === "account_1",
        "contact delete must be account scoped",
      );

      return customerId === "customer_1"
        ? {
            customerId,
            fullName: "Customer One",
            phone: "+100000000",
            email: "customer@example.com",
            relationship: null,
            address: "1 Main St",
            status: "active",
          }
        : null;
    },
    async listAddresses({ tenantId, customerAccountId }) {
      assert(tenantId === "tenant_1", "addresses must be tenant scoped");
      assert(
        customerAccountId === "account_1",
        "addresses must be account scoped",
      );
      return [makeAddress()];
    },
    async listBranches({ tenantId }) {
      assert(tenantId === "tenant_1", "branches must be tenant scoped");
      return [makeBranchOption()];
    },
    async findOwnedAddressById({ tenantId, customerAccountId, addressId }) {
      assert(tenantId === "tenant_1", "address lookup must be tenant scoped");
      assert(
        customerAccountId === "account_1",
        "address lookup must be account scoped",
      );
      return addressId === "address_1" ? makeAddress() : null;
    },
    async createAddress({ tenantId, customerAccountId, data }) {
      assert(tenantId === "tenant_1", "address create must be tenant scoped");
      assert(
        customerAccountId === "account_1",
        "address create must be account scoped",
      );
      return makeAddress({
        label: data.label,
        addressLine1: data.addressLine1,
        isDefault: data.isDefault ?? false,
      });
    },
    async updateAddress({ tenantId, customerAccountId, addressId, data }) {
      assert(tenantId === "tenant_1", "address update must be tenant scoped");
      assert(
        customerAccountId === "account_1",
        "address update must be account scoped",
      );
      return addressId === "address_1"
        ? makeAddress({
            label: data.label,
            addressLine1: data.addressLine1,
            isDefault: data.isDefault ?? false,
          })
        : null;
    },
    async softDeleteAddress({ tenantId, customerAccountId, addressId }) {
      assert(tenantId === "tenant_1", "address delete must be tenant scoped");
      assert(
        customerAccountId === "account_1",
        "address delete must be account scoped",
      );
      return addressId === "address_1"
        ? makeAddress({ id: addressId, isDefault: false })
        : null;
    },
    async setDefaultAddress({ tenantId, customerAccountId, addressId }) {
      assert(tenantId === "tenant_1", "address default must be tenant scoped");
      assert(
        customerAccountId === "account_1",
        "address default must be account scoped",
      );
      return addressId === "address_1"
        ? makeAddress({ id: addressId, isDefault: true })
        : null;
    },
    async findCustomerCredential() {
      return null;
    },
    async updateCustomerPassword() {
      return undefined;
    },
    async revokeCustomerRefreshTokens() {
      return undefined;
    },
    async findOwnedCustomerById({ tenantId, customerAccountId, customerId }) {
      assert(tenantId === "tenant_1", "customer lookup must be tenant scoped");
      assert(
        customerAccountId === "account_1",
        "customer lookup must be account scoped",
      );

      if (options?.denyCustomer || customerId !== "customer_1") {
        return null;
      }

      return { id: customerId };
    },
    async findDefaultCustomer({ tenantId, customerAccountId }) {
      assert(tenantId === "tenant_1", "default customer must be tenant scoped");
      assert(
        customerAccountId === "account_1",
        "default customer must be account scoped",
      );
      return { id: "customer_1" };
    },
    async findBranchInTenant({ tenantId, branchId }) {
      assert(tenantId === "tenant_1", "branch must be tenant scoped");
      return branchId === "branch_1" ? { id: branchId } : null;
    },
    async findDefaultBranch({ tenantId }) {
      assert(tenantId === "tenant_1", "default branch must be tenant scoped");
      return { id: "branch_1" };
    },
    async listOrders({ tenantId, customerAccountId }) {
      assert(tenantId === "tenant_1", "orders must be tenant scoped");
      assert(customerAccountId === "account_1", "orders must be account scoped");
      return [];
    },
    async getOrderDetail({ tenantId, customerAccountId, orderId }) {
      assert(tenantId === "tenant_1", "order detail must be tenant scoped");
      assert(
        customerAccountId === "account_1",
        "order detail must be account scoped",
      );
      return orderId === "order_1"
        ? {
            id: "order_1",
            branchId: "branch_1",
            customerId: "customer_1",
            status: "received",
            paymentStatus: "unpaid",
            totalAmount: "10.00",
            paidAmount: "0.00",
            expireAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            orderType: "ticket",
            notes: null,
            items: [],
          }
        : null;
    },
    async listTickets({ tenantId, customerAccountId }) {
      assert(tenantId === "tenant_1", "tickets must be tenant scoped");
      assert(
        customerAccountId === "account_1",
        "tickets must be account scoped",
      );
      return [];
    },
    async getTicketDetail() {
      return null;
    },
    async createAppointment(input) {
      assert(input.tenantId === "tenant_1", "appointment must use token tenant");
      assert(
        input.customerId === "customer_1",
        "appointment must use owned customer",
      );
      assert(input.branchId === "branch_1", "appointment must use tenant branch");
      return makeAppointment("pending");
    },
    async listAppointments({ tenantId, customerAccountId }) {
      assert(tenantId === "tenant_1", "appointments must be tenant scoped");
      assert(
        customerAccountId === "account_1",
        "appointments must be account scoped",
      );
      return [makeAppointment(appointmentStatus)];
    },
    async findOwnedAppointmentById({ tenantId, customerAccountId }) {
      assert(tenantId === "tenant_1", "appointment lookup must be tenant scoped");
      assert(
        customerAccountId === "account_1",
        "appointment lookup must be account scoped",
      );
      return makeAppointment(appointmentStatus);
    },
    async cancelPendingAppointment() {
      return appointmentStatus === "pending" ? makeAppointment("cancelled") : null;
    },
  };
}

export async function runCustomerSmokeChecks(): Promise<void> {
  const service = new CustomerService({ repository: createRepository() });
  const profile = await service.getProfile(customerContext);

  assert(profile.account.id === "account_1", "profile should return account");

  const branchOptions = await service.listBranches(customerContext);

  assert(branchOptions[0]?.id === "branch_1", "branches should be tenant scoped");

  const contact = await service.updateContact(customerContext, "customer_1", {
    fullName: "Customer One Updated",
    phone: "+100000001",
    email: "updated@example.com",
    relationship: "Primary",
    address: "2 Main St",
  });

  assert(contact.fullName === "Customer One Updated", "contact should update");

  const deletedContact = await service.deleteContact(customerContext, "customer_1");

  assert(deletedContact.customerId === "customer_1", "contact should delete");

  const order = await service.getOrderDetail(customerContext, "order_1");

  assert(order.id === "order_1", "owned order should be returned");

  const appointment = await service.createAppointment({
    authContext: customerContext,
    type: "pickup",
    expectedAt: new Date(Date.now() + 60 * 60 * 1000),
    address: "1 Main St",
  });

  assert(
    appointment.status === "pending",
    "created appointment should be pending",
  );

  const cancelled = await service.cancelAppointment(
    customerContext,
    "appointment_1",
  );

  assert(
    cancelled.status === "cancelled",
    "pending appointment should cancel",
  );

  await assertRejectsCustomer(
    () => service.getProfile(driverContext),
    403,
  );

  await assertRejectsCustomer(
    () =>
      new CustomerService({
        repository: createRepository({ denyCustomer: true }),
      }).createAppointment({
        authContext: customerContext,
        type: "pickup",
        customerId: "customer_2",
        expectedAt: new Date(Date.now() + 60 * 60 * 1000),
        address: "1 Main St",
      }),
    404,
  );

  await assertRejectsCustomer(
    () =>
      service.createAppointment({
        authContext: customerContext,
        type: "pickup",
        expectedAt: new Date(Date.now() + 5 * 60 * 1000),
        address: "1 Main St",
      }),
    400,
  );

  await assertRejectsCustomer(
    () =>
      new CustomerService({
        repository: createRepository({ appointmentStatus: "accepted" }),
      }).cancelAppointment(customerContext, "appointment_1"),
    409,
  );
}

if (process.argv[1]?.endsWith("customer.smoke.ts")) {
  await runCustomerSmokeChecks();
}
