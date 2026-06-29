import { getDb, type Database } from "@cleanhub/db";

import { validatePasswordAgainstPolicy } from "../../auth/password-policy.helper.js";
import { hashPassword, verifyPassword } from "../../auth/password.service.js";
import { resolveEffectiveSecurityPolicy } from "../../saas/security/security-policy.js";
import type { MobileAuthContext } from "../auth/auth.types.js";
import { CustomerRepository } from "./customer.repository.js";
import type {
  CreateCustomerAppointmentInput,
  CustomerActivityList,
  CustomerAddress,
  CustomerAddressWriteInput,
  CustomerAppointment,
  CustomerChangePasswordInput,
  CustomerContact,
  CustomerContactWriteInput,
  CustomerMobileContext,
  CustomerOrderDetail,
  CustomerProfile,
  CustomerProfileUpdateInput,
  CustomerTicketDetail,
} from "./customer.types.js";
import { CustomerError } from "./customer.types.js";

export type CustomerServiceOptions = {
  db?: Database;
  repository?: CustomerRepositoryLike;
};

export type CustomerRepositoryLike = {
  getProfile(input: {
    tenantId: string;
    customerAccountId: string;
  }): Promise<CustomerProfile | null>;
  updateProfile(input: {
    tenantId: string;
    customerAccountId: string;
    accountName?: string;
    phone?: string | null;
    email?: string | null;
  }): Promise<CustomerProfile | null>;
  createContact(input: {
    tenantId: string;
    customerAccountId: string;
    data: CustomerContactWriteInput;
  }): Promise<CustomerContact>;
  updateContact(input: {
    tenantId: string;
    customerAccountId: string;
    customerId: string;
    data: CustomerContactWriteInput;
  }): Promise<CustomerContact | null>;
  softDeleteContact(input: {
    tenantId: string;
    customerAccountId: string;
    customerId: string;
  }): Promise<CustomerContact | null>;
  listAddresses(input: {
    tenantId: string;
    customerAccountId: string;
  }): Promise<CustomerAddress[]>;
  findOwnedAddressById(input: {
    tenantId: string;
    customerAccountId: string;
    addressId: string;
  }): Promise<CustomerAddress | null>;
  createAddress(input: {
    tenantId: string;
    customerAccountId: string;
    data: CustomerAddressWriteInput;
  }): Promise<CustomerAddress>;
  updateAddress(input: {
    tenantId: string;
    customerAccountId: string;
    addressId: string;
    data: CustomerAddressWriteInput;
  }): Promise<CustomerAddress | null>;
  softDeleteAddress(input: {
    tenantId: string;
    customerAccountId: string;
    addressId: string;
  }): Promise<CustomerAddress | null>;
  setDefaultAddress(input: {
    tenantId: string;
    customerAccountId: string;
    addressId: string;
  }): Promise<CustomerAddress | null>;
  findCustomerCredential(input: {
    tenantId: string;
    customerAccountId: string;
  }): Promise<{ id: string; passwordHash: string } | null>;
  updateCustomerPassword(input: {
    tenantId: string;
    customerAccountId: string;
    credentialId: string;
    passwordHash: string;
  }): Promise<void>;
  revokeCustomerRefreshTokens(input: {
    tenantId: string;
    customerAccountId: string;
  }): Promise<void>;
  findOwnedCustomerById(input: {
    tenantId: string;
    customerAccountId: string;
    customerId: string;
  }): Promise<{ id: string } | null>;
  findDefaultCustomer(input: {
    tenantId: string;
    customerAccountId: string;
  }): Promise<{ id: string } | null>;
  findBranchInTenant(input: {
    tenantId: string;
    branchId: string;
  }): Promise<{ id: string } | null>;
  findDefaultBranch(input: { tenantId: string }): Promise<{ id: string } | null>;
  listOrders(input: {
    tenantId: string;
    customerAccountId: string;
  }): Promise<CustomerActivityList["orders"]>;
  getOrderDetail(input: {
    tenantId: string;
    customerAccountId: string;
    orderId: string;
  }): Promise<CustomerOrderDetail | null>;
  listTickets(input: {
    tenantId: string;
    customerAccountId: string;
  }): Promise<CustomerActivityList["tickets"]>;
  getTicketDetail(input: {
    tenantId: string;
    customerAccountId: string;
    ticketId: string;
  }): Promise<CustomerTicketDetail | null>;
  createAppointment(input: {
    tenantId: string;
    branchId: string;
    customerId: string;
    type: "pickup" | "dropoff";
    expectedAt: Date;
    address: string;
    notes?: string;
  }): Promise<CustomerAppointment>;
  listAppointments(input: {
    tenantId: string;
    customerAccountId: string;
  }): Promise<CustomerAppointment[]>;
  findOwnedAppointmentById(input: {
    tenantId: string;
    customerAccountId: string;
    appointmentId: string;
  }): Promise<CustomerAppointment | null>;
  cancelPendingAppointment(input: {
    tenantId: string;
    appointmentId: string;
  }): Promise<CustomerAppointment | null>;
};

function forbidden(): CustomerError {
  return new CustomerError(
    "CUSTOMER_FORBIDDEN",
    "Customer access is required.",
    403,
  );
}

function profileNotFound(): CustomerError {
  return new CustomerError(
    "CUSTOMER_PROFILE_NOT_FOUND",
    "Customer profile was not found.",
    404,
  );
}

function addressNotFound(): CustomerError {
  return new CustomerError(
    "CUSTOMER_ADDRESS_NOT_FOUND",
    "Customer address was not found.",
    404,
  );
}

function contactNotFound(): CustomerError {
  return new CustomerError(
    "CUSTOMER_CONTACT_NOT_FOUND",
    "Customer contact was not found.",
    404,
  );
}

function validationError(message: string): CustomerError {
  return new CustomerError("CUSTOMER_VALIDATION_ERROR", message, 422);
}

function assertCustomerContext(
  authContext: MobileAuthContext,
): CustomerMobileContext {
  if (authContext.subjectType !== "customer" || authContext.role !== "customer") {
    throw forbidden();
  }

  return authContext as CustomerMobileContext;
}

export class CustomerService {
  private readonly db?: Database;
  private readonly repository: CustomerRepositoryLike;

  constructor(options: CustomerServiceOptions = {}) {
    this.db = options.db;
    this.repository =
      options.repository ?? new CustomerRepository(options.db ?? getDb());
  }

  async getProfile(authContext: MobileAuthContext): Promise<CustomerProfile> {
    const customer = assertCustomerContext(authContext);
    const profile = await this.repository.getProfile({
      tenantId: customer.tenantId,
      customerAccountId: customer.subjectId,
    });

    if (!profile) {
      throw profileNotFound();
    }

    return profile;
  }

  async updateProfile(
    authContext: MobileAuthContext,
    input: CustomerProfileUpdateInput,
  ): Promise<CustomerProfile> {
    const customer = assertCustomerContext(authContext);
    const profile = await this.repository.updateProfile({
      tenantId: customer.tenantId,
      customerAccountId: customer.subjectId,
      accountName: input.accountName,
      phone: input.phone,
      email: input.email,
    });

    if (!profile) {
      throw profileNotFound();
    }

    return profile;
  }

  async createContact(
    authContext: MobileAuthContext,
    input: CustomerContactWriteInput,
  ): Promise<CustomerContact> {
    const customer = assertCustomerContext(authContext);

    return this.repository.createContact({
      tenantId: customer.tenantId,
      customerAccountId: customer.subjectId,
      data: input,
    });
  }

  async updateContact(
    authContext: MobileAuthContext,
    customerId: string,
    input: CustomerContactWriteInput,
  ): Promise<CustomerContact> {
    const customer = assertCustomerContext(authContext);
    const updated = await this.repository.updateContact({
      tenantId: customer.tenantId,
      customerAccountId: customer.subjectId,
      customerId,
      data: input,
    });

    if (!updated) {
      throw contactNotFound();
    }

    return updated;
  }

  async deleteContact(
    authContext: MobileAuthContext,
    customerId: string,
  ): Promise<CustomerContact> {
    const customer = assertCustomerContext(authContext);
    const deleted = await this.repository.softDeleteContact({
      tenantId: customer.tenantId,
      customerAccountId: customer.subjectId,
      customerId,
    });

    if (!deleted) {
      throw contactNotFound();
    }

    return deleted;
  }

  async listAddresses(
    authContext: MobileAuthContext,
  ): Promise<CustomerAddress[]> {
    const customer = assertCustomerContext(authContext);

    return this.repository.listAddresses({
      tenantId: customer.tenantId,
      customerAccountId: customer.subjectId,
    });
  }

  async createAddress(
    authContext: MobileAuthContext,
    input: CustomerAddressWriteInput,
  ): Promise<CustomerAddress> {
    const customer = assertCustomerContext(authContext);
    const data = await this.normalizeAddressInput(customer, input);

    return this.repository.createAddress({
      tenantId: customer.tenantId,
      customerAccountId: customer.subjectId,
      data,
    });
  }

  async updateAddress(
    authContext: MobileAuthContext,
    addressId: string,
    input: CustomerAddressWriteInput,
  ): Promise<CustomerAddress> {
    const customer = assertCustomerContext(authContext);
    const existing = await this.repository.findOwnedAddressById({
      tenantId: customer.tenantId,
      customerAccountId: customer.subjectId,
      addressId,
    });

    if (!existing) {
      throw addressNotFound();
    }

    const data = await this.normalizeAddressInput(customer, input);
    const updated = await this.repository.updateAddress({
      tenantId: customer.tenantId,
      customerAccountId: customer.subjectId,
      addressId,
      data,
    });

    if (!updated) {
      throw addressNotFound();
    }

    return updated;
  }

  async deleteAddress(
    authContext: MobileAuthContext,
    addressId: string,
  ): Promise<CustomerAddress> {
    const customer = assertCustomerContext(authContext);
    const deleted = await this.repository.softDeleteAddress({
      tenantId: customer.tenantId,
      customerAccountId: customer.subjectId,
      addressId,
    });

    if (!deleted) {
      throw addressNotFound();
    }

    return deleted;
  }

  async setDefaultAddress(
    authContext: MobileAuthContext,
    addressId: string,
  ): Promise<CustomerAddress> {
    const customer = assertCustomerContext(authContext);
    const address = await this.repository.setDefaultAddress({
      tenantId: customer.tenantId,
      customerAccountId: customer.subjectId,
      addressId,
    });

    if (!address) {
      throw addressNotFound();
    }

    return address;
  }

  async changePassword(
    authContext: MobileAuthContext,
    input: CustomerChangePasswordInput,
  ): Promise<{ passwordChanged: true }> {
    const customer = assertCustomerContext(authContext);
    const credential = await this.repository.findCustomerCredential({
      tenantId: customer.tenantId,
      customerAccountId: customer.subjectId,
    });

    if (!credential) {
      throw profileNotFound();
    }

    const passwordValid = await verifyPassword(
      input.currentPassword,
      credential.passwordHash,
    );

    if (!passwordValid) {
      throw validationError("Current password is incorrect.");
    }

    const policy = await resolveEffectiveSecurityPolicy(this.db ?? getDb());
    const policyError = validatePasswordAgainstPolicy(input.newPassword, policy);

    if (policyError) {
      throw validationError(policyError);
    }

    const passwordHash = await hashPassword(input.newPassword);
    await this.repository.updateCustomerPassword({
      tenantId: customer.tenantId,
      customerAccountId: customer.subjectId,
      credentialId: credential.id,
      passwordHash,
    });
    await this.repository.revokeCustomerRefreshTokens({
      tenantId: customer.tenantId,
      customerAccountId: customer.subjectId,
    });

    return { passwordChanged: true };
  }

  async listOrdersAndTickets(
    authContext: MobileAuthContext,
  ): Promise<CustomerActivityList> {
    const customer = assertCustomerContext(authContext);
    const [orders, tickets] = await Promise.all([
      this.repository.listOrders({
        tenantId: customer.tenantId,
        customerAccountId: customer.subjectId,
      }),
      this.repository.listTickets({
        tenantId: customer.tenantId,
        customerAccountId: customer.subjectId,
      }),
    ]);

    return { orders, tickets };
  }

  async getOrderDetail(
    authContext: MobileAuthContext,
    orderId: string,
  ): Promise<CustomerOrderDetail> {
    const customer = assertCustomerContext(authContext);
    const order = await this.repository.getOrderDetail({
      tenantId: customer.tenantId,
      customerAccountId: customer.subjectId,
      orderId,
    });

    if (!order) {
      throw new CustomerError(
        "CUSTOMER_ORDER_NOT_FOUND",
        "Order was not found.",
        404,
      );
    }

    return order;
  }

  async getTicketDetail(
    authContext: MobileAuthContext,
    ticketId: string,
  ): Promise<CustomerTicketDetail> {
    const customer = assertCustomerContext(authContext);
    const ticket = await this.repository.getTicketDetail({
      tenantId: customer.tenantId,
      customerAccountId: customer.subjectId,
      ticketId,
    });

    if (!ticket) {
      throw new CustomerError(
        "CUSTOMER_TICKET_NOT_FOUND",
        "Service ticket was not found.",
        404,
      );
    }

    return ticket;
  }

  async createAppointment(
    input: CreateCustomerAppointmentInput,
  ): Promise<CustomerAppointment> {
    const customer = assertCustomerContext(input.authContext);
    const customerId = await this.resolveCustomerId({
      tenantId: customer.tenantId,
      customerAccountId: customer.subjectId,
      customerId: input.customerId,
    });
    const branchId = await this.resolveBranchId({
      tenantId: customer.tenantId,
      branchId: input.branchId,
    });

    return this.repository.createAppointment({
      tenantId: customer.tenantId,
      branchId,
      customerId,
      type: input.type,
      expectedAt: input.expectedAt,
      address: input.address,
      notes: input.notes,
    });
  }

  async listAppointments(
    authContext: MobileAuthContext,
  ): Promise<CustomerAppointment[]> {
    const customer = assertCustomerContext(authContext);

    return this.repository.listAppointments({
      tenantId: customer.tenantId,
      customerAccountId: customer.subjectId,
    });
  }

  async cancelAppointment(
    authContext: MobileAuthContext,
    appointmentId: string,
  ): Promise<CustomerAppointment> {
    const customer = assertCustomerContext(authContext);
    const existing = await this.repository.findOwnedAppointmentById({
      tenantId: customer.tenantId,
      customerAccountId: customer.subjectId,
      appointmentId,
    });

    if (!existing) {
      throw new CustomerError(
        "CUSTOMER_APPOINTMENT_NOT_FOUND",
        "Appointment was not found.",
        404,
      );
    }

    if (existing.status !== "pending") {
      throw new CustomerError(
        "CUSTOMER_APPOINTMENT_CONFLICT",
        "Only pending appointments can be cancelled.",
        409,
        { currentStatus: existing.status },
      );
    }

    const cancelled = await this.repository.cancelPendingAppointment({
      tenantId: customer.tenantId,
      appointmentId,
    });

    if (!cancelled) {
      throw new CustomerError(
        "CUSTOMER_APPOINTMENT_CONFLICT",
        "Appointment status changed while processing the cancellation.",
        409,
        { currentStatus: existing.status },
      );
    }

    return cancelled;
  }

  private async resolveCustomerId({
    tenantId,
    customerAccountId,
    customerId,
  }: {
    tenantId: string;
    customerAccountId: string;
    customerId?: string;
  }): Promise<string> {
    if (customerId) {
      const ownedCustomer = await this.repository.findOwnedCustomerById({
        tenantId,
        customerAccountId,
        customerId,
      });

      if (!ownedCustomer) {
        throw profileNotFound();
      }

      return ownedCustomer.id;
    }

    const defaultCustomer = await this.repository.findDefaultCustomer({
      tenantId,
      customerAccountId,
    });

    if (!defaultCustomer) {
      throw validationError(
        "A customer profile is required before creating an appointment.",
      );
    }

    return defaultCustomer.id;
  }

  private async normalizeAddressInput(
    customer: CustomerMobileContext,
    input: CustomerAddressWriteInput,
  ): Promise<CustomerAddressWriteInput> {
    const customerId = input.customerId
      ? await this.resolveCustomerId({
          tenantId: customer.tenantId,
          customerAccountId: customer.subjectId,
          customerId: input.customerId,
        })
      : null;

    if (input.latitude) {
      const latitude = Number(input.latitude);

      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
        throw validationError("Latitude must be between -90 and 90.");
      }
    }

    if (input.longitude) {
      const longitude = Number(input.longitude);

      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        throw validationError("Longitude must be between -180 and 180.");
      }
    }

    return {
      ...input,
      customerId,
      country: input.country ?? "TH",
    };
  }

  private async resolveBranchId({
    tenantId,
    branchId,
  }: {
    tenantId: string;
    branchId?: string;
  }): Promise<string> {
    if (branchId) {
      const branch = await this.repository.findBranchInTenant({
        tenantId,
        branchId,
      });

      if (!branch) {
        throw validationError("Branch does not exist in this tenant.");
      }

      return branch.id;
    }

    const defaultBranch = await this.repository.findDefaultBranch({ tenantId });

    if (!defaultBranch) {
      throw validationError(
        "An active branch is required before creating an appointment.",
      );
    }

    return defaultBranch.id;
  }
}
