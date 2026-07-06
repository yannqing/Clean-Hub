import type {
  MobileCustomerActivityList,
  MobileCustomerAddress,
  MobileCustomerAddressInput,
  MobileCustomerAppointment,
  MobileCustomerAppointmentStatus,
  MobileCustomerAppointmentType,
  MobileCustomerContact,
  MobileCustomerOrderDetail,
  MobileCustomerOrderListItem,
  MobileCustomerOrderStatus,
  MobileCustomerProfile,
  MobileCustomerTicketDetail,
  MobileCustomerTicketListItem,
  MobileCustomerTicketStatus,
  MobileRefundRequest,
} from "@cleanhub/api-client";
import type { TranslationKey } from "@cleanhub/i18n";
import type { useTranslation } from "@cleanhub/i18n/react";

import { normalizeCountryCode } from "./country";

export type ActivityKind = "order" | "ticket";

export type ActivityStatusFilter = "all" | "active" | "done" | "cancelled";

export type ActivityListItem =
  | {
      kind: "order";
      id: string;
      title: string;
      subtitle: string;
      status: MobileCustomerOrderStatus;
      createdAt: string;
      amount: string;
      source: MobileCustomerOrderListItem;
    }
  | {
      kind: "ticket";
      id: string;
      title: string;
      subtitle: string;
      status: MobileCustomerTicketStatus;
      createdAt: string;
      expectedAt: string | null;
      source: MobileCustomerTicketListItem;
    };

export type ActivityDetail =
  | {
      kind: "order";
      data: MobileCustomerOrderDetail;
    }
  | {
      kind: "ticket";
      data: MobileCustomerTicketDetail;
    };

export type CustomerOverviewNextItem =
  | {
      kind: "activity";
      activity: ActivityListItem;
    }
  | {
      kind: "appointment";
      appointment: MobileCustomerAppointment;
    };

export type AppointmentFormState = {
  type: MobileCustomerAppointmentType;
  branchId: string;
  addressId: string;
  expectedAt: string;
  address: string;
  notes: string;
};

export type CustomerProfileFormState = {
  accountName: string;
  phone: string;
  email: string;
};

export type CustomerContactFormState = {
  fullName: string;
  phone: string;
  email: string;
  relationship: string;
  address: string;
};

export type CustomerAddressFormState = {
  customerId: string;
  label: string;
  contactName: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  latitude: string;
  longitude: string;
  isDefault: boolean;
  notes: string;
};

export type CustomerPasswordFormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type CustomerConfirmTarget =
  | { kind: "cancel-appointment"; appointmentId: string }
  | { kind: "delete-address"; addressId: string }
  | { kind: "delete-contact"; customerId: string };

export type StatusView = {
  label: string;
  className: string;
};

export type Translator = ReturnType<typeof useTranslation>["t"];

export const emptyActivity: MobileCustomerActivityList = {
  orders: [],
  tickets: [],
};

export const emptyContactForm: CustomerContactFormState = {
  fullName: "",
  phone: "",
  email: "",
  relationship: "",
  address: "",
};

export const emptyAddressForm: CustomerAddressFormState = {
  customerId: "",
  label: "",
  contactName: "",
  contactPhone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  province: "",
  postalCode: "",
  country: "TH",
  latitude: "",
  longitude: "",
  isDefault: false,
  notes: "",
};

export const CUSTOM_APPOINTMENT_ADDRESS_ID = "__custom";
const MIN_APPOINTMENT_LEAD_TIME_MINUTES = 30;

export const emptyPasswordForm: CustomerPasswordFormState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export const activityStatusFilters: ActivityStatusFilter[] = [
  "all",
  "active",
  "done",
  "cancelled",
];

const orderStatusClasses: Record<MobileCustomerOrderStatus, string> = {
  draft: "border-slate-200 bg-slate-50 text-slate-700",
  received: "border-blue-200 bg-blue-50 text-blue-800",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-800",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-800",
  cancelled: "border-red-200 bg-red-50 text-red-700",
};

const ticketStatusClasses: Record<MobileCustomerTicketStatus, string> = {
  draft: "border-slate-200 bg-slate-50 text-slate-700",
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  in_progress: "border-blue-200 bg-blue-50 text-blue-800",
  ready_to_pick: "border-emerald-200 bg-emerald-50 text-emerald-800",
  picked_up: "border-emerald-200 bg-emerald-50 text-emerald-800",
  cancelled: "border-red-200 bg-red-50 text-red-700",
  exception: "border-red-200 bg-red-50 text-red-700",
};

const appointmentStatusClasses: Record<MobileCustomerAppointmentStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  accepted: "border-blue-200 bg-blue-50 text-blue-800",
  cancelled: "border-red-200 bg-red-50 text-red-700",
  done: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

const refundStatusClasses: Record<MobileRefundRequest["status"], string> = {
  approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
  failed: "border-red-200 bg-red-50 text-red-700",
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  processing: "border-sky-200 bg-sky-50 text-sky-800",
  refunded: "border-emerald-200 bg-emerald-50 text-emerald-800",
  rejected: "border-red-200 bg-red-50 text-red-700",
};

const orderStatusKeys: Record<MobileCustomerOrderStatus, TranslationKey> = {
  draft: "customer.status.order.draft",
  received: "customer.status.order.received",
  paid: "customer.status.order.paid",
  delivered: "customer.status.order.delivered",
  cancelled: "customer.status.order.cancelled",
};

const ticketStatusKeys: Record<MobileCustomerTicketStatus, TranslationKey> = {
  draft: "customer.status.ticket.draft",
  pending: "customer.status.ticket.pending",
  in_progress: "customer.status.ticket.in_progress",
  ready_to_pick: "customer.status.ticket.ready_to_pick",
  picked_up: "customer.status.ticket.picked_up",
  cancelled: "customer.status.ticket.cancelled",
  exception: "customer.status.ticket.exception",
};

const appointmentStatusKeys: Record<MobileCustomerAppointmentStatus, TranslationKey> = {
  pending: "customer.status.appointment.pending",
  accepted: "customer.status.appointment.accepted",
  cancelled: "customer.status.appointment.cancelled",
  done: "customer.status.appointment.done",
};

const refundStatusKeys: Record<MobileRefundRequest["status"], TranslationKey> = {
  approved: "customer.status.refund.approved",
  failed: "customer.status.refund.failed",
  pending: "customer.status.refund.pending",
  processing: "customer.status.refund.processing",
  refunded: "customer.status.refund.refunded",
  rejected: "customer.status.refund.rejected",
};

export const appointmentTypeKeys: Record<MobileCustomerAppointmentType, TranslationKey> = {
  pickup: "customer.appointmentTypes.pickup",
  dropoff: "customer.appointmentTypes.dropoff",
};

export function formatDateTime(value: string | null, locale = "fr-FR"): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDate(value: string, locale = "fr-FR"): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
  }).format(date);
}

export function getDefaultExpectedAt(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(Math.max(date.getHours() + 2, 10), 0, 0, 0);
  return toDateTimeLocalValue(date);
}

export function getMinimumAppointmentDate(): Date {
  return new Date(Date.now() + MIN_APPOINTMENT_LEAD_TIME_MINUTES * 60 * 1000);
}

export function getMinimumAppointmentDateValue(): string {
  return toDateTimeLocalValue(getMinimumAppointmentDate());
}

function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function amountToCents(value: string): number {
  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function formatAmountFromCents(value: number): string {
  return (Math.max(0, value) / 100).toFixed(2);
}

export function getOrderBalance(order: MobileCustomerOrderDetail): string {
  return formatAmountFromCents(
    amountToCents(order.totalAmount) - amountToCents(order.paidAmount),
  );
}

export function getOrderStatusView(
  t: Translator,
  status: MobileCustomerOrderStatus,
): StatusView {
  return {
    label: t(orderStatusKeys[status]),
    className: orderStatusClasses[status],
  };
}

export function getTicketStatusView(
  t: Translator,
  status: MobileCustomerTicketStatus,
): StatusView {
  return {
    label: t(ticketStatusKeys[status]),
    className: ticketStatusClasses[status],
  };
}

export function getAppointmentStatusView(
  t: Translator,
  status: MobileCustomerAppointmentStatus,
): StatusView {
  return {
    label: t(appointmentStatusKeys[status]),
    className: appointmentStatusClasses[status],
  };
}

export function getRefundStatusView(
  t: Translator,
  status: MobileRefundRequest["status"],
): StatusView {
  return {
    label: t(refundStatusKeys[status]),
    className: refundStatusClasses[status],
  };
}

export function getActivityItems(
  activity: MobileCustomerActivityList,
  t: Translator,
): ActivityListItem[] {
  const orders: ActivityListItem[] = activity.orders.map((order) => ({
    kind: "order",
    id: order.id,
    title: t("customer.detail.orderPrefix", { id: order.id.slice(-6).toUpperCase() }),
    subtitle: `${t("customer.detail.payment")} ${order.paymentStatus}`,
    status: order.status,
    createdAt: order.createdAt,
    amount: order.totalAmount,
    source: order,
  }));
  const tickets: ActivityListItem[] = activity.tickets.map((ticket) => ({
    kind: "ticket",
    id: ticket.id,
    title: ticket.ticketNo
      ? t("customer.detail.ticketPrefix", { id: ticket.ticketNo })
      : t("customer.detail.ticketPrefix", { id: ticket.id.slice(-6).toUpperCase() }),
    subtitle: ticket.ticketType,
    status: ticket.ticketStatus,
    createdAt: ticket.createdAt,
    expectedAt: ticket.expectedPickupAt,
    source: ticket,
  }));

  return [...orders, ...tickets].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

function getActivityStatusGroup(item: ActivityListItem): Exclude<ActivityStatusFilter, "all"> {
  if (item.status === "cancelled" || item.status === "exception") {
    return "cancelled";
  }

  if (
    (item.kind === "order" && item.status === "delivered") ||
    (item.kind === "ticket" && item.status === "picked_up")
  ) {
    return "done";
  }

  return "active";
}

export function filterActivityItems(
  items: ActivityListItem[],
  filter: ActivityStatusFilter,
): ActivityListItem[] {
  if (filter === "all") {
    return items;
  }

  return items.filter((item) => getActivityStatusGroup(item) === filter);
}

export function isOpenAppointment(appointment: MobileCustomerAppointment): boolean {
  return appointment.status === "pending" || appointment.status === "accepted";
}

function getOverviewSortTime(item: CustomerOverviewNextItem): number {
  const value =
    item.kind === "appointment"
      ? item.appointment.expectedAt
      : item.activity.kind === "ticket"
        ? item.activity.expectedAt ?? item.activity.createdAt
        : item.activity.createdAt;
  const time = new Date(value).getTime();

  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

export function getNextOverviewItem(
  activityItems: ActivityListItem[],
  appointments: MobileCustomerAppointment[],
): CustomerOverviewNextItem | null {
  const activeActivity = activityItems
    .filter((item) => getActivityStatusGroup(item) === "active")
    .map((activity) => ({ kind: "activity" as const, activity }));
  const openAppointments = appointments
    .filter(isOpenAppointment)
    .map((appointment) => ({ kind: "appointment" as const, appointment }));
  const [nextItem] = [...activeActivity, ...openAppointments].sort(
    (left, right) => getOverviewSortTime(left) - getOverviewSortTime(right),
  );

  return nextItem ?? null;
}

export function getReadyForPickupCount(activityItems: ActivityListItem[]): number {
  return activityItems.filter(
    (item) => item.kind === "ticket" && item.status === "ready_to_pick",
  ).length;
}

export function sortAppointments(
  appointments: MobileCustomerAppointment[],
): MobileCustomerAppointment[] {
  return [...appointments].sort(
    (left, right) => new Date(right.expectedAt).getTime() - new Date(left.expectedAt).getTime(),
  );
}

export function getPrimaryAddress(profile: MobileCustomerProfile | null): string {
  return profile?.addresses.find((item) => item.address)?.address ?? "";
}

export function getAddressBookPrimaryAddress(addresses: MobileCustomerAddress[]): string {
  const address = addresses.find((item) => item.isDefault) ?? addresses[0];

  return address ? formatCustomerAddress(address) : "";
}

export function getAddressBookPrimaryAddressId(addresses: MobileCustomerAddress[]): string {
  return (
    (addresses.find((item) => item.isDefault) ?? addresses[0])?.id ??
    CUSTOM_APPOINTMENT_ADDRESS_ID
  );
}

export function getConfirmTitle(
  t: Translator,
  target: CustomerConfirmTarget | null,
): string {
  if (!target) {
    return "";
  }

  if (target.kind === "cancel-appointment") {
    return t("customer.confirm.cancelAppointmentTitle");
  }

  if (target.kind === "delete-address") {
    return t("customer.confirm.deleteAddressTitle");
  }

  return t("customer.confirm.deleteContactTitle");
}

export function getConfirmDescription(
  t: Translator,
  target: CustomerConfirmTarget | null,
): string {
  if (!target) {
    return "";
  }

  if (target.kind === "cancel-appointment") {
    return t("customer.confirm.cancelAppointmentDescription");
  }

  if (target.kind === "delete-address") {
    return t("customer.confirm.deleteAddressDescription");
  }

  return t("customer.confirm.deleteContactDescription");
}

export function getConfirmLabel(
  t: Translator,
  target: CustomerConfirmTarget | null,
): string {
  if (!target) {
    return "";
  }

  if (target.kind === "cancel-appointment") {
    return t("customer.confirm.cancelAppointmentConfirm");
  }

  if (target.kind === "delete-address") {
    return t("customer.confirm.deleteAddressConfirm");
  }

  return t("customer.confirm.deleteContactConfirm");
}

export function toProfileForm(profile: MobileCustomerProfile | null): CustomerProfileFormState {
  return {
    accountName: profile?.account.accountName ?? "",
    phone: profile?.account.phone ?? "",
    email: profile?.account.email ?? "",
  };
}

export function toContactForm(contact?: MobileCustomerContact | null): CustomerContactFormState {
  if (!contact) {
    return emptyContactForm;
  }

  return {
    fullName: contact.fullName,
    phone: contact.phone ?? "",
    email: contact.email ?? "",
    relationship: contact.relationship ?? "",
    address: contact.address ?? "",
  };
}

export function toAddressForm(address?: MobileCustomerAddress | null): CustomerAddressFormState {
  if (!address) {
    return emptyAddressForm;
  }

  return {
    customerId: address.customerId ?? "",
    label: address.label,
    contactName: address.contactName ?? "",
    contactPhone: address.contactPhone ?? "",
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2 ?? "",
    city: address.city ?? "",
    province: address.province ?? "",
    postalCode: address.postalCode ?? "",
    country: normalizeCountryCode(address.country),
    latitude: address.latitude ?? "",
    longitude: address.longitude ?? "",
    isDefault: address.isDefault,
    notes: address.notes ?? "",
  };
}

export function toAddressInput(form: CustomerAddressFormState): MobileCustomerAddressInput {
  return {
    customerId: form.customerId || null,
    label: form.label,
    contactName: form.contactName || null,
    contactPhone: form.contactPhone || null,
    addressLine1: form.addressLine1,
    addressLine2: form.addressLine2 || null,
    city: form.city || null,
    province: form.province || null,
    postalCode: form.postalCode || null,
    country: normalizeCountryCode(form.country),
    latitude: form.latitude || null,
    longitude: form.longitude || null,
    isDefault: form.isDefault,
    notes: form.notes || null,
  };
}

export function toContactInput(form: CustomerContactFormState) {
  return {
    fullName: form.fullName,
    phone: form.phone || null,
    email: form.email || null,
    relationship: form.relationship || null,
    address: form.address || null,
  };
}

export function formatCustomerAddress(address: MobileCustomerAddress): string {
  return [
    address.addressLine1,
    address.addressLine2,
    address.city,
    address.province,
    address.postalCode,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");
}
