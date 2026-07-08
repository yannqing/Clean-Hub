import type {
  MobileChangeCustomerPasswordRequest,
  MobileCustomerAddressInput,
  MobileCustomerContactInput,
  MobileCreateCustomerAppointmentRequest,
  MobileCreateRefundRequest,
  MobileUpdateCustomerProfileRequest,
} from "@cleanhub/api-client";

import { apiClient } from "@/lib/api-client";
import { createCustomerLocalId } from "../lib/id";

const PAYMENT_KEY_STORAGE_PREFIX = "cleanhub.mobile.payKey.";
const TERMINAL_PAYMENT_STATUSES = new Set(["paid", "failed"]);

type StoredPaymentKey = {
  amount: string;
  idempotencyKey: string;
};

function createPaymentKeyStorageKey(orderId: string): string {
  return `${PAYMENT_KEY_STORAGE_PREFIX}${orderId}`;
}

function readStoredPaymentKey(orderId: string, amount: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = window.sessionStorage.getItem(createPaymentKeyStorageKey(orderId));

    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as Partial<StoredPaymentKey>;

    return parsed.amount === amount && parsed.idempotencyKey
      ? parsed.idempotencyKey
      : null;
  } catch {
    return null;
  }
}

function writeStoredPaymentKey(orderId: string, amount: string, idempotencyKey: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const payload: StoredPaymentKey = { amount, idempotencyKey };
    window.sessionStorage.setItem(createPaymentKeyStorageKey(orderId), JSON.stringify(payload));
  } catch {
    // Storage can be disabled in private browsing or embedded webviews.
  }
}

function clearStoredPaymentKey(orderId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(createPaymentKeyStorageKey(orderId));
  } catch {
    // Storage can be disabled in private browsing or embedded webviews.
  }
}

function getPaymentIdempotencyKey(orderId: string, amount: string): string {
  const storedKey = readStoredPaymentKey(orderId, amount);

  if (storedKey) {
    return storedKey;
  }

  const idempotencyKey = `mobile-pay-${orderId}-${createCustomerLocalId()}`;
  writeStoredPaymentKey(orderId, amount, idempotencyKey);

  return idempotencyKey;
}

export async function createCustomerAppointment(input: MobileCreateCustomerAppointmentRequest) {
  return apiClient.mobile.customer.createAppointment({
    type: input.type,
    expectedAt: input.expectedAt,
    address: input.address.trim(),
    notes: input.notes?.trim() || undefined,
    branchId: input.branchId,
    customerId: input.customerId,
  });
}

export async function cancelCustomerAppointment(appointmentId: string) {
  return apiClient.mobile.customer.cancelAppointment(appointmentId);
}

export async function updateCustomerProfile(input: MobileUpdateCustomerProfileRequest) {
  return apiClient.mobile.customer.updateProfile({
    accountName: input.accountName?.trim() || undefined,
    phone: input.phone?.trim() || null,
    email: input.email?.trim().toLowerCase() || null,
  });
}

function cleanContactInput(input: MobileCustomerContactInput): MobileCustomerContactInput {
  return {
    fullName: input.fullName.trim(),
    phone: input.phone?.trim() || null,
    email: input.email?.trim().toLowerCase() || null,
    relationship: input.relationship?.trim() || null,
    address: input.address?.trim() || null,
  };
}

export async function createCustomerContact(input: MobileCustomerContactInput) {
  return apiClient.mobile.customer.createContact(cleanContactInput(input));
}

export async function updateCustomerContact(
  customerId: string,
  input: MobileCustomerContactInput,
) {
  return apiClient.mobile.customer.updateContact(customerId, cleanContactInput(input));
}

export async function deleteCustomerContact(customerId: string) {
  return apiClient.mobile.customer.deleteContact(customerId);
}

function cleanAddressInput(input: MobileCustomerAddressInput): MobileCustomerAddressInput {
  return {
    customerId: input.customerId || null,
    label: input.label.trim(),
    contactName: input.contactName?.trim() || null,
    contactPhone: input.contactPhone?.trim() || null,
    addressLine1: input.addressLine1.trim(),
    addressLine2: input.addressLine2?.trim() || null,
    city: input.city?.trim() || null,
    province: input.province?.trim() || null,
    postalCode: input.postalCode?.trim() || null,
    country: (input.country?.trim().toUpperCase() || "TH").slice(0, 2),
    latitude: input.latitude?.trim() || null,
    longitude: input.longitude?.trim() || null,
    isDefault: input.isDefault,
    notes: input.notes?.trim() || null,
  };
}

export async function createCustomerAddress(input: MobileCustomerAddressInput) {
  return apiClient.mobile.customer.createAddress(cleanAddressInput(input));
}

export async function updateCustomerAddress(
  addressId: string,
  input: MobileCustomerAddressInput,
) {
  return apiClient.mobile.customer.updateAddress(addressId, cleanAddressInput(input));
}

export async function deleteCustomerAddress(addressId: string) {
  return apiClient.mobile.customer.deleteAddress(addressId);
}

export async function setDefaultCustomerAddress(addressId: string) {
  return apiClient.mobile.customer.setDefaultAddress(addressId);
}

export async function changeCustomerPassword(input: MobileChangeCustomerPasswordRequest) {
  return apiClient.mobile.customer.changePassword(input);
}

export async function createCustomerPayment(input: {
  orderId: string;
  amount: string;
}) {
  const result = await apiClient.mobile.payment.createPayment(input.orderId, {
    amount: input.amount,
    idempotencyKey: getPaymentIdempotencyKey(input.orderId, input.amount),
  });

  if (TERMINAL_PAYMENT_STATUSES.has(result.transaction.paymentStatus)) {
    clearStoredPaymentKey(input.orderId);
  }

  return result;
}

export async function createCustomerRefundRequest(
  orderId: string,
  input: MobileCreateRefundRequest,
) {
  return apiClient.mobile.payment.createRefundRequest(orderId, {
    amount: input.amount,
    reason: input.reason.trim(),
  });
}
