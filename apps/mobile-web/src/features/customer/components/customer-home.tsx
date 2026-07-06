"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  MobileAuthContext,
  MobileCustomerActivityList,
  MobileCustomerAddress,
  MobileCustomerAddressInput,
  MobileCustomerAppointment,
  MobileCustomerAppointmentStatus,
  MobileCustomerAppointmentType,
  MobileCustomerBranchOption,
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
import type { SupportedLocale, TranslationKey } from "@cleanhub/i18n";
import { useTranslation } from "@cleanhub/i18n/react";
import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Textarea,
} from "@cleanhub/ui";
import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Edit3,
  Home,
  KeyRound,
  LocateFixed,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  ReceiptText,
  RotateCcw,
  Star,
  Trash2,
  TicketCheck,
  UserRound,
  XCircle,
} from "lucide-react";

import { getMobileSession } from "@/lib/token-storage";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { WorkspaceHeader } from "@/components/workspace-header";
import { formatTenantMoney, resolveTenantCurrency } from "@/lib/currency";
import {
  readMobileDetailUrlState,
  writeMobileDetailUrlState,
} from "@/lib/detail-url";
import { openExternalUrl } from "../lib/open-external";

import {
  cancelCustomerAppointment,
  changeCustomerPassword,
  createCustomerAddress,
  createCustomerAppointment,
  createCustomerContact,
  createCustomerPayment,
  createCustomerRefundRequest,
  deleteCustomerAddress,
  deleteCustomerContact,
  setDefaultCustomerAddress,
  updateCustomerAddress,
  updateCustomerContact,
  updateCustomerProfile,
} from "../actions";
import {
  getCustomerActivityDetail,
  getCustomerAddresses,
  getCustomerAppointments,
  getCustomerBranches,
  getCustomerOrdersAndTickets,
  getCustomerProfile,
  getCustomerRefundRequests,
} from "../queries";

type CustomerTab = "resume" | "orders" | "appointments" | "profile";

type ActivityKind = "order" | "ticket";

type ActivityStatusFilter = "all" | "active" | "done" | "cancelled";

type ActivityListItem =
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

type ActivityDetail =
  | {
      kind: "order";
      data: MobileCustomerOrderDetail;
    }
  | {
      kind: "ticket";
      data: MobileCustomerTicketDetail;
    };

type ActivitySelection = {
  kind: ActivityKind;
  id: string;
};

type CustomerOverviewNextItem =
  | {
      kind: "activity";
      activity: ActivityListItem;
    }
  | {
      kind: "appointment";
      appointment: MobileCustomerAppointment;
    };

type AppointmentFormState = {
  type: MobileCustomerAppointmentType;
  branchId: string;
  addressId: string;
  expectedAt: string;
  address: string;
  notes: string;
};

type CustomerProfileFormState = {
  accountName: string;
  phone: string;
  email: string;
};

type CustomerContactFormState = {
  fullName: string;
  phone: string;
  email: string;
  relationship: string;
  address: string;
};

type CustomerAddressFormState = {
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

type CustomerPasswordFormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type RefundFormState = {
  orderId: string;
  amount: string;
  reason: string;
};

type ProfileSheet = "profile" | "contact" | "address" | "password" | null;

type CustomerConfirmTarget =
  | { kind: "cancel-appointment"; appointmentId: string }
  | { kind: "delete-address"; addressId: string }
  | { kind: "delete-contact"; customerId: string };

type StatusView = {
  label: string;
  className: string;
};

type Translator = ReturnType<typeof useTranslation>["t"];

const emptyActivity: MobileCustomerActivityList = {
  orders: [],
  tickets: [],
};

const emptyContactForm: CustomerContactFormState = {
  fullName: "",
  phone: "",
  email: "",
  relationship: "",
  address: "",
};

const emptyAddressForm: CustomerAddressFormState = {
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

const CUSTOM_APPOINTMENT_ADDRESS_ID = "__custom";
const MIN_APPOINTMENT_LEAD_TIME_MINUTES = 30;

const emptyPasswordForm: CustomerPasswordFormState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const tabIcons: Record<CustomerTab, typeof Home> = {
  resume: Home,
  orders: ReceiptText,
  appointments: CalendarClock,
  profile: UserRound,
};

const customerDetailUrlViews = ["order", "ticket"] as const;

const activityStatusFilters: ActivityStatusFilter[] = ["all", "active", "done", "cancelled"];

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

const appointmentTypeKeys: Record<MobileCustomerAppointmentType, TranslationKey> = {
  pickup: "customer.appointmentTypes.pickup",
  dropoff: "customer.appointmentTypes.dropoff",
};

const intlLocales: Record<SupportedLocale, string> = {
  fr: "fr-FR",
  en: "en-US",
  "zh-CN": "zh-CN",
};

type CountryOption = {
  code: string;
  fallbackLabel: string;
};

type AddressCoordinates = {
  latitude: string;
  longitude: string;
};

type GeolocationModule = {
  getCurrentPosition(options?: {
    enableHighAccuracy?: boolean;
    timeout?: number;
    maximumAge?: number;
  }): Promise<{
    coords: {
      latitude: number;
      longitude: number;
    };
  }>;
};

const addressCountryOptions: CountryOption[] = [
  "AF",
  "AX",
  "AL",
  "DZ",
  "AS",
  "AD",
  "AO",
  "AI",
  "AQ",
  "AG",
  "AR",
  "AM",
  "AW",
  "AU",
  "AT",
  "AZ",
  "BS",
  "BH",
  "BD",
  "BB",
  "BY",
  "BE",
  "BZ",
  "BJ",
  "BM",
  "BT",
  "BO",
  "BQ",
  "BA",
  "BW",
  "BV",
  "BR",
  "IO",
  "BN",
  "BG",
  "BF",
  "BI",
  "CV",
  "KH",
  "CM",
  "CA",
  "KY",
  "CF",
  "TD",
  "CL",
  "CN",
  "CX",
  "CC",
  "CO",
  "KM",
  "CG",
  "CD",
  "CK",
  "CR",
  "CI",
  "HR",
  "CU",
  "CW",
  "CY",
  "CZ",
  "DK",
  "DJ",
  "DM",
  "DO",
  "EC",
  "EG",
  "SV",
  "GQ",
  "ER",
  "EE",
  "SZ",
  "ET",
  "FK",
  "FO",
  "FJ",
  "FI",
  "FR",
  "GF",
  "PF",
  "TF",
  "GA",
  "GM",
  "GE",
  "DE",
  "GH",
  "GI",
  "GR",
  "GL",
  "GD",
  "GP",
  "GU",
  "GT",
  "GG",
  "GN",
  "GW",
  "GY",
  "HT",
  "HM",
  "VA",
  "HN",
  "HK",
  "HU",
  "IS",
  "IN",
  "ID",
  "IR",
  "IQ",
  "IE",
  "IM",
  "IL",
  "IT",
  "JM",
  "JP",
  "JE",
  "JO",
  "KZ",
  "KE",
  "KI",
  "KP",
  "KR",
  "KW",
  "KG",
  "LA",
  "LV",
  "LB",
  "LS",
  "LR",
  "LY",
  "LI",
  "LT",
  "LU",
  "MO",
  "MG",
  "MW",
  "MY",
  "MV",
  "ML",
  "MT",
  "MH",
  "MQ",
  "MR",
  "MU",
  "YT",
  "MX",
  "FM",
  "MD",
  "MC",
  "MN",
  "ME",
  "MS",
  "MA",
  "MZ",
  "MM",
  "NA",
  "NR",
  "NP",
  "NL",
  "NC",
  "NZ",
  "NI",
  "NE",
  "NG",
  "NU",
  "NF",
  "MK",
  "MP",
  "NO",
  "OM",
  "PK",
  "PW",
  "PS",
  "PA",
  "PG",
  "PY",
  "PE",
  "PH",
  "PN",
  "PL",
  "PT",
  "PR",
  "QA",
  "RE",
  "RO",
  "RU",
  "RW",
  "BL",
  "SH",
  "KN",
  "LC",
  "MF",
  "PM",
  "VC",
  "WS",
  "SM",
  "ST",
  "SA",
  "SN",
  "RS",
  "SC",
  "SL",
  "SG",
  "SX",
  "SK",
  "SI",
  "SB",
  "SO",
  "ZA",
  "GS",
  "SS",
  "ES",
  "LK",
  "SD",
  "SR",
  "SJ",
  "SE",
  "CH",
  "SY",
  "TW",
  "TJ",
  "TZ",
  "TH",
  "TL",
  "TG",
  "TK",
  "TO",
  "TT",
  "TN",
  "TR",
  "TM",
  "TC",
  "TV",
  "UG",
  "UA",
  "AE",
  "GB",
  "US",
  "UM",
  "UY",
  "UZ",
  "VU",
  "VE",
  "VN",
  "VG",
  "VI",
  "WF",
  "EH",
  "YE",
  "ZM",
  "ZW",
].map((code) => ({ code, fallbackLabel: code }));

const countryDefaultsByTimeZone: Record<string, string> = {
  "Africa/Abidjan": "CI",
  "Africa/Algiers": "DZ",
  "Africa/Bamako": "ML",
  "Africa/Bangui": "CM",
  "Africa/Casablanca": "MA",
  "Africa/Dakar": "SN",
  "Africa/Lagos": "NG",
  "Africa/Lome": "TG",
  "Africa/Ouagadougou": "BF",
  "Africa/Porto-Novo": "BJ",
  "Africa/Tunis": "TN",
  "America/Chicago": "US",
  "America/Los_Angeles": "US",
  "America/New_York": "US",
  "America/Toronto": "CA",
  "Asia/Bangkok": "TH",
  "Asia/Shanghai": "CN",
  "Europe/London": "GB",
  "Europe/Paris": "FR",
};

function formatDateTime(value: string | null, locale = "fr-FR"): string {
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

function formatDate(value: string, locale = "fr-FR"): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
  }).format(date);
}

function getIntlLocale(locale: SupportedLocale): string {
  return intlLocales[locale];
}

function normalizeCountryCode(value: string | null | undefined): string {
  const code = value?.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);

  return code || "TH";
}

function getDeviceCountry(): string {
  if (typeof Intl !== "undefined") {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timeZoneCountry = countryDefaultsByTimeZone[timeZone];

    if (timeZoneCountry) {
      return timeZoneCountry;
    }
  }

  if (typeof navigator !== "undefined") {
    const languages = navigator.languages?.length ? navigator.languages : [navigator.language];

    for (const language of languages) {
      const region = getLocaleRegion(language);

      if (region) {
        return region;
      }
    }
  }

  return "TH";
}

function getLocaleRegion(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const locale = new Intl.Locale(value).maximize();

    return locale.region ? normalizeCountryCode(locale.region) : null;
  } catch {
    const region = value.match(/[-_]([A-Za-z]{2})\b/)?.[1];

    return region ? normalizeCountryCode(region) : null;
  }
}

function getCountryOptions(locale: SupportedLocale, selectedCountry: string): CountryOption[] {
  const selectedCode = normalizeCountryCode(selectedCountry);
  const options = addressCountryOptions.some((option) => option.code === selectedCode)
    ? addressCountryOptions
    : [{ code: selectedCode, fallbackLabel: selectedCode }, ...addressCountryOptions];

  return options
    .map((option) => ({
      ...option,
      fallbackLabel: getCountryLabel(locale, option),
    }))
    .sort((left, right) => left.fallbackLabel.localeCompare(right.fallbackLabel));
}

function getCountryFlag(countryCode: string): string {
  const code = normalizeCountryCode(countryCode);

  if (code.length !== 2) {
    return "";
  }

  return String.fromCodePoint(
    ...[...code].map((character) => 0x1f1e6 + character.charCodeAt(0) - 65),
  );
}

function getCountryLabel(locale: SupportedLocale, option: CountryOption): string {
  try {
    const displayNames = new Intl.DisplayNames([getIntlLocale(locale)], {
      type: "region",
    });

    return displayNames.of(option.code) ?? option.fallbackLabel;
  } catch {
    return option.fallbackLabel;
  }
}

function getCapacitorPlugin<TPlugin>(name: string): TPlugin | null {
  if (typeof window === "undefined") {
    return null;
  }

  const candidate = window as Window & {
    Capacitor?: {
      Plugins?: Record<string, unknown>;
    };
  };

  const plugin = candidate.Capacitor?.Plugins?.[name];
  return plugin ? (plugin as TPlugin) : null;
}

async function getCurrentAddressCoordinates(): Promise<AddressCoordinates> {
  if (typeof window === "undefined") {
    throw new Error("Location is unavailable during initial render.");
  }

  const geolocation = getCapacitorPlugin<GeolocationModule>("Geolocation");

  if (geolocation) {
    const position = await geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 30_000,
    });

    return formatAddressCoordinates(position.coords.latitude, position.coords.longitude);
  }

  if (!navigator.geolocation) {
    throw new Error("Location is unavailable on this device.");
  }

  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 30_000,
    });
  });

  return formatAddressCoordinates(position.coords.latitude, position.coords.longitude);
}

function formatAddressCoordinates(latitude: number, longitude: number): AddressCoordinates {
  return {
    latitude: formatCoordinate(latitude),
    longitude: formatCoordinate(longitude),
  };
}

function formatCoordinate(value: number): string {
  return Number.isFinite(value)
    ? value.toFixed(7).replace(/\.?0+$/, "")
    : "";
}

function getDefaultExpectedAt(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(Math.max(date.getHours() + 2, 10), 0, 0, 0);
  return toDateTimeLocalValue(date);
}

function getMinimumAppointmentDate(): Date {
  return new Date(Date.now() + MIN_APPOINTMENT_LEAD_TIME_MINUTES * 60 * 1000);
}

function getMinimumAppointmentDateValue(): string {
  return toDateTimeLocalValue(getMinimumAppointmentDate());
}

function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function amountToCents(value: string): number {
  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function formatAmountFromCents(value: number): string {
  return (Math.max(0, value) / 100).toFixed(2);
}

function getOrderBalance(order: MobileCustomerOrderDetail): string {
  return formatAmountFromCents(
    amountToCents(order.totalAmount) - amountToCents(order.paidAmount),
  );
}

function getOrderStatusView(t: Translator, status: MobileCustomerOrderStatus): StatusView {
  return {
    label: t(orderStatusKeys[status]),
    className: orderStatusClasses[status],
  };
}

function getTicketStatusView(t: Translator, status: MobileCustomerTicketStatus): StatusView {
  return {
    label: t(ticketStatusKeys[status]),
    className: ticketStatusClasses[status],
  };
}

function getAppointmentStatusView(
  t: Translator,
  status: MobileCustomerAppointmentStatus,
): StatusView {
  return {
    label: t(appointmentStatusKeys[status]),
    className: appointmentStatusClasses[status],
  };
}

function getRefundStatusView(
  t: Translator,
  status: MobileRefundRequest["status"],
): StatusView {
  return {
    label: t(refundStatusKeys[status]),
    className: refundStatusClasses[status],
  };
}

function getAccountStatusView(
  t: Translator,
  status: MobileCustomerProfile["account"]["status"],
): StatusView {
  return status === "active"
    ? {
        label: t("customer.profile.active"),
        className: "border-emerald-200 bg-emerald-50 text-emerald-800",
      }
    : {
        label: t("customer.profile.disabled"),
        className: "border-red-200 bg-red-50 text-red-700",
      };
}

function getActivityItems(activity: MobileCustomerActivityList, t: Translator): ActivityListItem[] {
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

function filterActivityItems(
  items: ActivityListItem[],
  filter: ActivityStatusFilter,
): ActivityListItem[] {
  if (filter === "all") {
    return items;
  }

  return items.filter((item) => getActivityStatusGroup(item) === filter);
}

function isOpenAppointment(appointment: MobileCustomerAppointment): boolean {
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

function getNextOverviewItem(
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

function getReadyForPickupCount(activityItems: ActivityListItem[]): number {
  return activityItems.filter(
    (item) => item.kind === "ticket" && item.status === "ready_to_pick",
  ).length;
}

function sortAppointments(appointments: MobileCustomerAppointment[]): MobileCustomerAppointment[] {
  return [...appointments].sort(
    (left, right) => new Date(right.expectedAt).getTime() - new Date(left.expectedAt).getTime(),
  );
}

function getPrimaryAddress(profile: MobileCustomerProfile | null): string {
  return profile?.addresses.find((item) => item.address)?.address ?? "";
}

function getAddressBookPrimaryAddress(addresses: MobileCustomerAddress[]): string {
  const address = addresses.find((item) => item.isDefault) ?? addresses[0];

  return address ? formatCustomerAddress(address) : "";
}

function getAddressBookPrimaryAddressId(addresses: MobileCustomerAddress[]): string {
  return (addresses.find((item) => item.isDefault) ?? addresses[0])?.id ?? CUSTOM_APPOINTMENT_ADDRESS_ID;
}

function getConfirmTitle(t: Translator, target: CustomerConfirmTarget | null): string {
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

function getConfirmDescription(
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

function getConfirmLabel(t: Translator, target: CustomerConfirmTarget | null): string {
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

function toProfileForm(profile: MobileCustomerProfile | null): CustomerProfileFormState {
  return {
    accountName: profile?.account.accountName ?? "",
    phone: profile?.account.phone ?? "",
    email: profile?.account.email ?? "",
  };
}

function toContactForm(contact?: MobileCustomerContact | null): CustomerContactFormState {
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

function toAddressForm(address?: MobileCustomerAddress | null): CustomerAddressFormState {
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

function toAddressInput(form: CustomerAddressFormState): MobileCustomerAddressInput {
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

function toContactInput(form: CustomerContactFormState) {
  return {
    fullName: form.fullName,
    phone: form.phone || null,
    email: form.email || null,
    relationship: form.relationship || null,
    address: form.address || null,
  };
}

function formatCustomerAddress(address: MobileCustomerAddress): string {
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

type CustomerSnapshot = {
  authContext: MobileAuthContext | null;
  profile: MobileCustomerProfile | null;
  addressBook: MobileCustomerAddress[];
  branches: MobileCustomerBranchOption[];
  activity: MobileCustomerActivityList;
  appointments: MobileCustomerAppointment[];
  refundRequests: MobileRefundRequest[];
  errorKey: TranslationKey | null;
};

async function fetchCustomerSnapshot(): Promise<CustomerSnapshot> {
  const session = await getMobileSession();

  if (!session || session.authContext.role !== "customer") {
    return {
      authContext: session?.authContext ?? null,
      profile: null,
      addressBook: [],
      branches: [],
      activity: emptyActivity,
      appointments: [],
      refundRequests: [],
      errorKey: "customer.messages.customerSessionRequired",
    };
  }

  const [profile, addressBook, branches, activity, appointments, refundRequests] = await Promise.all([
    getCustomerProfile(),
    getCustomerAddresses(),
    getCustomerBranches(),
    getCustomerOrdersAndTickets(),
    getCustomerAppointments(),
    getCustomerRefundRequests(),
  ]);

  return {
    authContext: session.authContext,
    profile,
    addressBook: addressBook.data,
    branches: branches.data,
    activity: activity.data,
    appointments: sortAppointments(appointments.data),
    refundRequests: refundRequests.data,
    errorKey: null,
  };
}

type CustomerHomeProps = {
  initialAuthContext?: MobileAuthContext | null;
  isLoggingOut?: boolean;
  onLogout?: () => void;
};

export function CustomerHome({
  initialAuthContext = null,
  isLoggingOut = false,
  onLogout,
}: CustomerHomeProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<CustomerTab>("resume");
  const [activityFilter, setActivityFilter] = useState<ActivityStatusFilter>("all");
  const [authContext, setAuthContext] = useState<MobileAuthContext | null>(
    initialAuthContext,
  );
  const [profile, setProfile] = useState<MobileCustomerProfile | null>(null);
  const [addressBook, setAddressBook] = useState<MobileCustomerAddress[]>([]);
  const [branches, setBranches] = useState<MobileCustomerBranchOption[]>([]);
  const [activity, setActivity] = useState<MobileCustomerActivityList>(emptyActivity);
  const [appointments, setAppointments] = useState<MobileCustomerAppointment[]>([]);
  const [refundRequests, setRefundRequests] = useState<MobileRefundRequest[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<ActivitySelection | null>(null);
  const [activityDetail, setActivityDetail] = useState<ActivityDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [appointmentSheetOpen, setAppointmentSheetOpen] = useState(false);
  const [profileSheet, setProfileSheet] = useState<ProfileSheet>(null);
  const [confirmTarget, setConfirmTarget] = useState<CustomerConfirmTarget | null>(null);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState<CustomerProfileFormState>(() => toProfileForm(null));
  const [contactForm, setContactForm] = useState<CustomerContactFormState>(emptyContactForm);
  const [addressForm, setAddressForm] = useState<CustomerAddressFormState>(emptyAddressForm);
  const [passwordForm, setPasswordForm] = useState<CustomerPasswordFormState>(emptyPasswordForm);
  const [refundSheetOpen, setRefundSheetOpen] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState<AppointmentFormState>({
    type: "pickup",
    branchId: "",
    addressId: CUSTOM_APPOINTMENT_ADDRESS_ID,
    expectedAt: getDefaultExpectedAt(),
    address: "",
    notes: "",
  });
  const [refundForm, setRefundForm] = useState<RefundFormState>({
    orderId: "",
    amount: "",
    reason: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSubmittingAppointment, setIsSubmittingAppointment] = useState(false);
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const [isSubmittingAddress, setIsSubmittingAddress] = useState(false);
  const [isLocatingAddress, setIsLocatingAddress] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [pendingPaymentOrderId, setPendingPaymentOrderId] = useState<string | null>(null);
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);
  const [cancellingAppointmentId, setCancellingAppointmentId] = useState<string | null>(null);
  const [contactActionId, setContactActionId] = useState<string | null>(null);
  const [addressActionId, setAddressActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasRestoredDetailRef = useRef(false);

  const isConfirmSubmitting =
    confirmTarget?.kind === "cancel-appointment"
      ? cancellingAppointmentId === confirmTarget.appointmentId
      : confirmTarget?.kind === "delete-address"
        ? addressActionId === `delete-${confirmTarget.addressId}`
        : confirmTarget?.kind === "delete-contact"
          ? contactActionId === `delete-${confirmTarget.customerId}`
          : false;

  const loadCustomerData = useCallback(async (mode: "boot" | "refresh" = "refresh") => {
    if (mode === "boot") {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    setError(null);

    try {
      const snapshot = await fetchCustomerSnapshot();
      setAuthContext(snapshot.authContext);
      setProfile(snapshot.profile);
      setAddressBook(snapshot.addressBook);
      setBranches(snapshot.branches);
      setActivity(snapshot.activity);
      setAppointments(snapshot.appointments);
      setRefundRequests(snapshot.refundRequests);
      setError(snapshot.errorKey ? t(snapshot.errorKey) : null);
      setProfileForm(toProfileForm(snapshot.profile));
      setAppointmentForm((current) => ({
        ...current,
        branchId: current.branchId || snapshot.branches[0]?.id || "",
        addressId:
          current.addressId === CUSTOM_APPOINTMENT_ADDRESS_ID && current.address
            ? current.addressId
            : getAddressBookPrimaryAddressId(snapshot.addressBook),
        address:
          current.address ||
          getAddressBookPrimaryAddress(snapshot.addressBook) ||
          getPrimaryAddress(snapshot.profile),
      }));
    } catch (nextError) {
      setError(getErrorMessage(nextError, t("common.errors.genericAction")));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    let mounted = true;

    fetchCustomerSnapshot()
      .then((snapshot) => {
        if (!mounted) {
          return;
        }

        setAuthContext(snapshot.authContext);
        setProfile(snapshot.profile);
        setAddressBook(snapshot.addressBook);
        setBranches(snapshot.branches);
        setActivity(snapshot.activity);
        setAppointments(snapshot.appointments);
        setRefundRequests(snapshot.refundRequests);
        setError(snapshot.errorKey ? t(snapshot.errorKey) : null);
        setProfileForm(toProfileForm(snapshot.profile));
        setAppointmentForm((current) => ({
          ...current,
          branchId: current.branchId || snapshot.branches[0]?.id || "",
          addressId:
            current.addressId === CUSTOM_APPOINTMENT_ADDRESS_ID && current.address
              ? current.addressId
              : getAddressBookPrimaryAddressId(snapshot.addressBook),
          address:
            current.address ||
            getAddressBookPrimaryAddress(snapshot.addressBook) ||
            getPrimaryAddress(snapshot.profile),
        }));
      })
      .catch((nextError: unknown) => {
        if (mounted) {
          setError(getErrorMessage(nextError, t("common.errors.genericAction")));
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [t]);

  const activityItems = useMemo(() => getActivityItems(activity, t), [activity, t]);
  const filteredActivityItems = useMemo(
    () => filterActivityItems(activityItems, activityFilter),
    [activityFilter, activityItems],
  );
  const tenantCurrency = resolveTenantCurrency(authContext?.currency);

  useEffect(() => {
    const refreshWhenActive = () => {
      if (document.visibilityState === "visible") {
        void loadCustomerData("refresh");
      }
    };

    window.addEventListener("focus", refreshWhenActive);
    document.addEventListener("visibilitychange", refreshWhenActive);

    return () => {
      window.removeEventListener("focus", refreshWhenActive);
      document.removeEventListener("visibilitychange", refreshWhenActive);
    };
  }, [loadCustomerData]);

  const closeActivityDetail = useCallback((syncUrl = true) => {
    setDetailOpen(false);
    setSelectedActivity(null);
    setActivityDetail(null);

    if (syncUrl) {
      writeMobileDetailUrlState(null, "replace");
    }
  }, []);

  const openActivityDetail = useCallback(async (
    selection: ActivitySelection,
    options: { syncUrl?: boolean } = {},
  ) => {
    if (options.syncUrl ?? true) {
      writeMobileDetailUrlState(
        { view: selection.kind, id: selection.id },
        "push",
      );
    }

    setSelectedActivity(selection);
    setActivityDetail(null);
    setDetailOpen(true);
    setIsDetailLoading(true);
    setError(null);

    try {
      const [detail, nextRefundRequests] = await Promise.all([
        getCustomerActivityDetail(selection),
        selection.kind === "order"
          ? getCustomerRefundRequests()
          : Promise.resolve(null),
      ]);

      if (nextRefundRequests) {
        setRefundRequests(nextRefundRequests.data);
      }

      setActivityDetail(
        selection.kind === "order"
          ? { kind: "order", data: detail as MobileCustomerOrderDetail }
          : { kind: "ticket", data: detail as MobileCustomerTicketDetail },
      );
    } catch (nextError) {
      closeActivityDetail(false);
      writeMobileDetailUrlState(null, "replace");
      setError(getErrorMessage(nextError, t("customer.messages.detailUnavailable")));
    } finally {
      setIsDetailLoading(false);
    }
  }, [closeActivityDetail, t]);

  function handleSelectActivity(item: ActivityListItem) {
    void openActivityDetail({ kind: item.kind, id: item.id });
  }

  useEffect(() => {
    if (isLoading || hasRestoredDetailRef.current) {
      return;
    }

    hasRestoredDetailRef.current = true;
    const detailState = readMobileDetailUrlState(customerDetailUrlViews);

    if (detailState) {
      const restoreTimeoutId = window.setTimeout(() => {
        void openActivityDetail(
          { kind: detailState.view, id: detailState.id },
          { syncUrl: false },
        );
      }, 0);

      return () => window.clearTimeout(restoreTimeoutId);
    }
  }, [isLoading, openActivityDetail]);

  useEffect(() => {
    function handlePopState() {
      const detailState = readMobileDetailUrlState(customerDetailUrlViews);

      if (!detailState) {
        closeActivityDetail(false);
        return;
      }

      void openActivityDetail(
        { kind: detailState.view, id: detailState.id },
        { syncUrl: false },
      );
    }

    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, [closeActivityDetail, openActivityDetail]);

  const refreshSelectedOrder = useCallback(async (
    orderId: string,
  ): Promise<MobileCustomerOrderDetail> => {
    const [detail, nextActivity, nextRefundRequests] = await Promise.all([
      getCustomerActivityDetail({ kind: "order", id: orderId }),
      getCustomerOrdersAndTickets(),
      getCustomerRefundRequests(),
    ]);
    const orderDetail = detail as MobileCustomerOrderDetail;

    setActivity(nextActivity.data);
    setRefundRequests(nextRefundRequests.data);
    setActivityDetail({
      kind: "order",
      data: orderDetail,
    });

    return orderDetail;
  }, []);

  useEffect(() => {
    const refreshPendingPayment = () => {
      if (
        document.visibilityState !== "visible" ||
        !pendingPaymentOrderId ||
        !detailOpen ||
        selectedActivity?.kind !== "order" ||
        selectedActivity.id !== pendingPaymentOrderId
      ) {
        return;
      }

      void refreshSelectedOrder(pendingPaymentOrderId)
        .then((order) => {
          if (order.paymentStatus === "paid") {
            setPendingPaymentOrderId(null);
            setMessage(t("customer.paymentMock.paidTitle"));
          } else if (order.paymentStatus === "failed") {
            setPendingPaymentOrderId(null);
            setError(t("customer.paymentMock.failedTitle"));
          }
        })
        .catch((nextError) => {
          setError(getErrorMessage(nextError, t("common.errors.genericAction")));
        });
    };

    window.addEventListener("focus", refreshPendingPayment);
    document.addEventListener("visibilitychange", refreshPendingPayment);

    return () => {
      window.removeEventListener("focus", refreshPendingPayment);
      document.removeEventListener("visibilitychange", refreshPendingPayment);
    };
  }, [detailOpen, pendingPaymentOrderId, refreshSelectedOrder, selectedActivity, t]);

  async function handleCreatePayment(order: MobileCustomerOrderDetail) {
    const amount = getOrderBalance(order);

    if (amountToCents(amount) <= 0) {
      setError(t("customer.messages.orderSettled"));
      return;
    }

    setError(null);
    setMessage(null);
    setIsSubmittingPayment(true);

    try {
      const result = await createCustomerPayment({
        orderId: order.id,
        amount,
      });

      setPendingPaymentOrderId(order.id);
      await openExternalUrl(result.gateway.paymentUrl);
      await refreshSelectedOrder(order.id);
      setMessage(
        result.idempotent
          ? t("customer.messages.paymentAlreadyInitiated")
          : t("customer.messages.paymentCreated"),
      );
    } catch (nextError) {
      setError(getErrorMessage(nextError, t("common.errors.genericAction")));
    } finally {
      setIsSubmittingPayment(false);
    }
  }

  function openRefundSheet(order: MobileCustomerOrderDetail) {
    setError(null);
    setMessage(null);
    setRefundForm({
      orderId: order.id,
      amount: order.paidAmount,
      reason: "",
    });
    setRefundSheetOpen(true);
  }

  async function handleCreateRefund(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmittingRefund(true);

    try {
      if (!refundForm.reason.trim()) {
        throw new Error(t("customer.messages.refundReasonRequired"));
      }

      const refund = await createCustomerRefundRequest(refundForm.orderId, {
        amount: refundForm.amount,
        reason: refundForm.reason,
      });

      await refreshSelectedOrder(refund.orderId);
      setRefundRequests((current) => [
        refund,
        ...current.filter((request) => request.id !== refund.id),
      ]);
      setRefundSheetOpen(false);
      setMessage(t("customer.messages.refundRequested"));
    } catch (nextError) {
      setError(getErrorMessage(nextError, t("common.errors.genericAction")));
    } finally {
      setIsSubmittingRefund(false);
    }
  }

  async function handleCreateAppointment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmittingAppointment(true);

    try {
      const expectedAt = new Date(appointmentForm.expectedAt);

      if (!appointmentForm.address.trim()) {
        throw new Error(t("customer.messages.appointmentAddressRequired"));
      }

      if (Number.isNaN(expectedAt.getTime())) {
        throw new Error(t("customer.messages.invalidAppointmentDate"));
      }

      if (expectedAt.getTime() < getMinimumAppointmentDate().getTime()) {
        throw new Error(t("customer.messages.appointmentInPast"));
      }

      const created = await createCustomerAppointment({
        type: appointmentForm.type,
        branchId: appointmentForm.branchId || undefined,
        expectedAt: expectedAt.toISOString(),
        address: appointmentForm.address,
        notes: appointmentForm.notes,
      });

      setAppointments((current) => sortAppointments([created, ...current]));
      setAppointmentForm((current) => ({
        ...current,
        expectedAt: getDefaultExpectedAt(),
        notes: "",
      }));
      setActiveTab("appointments");
      setAppointmentSheetOpen(false);
      setMessage(t("customer.messages.appointmentCreated"));
    } catch (nextError) {
      setError(getErrorMessage(nextError, t("common.errors.genericAction")));
    } finally {
      setIsSubmittingAppointment(false);
    }
  }

  async function handleCancelAppointment(appointmentId: string) {
    setError(null);
    setMessage(null);
    setCancellingAppointmentId(appointmentId);

    try {
      const updated = await cancelCustomerAppointment(appointmentId);
      setAppointments((current) =>
        sortAppointments(current.map((appointment) => (appointment.id === updated.id ? updated : appointment))),
      );
      setMessage(t("customer.messages.appointmentCancelled"));
    } catch (nextError) {
      setError(getErrorMessage(nextError, t("common.errors.genericAction")));
    } finally {
      setCancellingAppointmentId(null);
    }
  }

  function requestCancelAppointment(appointmentId: string) {
    setError(null);
    setMessage(null);
    setConfirmTarget({ kind: "cancel-appointment", appointmentId });
  }

  function openProfileSheet() {
    setError(null);
    setMessage(null);
    setProfileForm(toProfileForm(profile));
    setProfileSheet("profile");
  }

  function openCreateContactSheet() {
    setError(null);
    setMessage(null);
    setEditingContactId(null);
    setContactForm({
      ...emptyContactForm,
      phone: profile?.account.phone ?? "",
      email: profile?.account.email ?? "",
    });
    setProfileSheet("contact");
  }

  function openEditContactSheet(contact: MobileCustomerContact) {
    setError(null);
    setMessage(null);
    setEditingContactId(contact.customerId);
    setContactForm(toContactForm(contact));
    setProfileSheet("contact");
  }

  function openCreateAddressSheet() {
    setError(null);
    setMessage(null);
    setEditingAddressId(null);
    setAddressForm({
      ...emptyAddressForm,
      country: getDeviceCountry(),
      label: t("customer.forms.defaultAddressLabel"),
      contactName: profile?.account.accountName ?? "",
      contactPhone: profile?.account.phone ?? "",
      isDefault: addressBook.length === 0,
    });
    setProfileSheet("address");
  }

  function openEditAddressSheet(address: MobileCustomerAddress) {
    setError(null);
    setMessage(null);
    setEditingAddressId(address.id);
    setAddressForm(toAddressForm(address));
    setProfileSheet("address");
  }

  async function handleLocateAddress() {
    setError(null);
    setMessage(null);
    setIsLocatingAddress(true);

    try {
      const coordinates = await getCurrentAddressCoordinates();
      setAddressForm((current) => ({
        ...current,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      }));
      setMessage(t("customer.messages.addressLocationCaptured"));
    } catch {
      setError(t("customer.messages.addressLocationUnavailable"));
    } finally {
      setIsLocatingAddress(false);
    }
  }

  function openPasswordSheet() {
    setError(null);
    setMessage(null);
    setPasswordForm(emptyPasswordForm);
    setProfileSheet("password");
  }

  async function handleUpdateProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmittingProfile(true);

    try {
      if (!profileForm.accountName.trim()) {
        throw new Error(t("customer.messages.nameRequired"));
      }

      const updated = await updateCustomerProfile(profileForm);
      setProfile(updated);
      setProfileForm(toProfileForm(updated));
      setProfileSheet(null);
      setMessage(t("customer.messages.profileSaved"));
    } catch (nextError) {
      setError(getErrorMessage(nextError, t("common.errors.genericAction")));
    } finally {
      setIsSubmittingProfile(false);
    }
  }

  async function handleSaveContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmittingContact(true);

    try {
      if (!contactForm.fullName.trim()) {
        throw new Error(t("customer.messages.contactNameRequired"));
      }

      const input = toContactInput(contactForm);
      const saved = editingContactId
        ? await updateCustomerContact(editingContactId, input)
        : await createCustomerContact(input);

      setProfile((current) => {
        if (!current) {
          return current;
        }

        const withoutSaved = current.addresses.filter(
          (contact) => contact.customerId !== saved.customerId,
        );

        return {
          ...current,
          addresses: [saved, ...withoutSaved],
        };
      });
      setProfileSheet(null);
      setEditingContactId(null);
      setMessage(
        editingContactId
          ? t("customer.messages.contactUpdated")
          : t("customer.messages.contactAdded"),
      );
    } catch (nextError) {
      setError(getErrorMessage(nextError, t("common.errors.genericAction")));
    } finally {
      setIsSubmittingContact(false);
    }
  }

  async function handleDeleteContact(customerId: string) {
    setError(null);
    setMessage(null);
    setContactActionId(`delete-${customerId}`);

    try {
      await deleteCustomerContact(customerId);
      setProfile((current) =>
        current
          ? {
              ...current,
              addresses: current.addresses.filter(
                (contact) => contact.customerId !== customerId,
              ),
            }
          : current,
      );
      setAddressBook((current) =>
        current.map((address) =>
          address.customerId === customerId
            ? { ...address, customerId: null }
            : address,
        ),
      );
      setMessage(t("customer.messages.contactDeleted"));
    } catch (nextError) {
      setError(getErrorMessage(nextError, t("common.errors.genericAction")));
    } finally {
      setContactActionId(null);
    }
  }

  function requestDeleteContact(customerId: string) {
    setError(null);
    setMessage(null);
    setConfirmTarget({ kind: "delete-contact", customerId });
  }

  async function handleSaveAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmittingAddress(true);

    try {
      if (!addressForm.label.trim() || !addressForm.addressLine1.trim()) {
        throw new Error(t("customer.messages.addressRequired"));
      }

      const input = toAddressInput(addressForm);
      const saved = editingAddressId
        ? await updateCustomerAddress(editingAddressId, input)
        : await createCustomerAddress(input);

      setAddressBook((current) => {
        const withoutSaved = current.filter((address) => address.id !== saved.id);
        const next = saved.isDefault
          ? withoutSaved.map((address) => ({ ...address, isDefault: false }))
          : withoutSaved;

        return [saved, ...next].sort((left, right) =>
          Number(right.isDefault) - Number(left.isDefault) ||
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
        );
      });
      setAppointmentForm((current) => ({
        ...current,
        addressId: current.address ? current.addressId : saved.id,
        address: current.address || formatCustomerAddress(saved),
      }));
      setProfileSheet(null);
      setEditingAddressId(null);
      setMessage(
        editingAddressId
          ? t("customer.messages.addressUpdated")
          : t("customer.messages.addressAdded"),
      );
    } catch (nextError) {
      setError(getErrorMessage(nextError, t("common.errors.genericAction")));
    } finally {
      setIsSubmittingAddress(false);
    }
  }

  async function handleDeleteAddress(addressId: string) {
    setError(null);
    setMessage(null);
    setAddressActionId(`delete-${addressId}`);

    try {
      await deleteCustomerAddress(addressId);
      setAddressBook((current) => current.filter((address) => address.id !== addressId));
      setAppointmentForm((current) =>
        current.addressId === addressId
          ? { ...current, addressId: CUSTOM_APPOINTMENT_ADDRESS_ID }
          : current,
      );
      setMessage(t("customer.messages.addressDeleted"));
    } catch (nextError) {
      setError(getErrorMessage(nextError, t("common.errors.genericAction")));
    } finally {
      setAddressActionId(null);
    }
  }

  function requestDeleteAddress(addressId: string) {
    setError(null);
    setMessage(null);
    setConfirmTarget({ kind: "delete-address", addressId });
  }

  async function handleConfirmDestructiveAction() {
    const target = confirmTarget;

    if (!target) {
      return;
    }

    if (target.kind === "cancel-appointment") {
      await handleCancelAppointment(target.appointmentId);
    } else if (target.kind === "delete-address") {
      await handleDeleteAddress(target.addressId);
    } else {
      await handleDeleteContact(target.customerId);
    }

    setConfirmTarget(null);
  }

  async function handleSetDefaultAddress(addressId: string) {
    setError(null);
    setMessage(null);
    setAddressActionId(`default-${addressId}`);

    try {
      const updated = await setDefaultCustomerAddress(addressId);
      setAddressBook((current) =>
        current.map((address) =>
          address.id === updated.id
            ? updated
            : { ...address, isDefault: false },
        ),
      );
      setAppointmentForm((current) => ({
        ...current,
        addressId: updated.id,
        address: formatCustomerAddress(updated),
      }));
      setMessage(t("customer.messages.defaultAddressUpdated"));
    } catch (nextError) {
      setError(getErrorMessage(nextError, t("common.errors.genericAction")));
    } finally {
      setAddressActionId(null);
    }
  }

  async function handleChangePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError(t("customer.messages.passwordMismatch"));
      return;
    }

    setIsSubmittingPassword(true);

    try {
      await changeCustomerPassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm(emptyPasswordForm);
      setProfileSheet(null);
      setMessage(t("customer.messages.passwordChangedOtherDevices"));
    } catch (nextError) {
      setError(getErrorMessage(nextError, t("common.errors.genericAction")));
    } finally {
      setIsSubmittingPassword(false);
    }
  }

  function openAppointmentSheet() {
    setError(null);
    setMessage(null);
    setAppointmentSheetOpen(true);
  }

  if (isLoading) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-5">
        <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
          <Loader2 className="size-4 animate-spin text-blue-600" aria-hidden="true" />
          {t("customer.home.loading")}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-[calc(104px+env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))]">
      <WorkspaceHeader
        isLoggingOut={isLoggingOut}
        logoutLabel={t("auth.logout")}
        subtitle={
          profile?.account.accountName ??
          authContext?.displayName ??
          t("customer.home.defaultCustomer")
        }
        title={t("customer.home.clientSpace")}
        onLogout={onLogout ?? (() => setActiveTab("profile"))}
      />
      <span className="sr-only" aria-live="polite">
        {isRefreshing ? t("common.refresh") : ""}
      </span>

      {error && !appointmentSheetOpen ? <AlertMessage tone="error" message={error} /> : null}
      {message ? <AlertMessage tone="success" message={message} /> : null}

      {activeTab === "resume" ? (
        <CustomerOverviewView
          activityItems={activityItems}
          appointments={appointments}
          currency={tenantCurrency}
          onOpenCreateAppointment={openAppointmentSheet}
          onSelectActivity={(item) => void handleSelectActivity(item)}
          onShowAppointments={() => setActiveTab("appointments")}
          onShowOrders={() => setActiveTab("orders")}
        />
      ) : null}

      {activeTab === "orders" ? (
        <ActivityView
          activityItems={filteredActivityItems}
          activeFilter={activityFilter}
          currency={tenantCurrency}
          selectedActivity={selectedActivity}
          totalCount={activityItems.length}
          onFilterChange={setActivityFilter}
          onSelectActivity={(item) => void handleSelectActivity(item)}
        />
      ) : null}

      {activeTab === "appointments" ? (
        <AppointmentsView
          appointments={appointments}
          cancellingAppointmentId={cancellingAppointmentId}
          onCancelAppointment={requestCancelAppointment}
          onOpenCreateAppointment={openAppointmentSheet}
        />
      ) : null}

      {activeTab === "profile" ? (
        <ProfileView
          addressActionId={addressActionId}
          addressBook={addressBook}
          contactActionId={contactActionId}
          profile={profile}
          onCreateAddress={openCreateAddressSheet}
          onCreateContact={openCreateContactSheet}
          onDeleteAddress={requestDeleteAddress}
          onDeleteContact={requestDeleteContact}
          onEditAddress={openEditAddressSheet}
          onEditContact={openEditContactSheet}
          onEditProfile={openProfileSheet}
          onOpenPassword={openPasswordSheet}
          onSetDefaultAddress={(addressId) => void handleSetDefaultAddress(addressId)}
        />
      ) : null}

      <ActivityDetailSheet
        currency={tenantCurrency}
        detail={activityDetail}
        refundRequests={refundRequests}
        isPaymentSubmitting={isSubmittingPayment}
        isLoading={isDetailLoading}
        item={activityItems.find(
          (item) => item.kind === selectedActivity?.kind && item.id === selectedActivity.id,
        ) ?? null}
        open={detailOpen}
        onCreatePayment={(order) => void handleCreatePayment(order)}
        onOpenChange={(open) => {
          if (!open) {
            closeActivityDetail();
          } else {
            setDetailOpen(true);
          }
        }}
        onOpenRefund={openRefundSheet}
      />

      <ConfirmSheet
        cancelLabel={t("common.cancel")}
        confirmLabel={getConfirmLabel(t, confirmTarget)}
        description={getConfirmDescription(t, confirmTarget)}
        isSubmitting={isConfirmSubmitting}
        open={Boolean(confirmTarget)}
        title={getConfirmTitle(t, confirmTarget)}
        onConfirm={() => void handleConfirmDestructiveAction()}
        onOpenChange={(open) => {
          if (!open && !isConfirmSubmitting) {
            setConfirmTarget(null);
          }
        }}
      />

      <AppointmentFormSheet
        addressBook={addressBook}
        branches={branches}
        error={appointmentSheetOpen ? error : null}
        form={appointmentForm}
        isSubmitting={isSubmittingAppointment}
        open={appointmentSheetOpen}
        onFormChange={setAppointmentForm}
        onOpenChange={(open) => {
          setAppointmentSheetOpen(open);

          if (!open) {
            setError(null);
          }
        }}
        onSubmit={handleCreateAppointment}
      />

      <RefundRequestSheet
        currency={tenantCurrency}
        error={refundSheetOpen ? error : null}
        form={refundForm}
        isSubmitting={isSubmittingRefund}
        open={refundSheetOpen}
        onFormChange={setRefundForm}
        onOpenChange={(open) => {
          setRefundSheetOpen(open);

          if (!open) {
            setError(null);
          }
        }}
        onSubmit={handleCreateRefund}
      />

      <ProfileFormSheet
        error={profileSheet === "profile" ? error : null}
        form={profileForm}
        isSubmitting={isSubmittingProfile}
        open={profileSheet === "profile"}
        onFormChange={setProfileForm}
        onOpenChange={(open) => {
          setProfileSheet(open ? "profile" : null);

          if (!open) {
            setError(null);
          }
        }}
        onSubmit={handleUpdateProfile}
      />

      <AddressFormSheet
        error={profileSheet === "address" ? error : null}
        form={addressForm}
        isEditing={Boolean(editingAddressId)}
        isLocating={isLocatingAddress}
        isSubmitting={isSubmittingAddress}
        open={profileSheet === "address"}
        onFormChange={setAddressForm}
        onLocate={() => void handleLocateAddress()}
        onOpenChange={(open) => {
          setProfileSheet(open ? "address" : null);

          if (!open) {
            setEditingAddressId(null);
            setIsLocatingAddress(false);
            setError(null);
          }
        }}
        onSubmit={handleSaveAddress}
      />

      <ContactFormSheet
        error={profileSheet === "contact" ? error : null}
        form={contactForm}
        isEditing={Boolean(editingContactId)}
        isSubmitting={isSubmittingContact}
        open={profileSheet === "contact"}
        onFormChange={setContactForm}
        onOpenChange={(open) => {
          setProfileSheet(open ? "contact" : null);

          if (!open) {
            setEditingContactId(null);
            setError(null);
          }
        }}
        onSubmit={handleSaveContact}
      />

      <PasswordFormSheet
        error={profileSheet === "password" ? error : null}
        form={passwordForm}
        isSubmitting={isSubmittingPassword}
        open={profileSheet === "password"}
        onFormChange={setPasswordForm}
        onOpenChange={(open) => {
          setProfileSheet(open ? "password" : null);

          if (!open) {
            setError(null);
          }
        }}
        onSubmit={handleChangePassword}
      />

      <CustomerTabBar activeTab={activeTab} onChange={setActiveTab} />
    </main>
  );
}

function CustomerTabBar({
  activeTab,
  onChange,
}: {
  activeTab: CustomerTab;
  onChange: (tab: CustomerTab) => void;
}) {
  const { t } = useTranslation();
  const tabs = (Object.entries(tabIcons) as [CustomerTab, typeof Home][]).map(
    ([value, icon]) => ({
      icon,
      label: t(`customer.tabs.${value}` as TranslationKey),
      value,
    }),
  );

  return (
    <nav
      aria-label={t("common.mainNavigation")}
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md border-t border-slate-200 bg-[#F7F9FC]/95 px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur"
    >
      <div className="grid grid-cols-4 gap-2 rounded-md border border-slate-200 bg-white p-1 shadow-sm">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;

          return (
            <button
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-md px-1 text-xs font-medium transition ${
                isActive ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
              key={tab.value}
              type="button"
              onClick={() => onChange(tab.value)}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function AlertMessage({ message, tone }: { message: string; tone: "error" | "success" }) {
  return (
    <p
      className={`mb-4 rounded-md border px-3 py-2 text-sm ${
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}
    >
      {message}
    </p>
  );
}

function CustomerOverviewView({
  activityItems,
  appointments,
  currency,
  onOpenCreateAppointment,
  onSelectActivity,
  onShowAppointments,
  onShowOrders,
}: {
  activityItems: ActivityListItem[];
  appointments: MobileCustomerAppointment[];
  currency: string;
  onOpenCreateAppointment: () => void;
  onSelectActivity: (item: ActivityListItem) => void;
  onShowAppointments: () => void;
  onShowOrders: () => void;
}) {
  const { locale, t } = useTranslation();
  const intlLocale = getIntlLocale(locale);
  const activeItems = filterActivityItems(activityItems, "active");
  const openAppointments = appointments.filter(isOpenAppointment);
  const readyCount = getReadyForPickupCount(activityItems);
  const nextItem = getNextOverviewItem(activityItems, appointments);
  const hasOverviewData =
    activeItems.length > 0 || openAppointments.length > 0 || readyCount > 0;

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              {t("customer.overview.next")}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {t("customer.overview.nextSubtitle")}
            </p>
          </div>
          <CalendarClock className="size-5 text-blue-600" aria-hidden="true" />
        </div>

        {nextItem ? (
          nextItem.kind === "activity" ? (
            <button
              className="mt-4 w-full rounded-md border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-blue-300"
              type="button"
              onClick={() => onSelectActivity(nextItem.activity)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">
                    {nextItem.activity.title}
                  </p>
                  <p className="mt-1 truncate text-sm text-slate-600">
                    {nextItem.activity.subtitle}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {nextItem.activity.kind === "order"
                      ? t("customer.detail.totalInline", {
                          amount: formatTenantMoney(
                            nextItem.activity.amount,
                            intlLocale,
                            currency,
                          ),
                        })
                      : nextItem.activity.expectedAt
                        ? t("customer.detail.pickupInline", {
                            date: formatDateTime(
                              nextItem.activity.expectedAt,
                              intlLocale,
                            ),
                          })
                        : formatDate(nextItem.activity.createdAt, intlLocale)}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
              </div>
            </button>
          ) : (
            <button
              className="mt-4 w-full rounded-md border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-blue-300"
              type="button"
              onClick={onShowAppointments}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">
                    {t("customer.appointments.title")}
                  </p>
                  <p className="mt-1 truncate text-sm text-slate-600">
                    {nextItem.appointment.address}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDateTime(nextItem.appointment.expectedAt, intlLocale)}
                  </p>
                </div>
                <StatusBadge
                  view={getAppointmentStatusView(t, nextItem.appointment.status)}
                />
              </div>
            </button>
          )
        ) : (
          <div className="mt-4">
            <EmptyState
              icon={CalendarClock}
              title={t("customer.overview.noPendingTitle")}
              body={t("customer.overview.noPendingBody")}
            />
          </div>
        )}
      </section>

      <section className="grid grid-cols-3 gap-2">
        <OverviewMetric
          icon={ReceiptText}
          label={t("customer.overview.active")}
          value={activeItems.length}
        />
        <OverviewMetric
          icon={TicketCheck}
          label={t("customer.overview.ready")}
          value={readyCount}
        />
        <OverviewMetric
          icon={CalendarClock}
          label={t("customer.home.appointments")}
          value={openAppointments.length}
        />
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-2">
          <Button className="h-11" type="button" onClick={onOpenCreateAppointment}>
            <Plus className="size-4" aria-hidden="true" />
            {t("customer.actions.newAppointment")}
          </Button>
          <Button className="h-11" type="button" variant="outline" onClick={onShowOrders}>
            <ReceiptText className="size-4" aria-hidden="true" />
            {t("customer.overview.viewTracking")}
          </Button>
        </div>
        {!hasOverviewData ? (
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {t("customer.overview.emptyHint")}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function OverviewMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ReceiptText;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <Icon className="size-4 text-blue-600" aria-hidden="true" />
        <span className="text-lg font-semibold tabular-nums text-slate-950">
          {value}
        </span>
      </div>
      <p className="mt-2 min-h-8 text-xs font-medium leading-4 text-slate-600">
        {label}
      </p>
    </div>
  );
}

function ActivityView({
  activeFilter,
  activityItems,
  currency,
  selectedActivity,
  totalCount,
  onFilterChange,
  onSelectActivity,
}: {
  activeFilter: ActivityStatusFilter;
  activityItems: ActivityListItem[];
  currency: string;
  selectedActivity: ActivitySelection | null;
  totalCount: number;
  onFilterChange: (filter: ActivityStatusFilter) => void;
  onSelectActivity: (item: ActivityListItem) => void;
}) {
  const { locale, t } = useTranslation();
  const intlLocale = getIntlLocale(locale);

  return (
    <div className="space-y-4">
      <div
        className="mobile-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        role="tablist"
        aria-label={t("customer.filters.label")}
      >
        {activityStatusFilters.map((filter) => {
          const isActive = activeFilter === filter;

          return (
            <button
              aria-selected={isActive}
              className={`h-9 shrink-0 rounded-full px-4 text-sm font-semibold transition ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-900/20"
                  : "bg-transparent text-slate-600 hover:bg-white"
              }`}
              key={filter}
              role="tab"
              type="button"
              onClick={() => onFilterChange(filter)}
            >
              {t(`customer.filters.${filter}` as TranslationKey)}
            </button>
          );
        })}
      </div>

      {activityItems.length ? (
        <section className="space-y-3">
          {activityItems.map((item) => {
            const selected = selectedActivity?.kind === item.kind && selectedActivity.id === item.id;

            return (
              <button
                className={`w-full rounded-md border bg-white p-4 text-left shadow-sm transition ${
                  selected ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200 hover:border-blue-300"
                }`}
                key={`${item.kind}-${item.id}`}
                type="button"
                aria-haspopup="dialog"
                onClick={() => onSelectActivity(item)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <ActivityIcon kind={item.kind} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">{item.title}</p>
                      <p className="mt-1 truncate text-sm text-slate-600">{item.subtitle}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDate(item.createdAt, intlLocale)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge
                      view={
                        item.kind === "order"
                          ? getOrderStatusView(t, item.status)
                          : getTicketStatusView(t, item.status)
                      }
                    />
                    <ChevronRight className="size-4 text-slate-400" aria-hidden="true" />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-end gap-2 pl-14">
                  {item.kind === "order" ? (
                    <span className="text-xs font-medium text-slate-500">
                      {t("customer.detail.totalInline", {
                        amount: formatTenantMoney(
                          item.amount,
                          intlLocale,
                          currency,
                        ),
                      })}
                    </span>
                  ) : item.expectedAt ? (
                    <span className="text-xs font-medium text-slate-500">
                      {t("customer.detail.pickupInline", {
                        date: formatDateTime(item.expectedAt, intlLocale),
                      })}
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </section>
      ) : totalCount ? (
        <EmptyState
          icon={ReceiptText}
          title={t("customer.empty.noFilteredTrackingTitle")}
          body={t("customer.empty.noFilteredTrackingBody")}
        />
      ) : (
        <EmptyState
          icon={ReceiptText}
          title={t("customer.empty.noOrdersTitle")}
          body={t("customer.empty.noOrdersBody")}
        />
      )}
    </div>
  );
}

function ActivityDetailSheet({
  currency,
  detail,
  isPaymentSubmitting,
  isLoading,
  item,
  onCreatePayment,
  open,
  onOpenChange,
  onOpenRefund,
  refundRequests,
}: {
  currency: string;
  detail: ActivityDetail | null;
  isPaymentSubmitting: boolean;
  isLoading: boolean;
  item: ActivityListItem | null;
  onCreatePayment: (order: MobileCustomerOrderDetail) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenRefund: (order: MobileCustomerOrderDetail) => void;
  refundRequests: MobileRefundRequest[];
}) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-[90dvh] p-5">
        <SheetHeader className="pr-8 text-left">
          <SheetTitle>{item?.title ?? t("customer.detail.defaultTitle")}</SheetTitle>
          <SheetDescription>
            {item?.subtitle ?? t("customer.detail.defaultSubtitle")}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <Loader2 className="size-4 animate-spin text-blue-600" aria-hidden="true" />
              {t("customer.detail.loading")}
            </div>
          </div>
        ) : detail ? (
          <ActivityDetailPanel
            currency={currency}
            detail={detail}
            isPaymentSubmitting={isPaymentSubmitting}
            onCreatePayment={onCreatePayment}
            onOpenRefund={onOpenRefund}
            refundRequests={refundRequests}
          />
        ) : (
          <p className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            {t("customer.detail.selectPrompt")}
          </p>
        )}

        <SheetFooter className="sticky bottom-0 -mx-5 mt-5 border-t border-slate-200 bg-white px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
          <SheetClose asChild>
            <Button className="h-11 w-full" type="button" variant="outline">
              {t("common.close")}
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ActivityDetailPanel({
  currency,
  detail,
  isPaymentSubmitting,
  onCreatePayment,
  onOpenRefund,
  refundRequests,
}: {
  currency: string;
  detail: ActivityDetail;
  isPaymentSubmitting: boolean;
  onCreatePayment: (order: MobileCustomerOrderDetail) => void;
  onOpenRefund: (order: MobileCustomerOrderDetail) => void;
  refundRequests: MobileRefundRequest[];
}) {
  const { locale, t } = useTranslation();
  const intlLocale = getIntlLocale(locale);

  if (detail.kind === "order") {
    const orderRefundRequests = refundRequests.filter(
      (refundRequest) => refundRequest.orderId === detail.data.id,
    );
    const balance = getOrderBalance(detail.data);
    const canPay =
      amountToCents(balance) > 0 &&
      detail.data.paymentStatus !== "paid" &&
      detail.data.paymentStatus !== "refunded";
    const canRefund = amountToCents(detail.data.paidAmount) > 0;
    const formatMoney = (value: string | number) =>
      formatTenantMoney(value, intlLocale, currency);

    return (
      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-950">
              {t("customer.detail.orderPrefix", { id: detail.data.id.slice(-6).toUpperCase() })}
            </p>
            <p className="mt-1 text-sm text-slate-600">{detail.data.orderType}</p>
          </div>
          <StatusBadge view={getOrderStatusView(t, detail.data.status)} />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <DetailTerm label={t("customer.detail.total")} value={formatMoney(detail.data.totalAmount)} />
          <DetailTerm label={t("customer.detail.paid")} value={formatMoney(detail.data.paidAmount)} />
          <DetailTerm label={t("customer.detail.payment")} value={detail.data.paymentStatus} />
          <DetailTerm
            label={t("customer.detail.created")}
            value={formatDateTime(detail.data.createdAt, intlLocale)}
          />
        </dl>

        {detail.data.notes ? (
          <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
            {detail.data.notes}
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            className="h-11"
            disabled={!canPay || isPaymentSubmitting}
            type="button"
            onClick={() => onCreatePayment(detail.data)}
          >
            {isPaymentSubmitting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <CreditCard className="size-4" aria-hidden="true" />
            )}
            {t("customer.actions.pay")}
          </Button>
          <Button
            className="h-11"
            disabled={!canRefund}
            type="button"
            variant="outline"
            onClick={() => onOpenRefund(detail.data)}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            {t("customer.actions.refund")}
          </Button>
        </div>

        <ItemList
          emptyLabel={t("customer.detail.noItems")}
          title={t("customer.detail.articles")}
          items={detail.data.items.map((item) => ({
            id: item.id,
            title: item.itemName,
            subtitle: `${item.quantity} x ${formatMoney(item.unitAmount)}`,
            amount: formatMoney(item.lineAmount),
          }))}
        />

        <RefundRequestList
          currency={currency}
          refundRequests={orderRefundRequests}
        />
      </section>
    );
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">
            {detail.data.ticketNo
              ? t("customer.detail.ticketPrefix", { id: detail.data.ticketNo })
              : t("customer.detail.ticketFallback")}
          </p>
          <p className="mt-1 text-sm text-slate-600">{detail.data.ticketType}</p>
        </div>
        <StatusBadge view={getTicketStatusView(t, detail.data.ticketStatus)} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <DetailTerm label={t("customer.detail.priority")} value={detail.data.priority} />
        <DetailTerm
          label={t("customer.detail.pickup")}
          value={formatDateTime(detail.data.expectedPickupAt, intlLocale)}
        />
        <DetailTerm
          label={t("customer.detail.completed")}
          value={formatDateTime(detail.data.completedAt, intlLocale)}
        />
        <DetailTerm
          label={t("customer.detail.created")}
          value={formatDateTime(detail.data.createdAt, intlLocale)}
        />
      </dl>

      {detail.data.remark ? (
        <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
          {detail.data.remark}
        </p>
      ) : null}

      <ItemList
        emptyLabel={t("customer.detail.noItems")}
        title={t("customer.detail.articles")}
        items={detail.data.items.map((item) => ({
          id: item.id,
          title: item.itemName,
          subtitle: `${item.quantity} x ${formatTenantMoney(
            item.unitAmount,
            intlLocale,
            currency,
          )}${item.itemCategory ? ` - ${item.itemCategory}` : ""}`,
          amount: formatTenantMoney(item.lineAmount, intlLocale, currency),
          status: item.itemStatus,
        }))}
      />
    </section>
  );
}

function RefundRequestList({
  currency,
  refundRequests,
}: {
  currency: string;
  refundRequests: MobileRefundRequest[];
}) {
  const { locale, t } = useTranslation();
  const intlLocale = getIntlLocale(locale);

  return (
    <div className="mt-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {t("customer.detail.refundRequests")}
      </p>
      {refundRequests.length ? (
        <div className="mt-3 space-y-3">
          {refundRequests.map((refundRequest) => {
            const decision =
              refundRequest.rejectionReason ??
              refundRequest.failedReason ??
              (refundRequest.refundedAt
                ? formatDateTime(refundRequest.refundedAt, intlLocale)
                : refundRequest.approvedAt
                  ? formatDateTime(refundRequest.approvedAt, intlLocale)
                  : null);

            return (
              <div
                className="rounded-md border border-slate-200 bg-slate-50 p-3"
                key={refundRequest.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold tabular-nums text-slate-950">
                      {formatTenantMoney(refundRequest.amount, intlLocale, currency)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {t("customer.detail.refundCreated")}:{" "}
                      {formatDateTime(refundRequest.createdAt, intlLocale)}
                    </p>
                  </div>
                  <StatusBadge view={getRefundStatusView(t, refundRequest.status)} />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  <span className="font-medium text-slate-900">
                    {t("customer.detail.refundReason")}:
                  </span>{" "}
                  {refundRequest.reason}
                </p>
                {decision ? (
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {t("customer.detail.refundDecision")}: {decision}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 rounded-md border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          {t("customer.detail.noRefundRequests")}
        </p>
      )}
    </div>
  );
}

function DetailTerm({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 break-words font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

function ItemList({
  emptyLabel,
  items,
  title,
}: {
  emptyLabel: string;
  items: { id: string; title: string; subtitle: string; amount: string; status?: string }[];
  title: string;
}) {
  return (
    <div className="mt-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </p>
      {items.length ? (
        <div className="mt-3 divide-y divide-slate-100 rounded-md border border-slate-200">
          {items.map((item) => (
            <div className="flex items-start justify-between gap-3 p-3" key={item.id}>
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-slate-950">{item.title}</p>
                <p className="mt-1 break-words text-xs text-slate-500">{item.subtitle}</p>
                {item.status ? <p className="mt-1 text-xs text-slate-500">{item.status}</p> : null}
              </div>
              <p className="shrink-0 text-sm font-semibold text-slate-950">{item.amount}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          {emptyLabel}
        </p>
      )}
    </div>
  );
}

function AppointmentsView({
  appointments,
  cancellingAppointmentId,
  onCancelAppointment,
  onOpenCreateAppointment,
}: {
  appointments: MobileCustomerAppointment[];
  cancellingAppointmentId: string | null;
  onCancelAppointment: (appointmentId: string) => void;
  onOpenCreateAppointment: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-blue-50 text-blue-700">
            <Plus className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-950">
              {t("customer.appointments.title")}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {t("customer.appointments.subtitle")}
            </p>
          </div>
          <Button className="h-11 shrink-0" type="button" onClick={onOpenCreateAppointment}>
            <Plus className="size-4" aria-hidden="true" />
            {t("customer.appointments.new")}
          </Button>
        </div>
      </section>

      {appointments.length ? (
        <section className="space-y-3">
          {appointments.map((appointment) => (
            <AppointmentCard
              appointment={appointment}
              cancellingAppointmentId={cancellingAppointmentId}
              key={appointment.id}
              onCancelAppointment={onCancelAppointment}
            />
          ))}
        </section>
      ) : (
        <EmptyState
          icon={CalendarClock}
          title={t("customer.empty.noAppointmentsTitle")}
          body={t("customer.empty.noAppointmentsBody")}
        />
      )}
    </div>
  );
}

function AppointmentFormSheet({
  addressBook,
  branches,
  error,
  form,
  isSubmitting,
  open,
  onFormChange,
  onOpenChange,
  onSubmit,
}: {
  addressBook: MobileCustomerAddress[];
  branches: MobileCustomerBranchOption[];
  error: string | null;
  form: AppointmentFormState;
  isSubmitting: boolean;
  open: boolean;
  onFormChange: React.Dispatch<React.SetStateAction<AppointmentFormState>>;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-[92dvh] p-5">
        <SheetHeader className="pr-8 text-left">
          <SheetTitle>{t("customer.appointments.newTitle")}</SheetTitle>
          <SheetDescription>{t("customer.appointments.newDescription")}</SheetDescription>
        </SheetHeader>

        {error ? <AlertMessage tone="error" message={error} /> : null}

        <AppointmentForm
          addressBook={addressBook}
          branches={branches}
          form={form}
          isSubmitting={isSubmitting}
          onFormChange={onFormChange}
          onSubmit={onSubmit}
        />
      </SheetContent>
    </Sheet>
  );
}

function AppointmentForm({
  addressBook,
  branches,
  form,
  isSubmitting,
  onFormChange,
  onSubmit,
}: {
  addressBook: MobileCustomerAddress[];
  branches: MobileCustomerBranchOption[];
  form: AppointmentFormState;
  isSubmitting: boolean;
  onFormChange: React.Dispatch<React.SetStateAction<AppointmentFormState>>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useTranslation();
  const selectedAddressId = addressBook.some((address) => address.id === form.addressId)
    ? form.addressId
    : CUSTOM_APPOINTMENT_ADDRESS_ID;

  function handleAddressSourceChange(addressId: string) {
    if (addressId === CUSTOM_APPOINTMENT_ADDRESS_ID) {
      onFormChange((current) => ({
        ...current,
        addressId,
      }));
      return;
    }

    const selectedAddress = addressBook.find((address) => address.id === addressId);

    onFormChange((current) => ({
      ...current,
      addressId,
      address: selectedAddress ? formatCustomerAddress(selectedAddress) : current.address,
    }));
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="sr-only">{t("customer.appointments.typeLegend")}</legend>
        {(["pickup", "dropoff"] as const).map((type) => (
          <button
            className={`min-h-12 rounded-md border px-3 text-sm font-medium transition ${
              form.type === type
                ? "border-blue-600 bg-blue-50 text-blue-900"
                : "border-slate-200 bg-white text-slate-700"
            }`}
            key={type}
            type="button"
            onClick={() => onFormChange((current) => ({ ...current, type }))}
          >
            {t(appointmentTypeKeys[type])}
          </button>
        ))}
      </fieldset>

      {branches.length > 1 ? (
        <div className="space-y-2">
          <Label htmlFor="appointment-branch">{t("customer.appointments.branch")}</Label>
          <Select
            value={form.branchId}
            onValueChange={(branchId) =>
              onFormChange((current) => ({ ...current, branchId }))
            }
          >
            <SelectTrigger className="h-12 text-base" id="appointment-branch">
              <SelectValue placeholder={t("customer.appointments.branchPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.address ? `${branch.name} - ${branch.address}` : branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="appointment-expected-at">{t("customer.forms.expectedAt")}</Label>
        <Input
          className="h-12 text-base"
          id="appointment-expected-at"
          min={getMinimumAppointmentDateValue()}
          type="datetime-local"
          value={form.expectedAt}
          onChange={(event) =>
            onFormChange((current) => ({ ...current, expectedAt: event.target.value }))
          }
        />
      </div>

      {addressBook.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor="appointment-address-source">
            {t("customer.appointments.addressSource")}
          </Label>
          <Select value={selectedAddressId} onValueChange={handleAddressSourceChange}>
            <SelectTrigger className="h-12 text-base" id="appointment-address-source">
              <SelectValue placeholder={t("customer.appointments.addressSourcePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {addressBook.map((address) => (
                <SelectItem key={address.id} value={address.id}>
                  {[address.label, formatCustomerAddress(address)].filter(Boolean).join(" - ")}
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM_APPOINTMENT_ADDRESS_ID}>
                {t("customer.appointments.customAddress")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="appointment-address">{t("customer.forms.address")}</Label>
        <Textarea
          className="min-h-24 resize-none text-base"
          id="appointment-address"
          placeholder={t("customer.appointments.addressPlaceholder")}
          value={form.address}
          onChange={(event) =>
            onFormChange((current) => ({
              ...current,
              addressId: CUSTOM_APPOINTMENT_ADDRESS_ID,
              address: event.target.value,
            }))
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="appointment-notes">{t("customer.forms.notes")}</Label>
        <Textarea
          className="min-h-20 resize-none text-base"
          id="appointment-notes"
          placeholder={t("customer.appointments.notesPlaceholder")}
          value={form.notes}
          onChange={(event) => onFormChange((current) => ({ ...current, notes: event.target.value }))}
        />
      </div>

      <SheetFooter className="sticky bottom-0 -mx-5 mt-5 border-t border-slate-200 bg-white px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
        <Button className="h-12 w-full" disabled={isSubmitting} type="submit">
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <CalendarClock className="size-4" aria-hidden="true" />
          )}
          {t("customer.appointments.create")}
        </Button>
      </SheetFooter>
    </form>
  );
}

function RefundRequestSheet({
  currency,
  error,
  form,
  isSubmitting,
  open,
  onFormChange,
  onOpenChange,
  onSubmit,
}: {
  currency: string;
  error: string | null;
  form: RefundFormState;
  isSubmitting: boolean;
  open: boolean;
  onFormChange: React.Dispatch<React.SetStateAction<RefundFormState>>;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const { locale, t } = useTranslation();
  const intlLocale = getIntlLocale(locale);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-[92dvh] p-5">
        <SheetHeader className="pr-8 text-left">
          <SheetTitle>{t("customer.refund.title")}</SheetTitle>
          <SheetDescription>{t("customer.refund.description")}</SheetDescription>
        </SheetHeader>

        {error ? <AlertMessage tone="error" message={error} /> : null}

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="refund-amount">{t("customer.forms.refundAmount")}</Label>
            <Input
              className="h-12 text-base"
              id="refund-amount"
              inputMode="decimal"
              placeholder={formatTenantMoney(0, intlLocale, currency)}
              value={form.amount}
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  amount: event.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="refund-reason">{t("customer.forms.refundReason")}</Label>
            <Textarea
              className="min-h-24 resize-none text-base"
              id="refund-reason"
              placeholder={t("customer.refund.placeholder")}
              value={form.reason}
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  reason: event.target.value,
                }))
              }
            />
          </div>

          <SheetFooter className="sticky bottom-0 -mx-5 mt-5 border-t border-slate-200 bg-white px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
            <Button className="h-12 w-full" disabled={isSubmitting} type="submit">
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RotateCcw className="size-4" aria-hidden="true" />
              )}
              {t("customer.refund.send")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function AppointmentCard({
  appointment,
  cancellingAppointmentId,
  onCancelAppointment,
}: {
  appointment: MobileCustomerAppointment;
  cancellingAppointmentId: string | null;
  onCancelAppointment: (appointmentId: string) => void;
}) {
  const { locale, t } = useTranslation();
  const intlLocale = getIntlLocale(locale);
  const isCancelling = cancellingAppointmentId === appointment.id;

  return (
    <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-950">
            {t(appointmentTypeKeys[appointment.type])}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {formatDateTime(appointment.expectedAt, intlLocale)}
          </p>
        </div>
        <StatusBadge view={getAppointmentStatusView(t, appointment.status)} />
      </div>

      <div className="mt-4 flex gap-3 text-sm text-slate-600">
        <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
        <p className="break-words leading-6">{appointment.address}</p>
      </div>

      {appointment.notes ? (
        <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
          {appointment.notes}
        </p>
      ) : null}

      {appointment.status === "pending" ? (
        <Button
          className="mt-4 h-11 w-full"
          disabled={isCancelling}
          type="button"
          variant="outline"
          onClick={() => onCancelAppointment(appointment.id)}
        >
          {isCancelling ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <XCircle className="size-4" aria-hidden="true" />
          )}
          {t("common.cancel")}
        </Button>
      ) : null}
    </article>
  );
}

function ProfileFormSheet({
  error,
  form,
  isSubmitting,
  open,
  onFormChange,
  onOpenChange,
  onSubmit,
}: {
  error: string | null;
  form: CustomerProfileFormState;
  isSubmitting: boolean;
  open: boolean;
  onFormChange: React.Dispatch<React.SetStateAction<CustomerProfileFormState>>;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-[86dvh] p-5">
        <SheetHeader className="pr-8 text-left">
          <SheetTitle>{t("customer.profile.editTitle")}</SheetTitle>
          <SheetDescription>{t("customer.profile.editDescription")}</SheetDescription>
        </SheetHeader>

        {error ? <AlertMessage tone="error" message={error} /> : null}

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="profile-name">{t("customer.forms.name")}</Label>
            <Input
              className="h-12 text-base"
              id="profile-name"
              value={form.accountName}
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  accountName: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-phone">{t("customer.forms.phone")}</Label>
            <Input
              className="h-12 text-base"
              id="profile-phone"
              inputMode="tel"
              value={form.phone}
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-email">{t("customer.forms.email")}</Label>
            <Input
              className="h-12 text-base"
              id="profile-email"
              inputMode="email"
              value={form.email}
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
            />
          </div>

          <SheetFooter className="sticky bottom-0 -mx-5 mt-5 border-t border-slate-200 bg-white px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
            <Button className="h-12 w-full" disabled={isSubmitting} type="submit">
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="size-4" aria-hidden="true" />
              )}
              {t("common.save")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function ContactFormSheet({
  error,
  form,
  isEditing,
  isSubmitting,
  open,
  onFormChange,
  onOpenChange,
  onSubmit,
}: {
  error: string | null;
  form: CustomerContactFormState;
  isEditing: boolean;
  isSubmitting: boolean;
  open: boolean;
  onFormChange: React.Dispatch<React.SetStateAction<CustomerContactFormState>>;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-[90dvh] p-5">
        <SheetHeader className="pr-8 text-left">
          <SheetTitle>
            {isEditing ? t("customer.profile.contactEditTitle") : t("customer.profile.contactNewTitle")}
          </SheetTitle>
          <SheetDescription>{t("customer.profile.contactDescription")}</SheetDescription>
        </SheetHeader>

        {error ? <AlertMessage tone="error" message={error} /> : null}

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="contact-full-name">{t("customer.forms.name")}</Label>
            <Input
              className="h-12 text-base"
              id="contact-full-name"
              value={form.fullName}
              onChange={(event) =>
                onFormChange((current) => ({ ...current, fullName: event.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="contact-phone">{t("customer.forms.phone")}</Label>
              <Input
                className="h-12 text-base"
                id="contact-phone"
                inputMode="tel"
                value={form.phone}
                onChange={(event) =>
                  onFormChange((current) => ({ ...current, phone: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-email">{t("customer.forms.email")}</Label>
              <Input
                className="h-12 text-base"
                id="contact-email"
                inputMode="email"
                value={form.email}
                onChange={(event) =>
                  onFormChange((current) => ({ ...current, email: event.target.value }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-relationship">{t("customer.forms.relationship")}</Label>
            <Input
              className="h-12 text-base"
              id="contact-relationship"
              value={form.relationship}
              onChange={(event) =>
                onFormChange((current) => ({ ...current, relationship: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-address">{t("customer.forms.address")}</Label>
            <Textarea
              className="min-h-24 resize-none text-base"
              id="contact-address"
              value={form.address}
              onChange={(event) =>
                onFormChange((current) => ({ ...current, address: event.target.value }))
              }
            />
          </div>

          <SheetFooter className="sticky bottom-0 -mx-5 mt-5 border-t border-slate-200 bg-white px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
            <Button className="h-12 w-full" disabled={isSubmitting} type="submit">
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="size-4" aria-hidden="true" />
              )}
              {t("customer.profile.saveContact")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function AddressFormSheet({
  error,
  form,
  isEditing,
  isLocating,
  isSubmitting,
  open,
  onFormChange,
  onLocate,
  onOpenChange,
  onSubmit,
}: {
  error: string | null;
  form: CustomerAddressFormState;
  isEditing: boolean;
  isLocating: boolean;
  isSubmitting: boolean;
  open: boolean;
  onFormChange: React.Dispatch<React.SetStateAction<CustomerAddressFormState>>;
  onLocate: () => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const { locale, t } = useTranslation();
  const countryOptions = useMemo(
    () => getCountryOptions(locale, form.country),
    [form.country, locale],
  );
  const selectedCountryCode = normalizeCountryCode(form.country);
  const selectedCountry = countryOptions.find((country) => country.code === selectedCountryCode) ?? {
    code: selectedCountryCode,
    fallbackLabel: selectedCountryCode,
  };
  const hasCoordinates = Boolean(form.latitude && form.longitude);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-[92dvh] p-5">
        <SheetHeader className="pr-8 text-left">
          <SheetTitle>
            {isEditing ? t("customer.profile.addressEditTitle") : t("customer.profile.addressNewTitle")}
          </SheetTitle>
          <SheetDescription>{t("customer.profile.addressDescription")}</SheetDescription>
        </SheetHeader>

        {error ? <AlertMessage tone="error" message={error} /> : null}

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="address-label">{t("customer.forms.label")}</Label>
              <Input
                className="h-12 text-base"
                id="address-label"
                value={form.label}
                onChange={(event) =>
                  onFormChange((current) => ({ ...current, label: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-country">{t("customer.forms.country")}</Label>
              <Select
                value={normalizeCountryCode(form.country)}
                onValueChange={(country) =>
                  onFormChange((current) => ({ ...current, country }))
                }
              >
                <SelectTrigger
                  aria-label={`${t("customer.forms.country")}: ${selectedCountry.fallbackLabel}`}
                  className="h-12 w-full min-w-0 text-base"
                  id="address-country"
                >
                  <SelectValue asChild>
                    <span className="flex min-w-0 items-center gap-2">
                      <span aria-hidden="true" className="text-lg leading-none">
                        {getCountryFlag(selectedCountry.code)}
                      </span>
                      <span className="font-semibold tracking-normal text-slate-900">
                        {selectedCountry.code}
                      </span>
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-72 w-[min(20rem,calc(100vw-2rem))]" position="popper">
                  {countryOptions.map((country) => (
                    <SelectItem className="min-w-0 py-2" key={country.code} value={country.code}>
                      <span className="flex min-w-0 items-center gap-2">
                        <span aria-hidden="true" className="text-base leading-none">
                          {getCountryFlag(country.code)}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{country.fallbackLabel}</span>
                        <span className="shrink-0 text-xs font-semibold text-slate-500">
                          {country.code}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="address-contact-name">{t("customer.forms.contactName")}</Label>
              <Input
                className="h-12 text-base"
                id="address-contact-name"
                value={form.contactName}
                onChange={(event) =>
                  onFormChange((current) => ({ ...current, contactName: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-contact-phone">{t("customer.forms.contactPhone")}</Label>
              <Input
                className="h-12 text-base"
                id="address-contact-phone"
                inputMode="tel"
                value={form.contactPhone}
                onChange={(event) =>
                  onFormChange((current) => ({ ...current, contactPhone: event.target.value }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address-line1">{t("customer.forms.addressLine1")}</Label>
            <Textarea
              className="min-h-20 resize-none text-base"
              id="address-line1"
              value={form.addressLine1}
              onChange={(event) =>
                onFormChange((current) => ({ ...current, addressLine1: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address-line2">{t("customer.forms.addressLine2")}</Label>
            <Input
              className="h-12 text-base"
              id="address-line2"
              value={form.addressLine2}
              onChange={(event) =>
                onFormChange((current) => ({ ...current, addressLine2: event.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="address-city">{t("customer.forms.city")}</Label>
              <Input
                className="h-12 text-base"
                id="address-city"
                value={form.city}
                onChange={(event) =>
                  onFormChange((current) => ({ ...current, city: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-province">{t("customer.forms.province")}</Label>
              <Input
                className="h-12 text-base"
                id="address-province"
                value={form.province}
                onChange={(event) =>
                  onFormChange((current) => ({ ...current, province: event.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="address-postal">{t("customer.forms.postalCode")}</Label>
              <Input
                className="h-12 text-base"
                id="address-postal"
                value={form.postalCode}
                onChange={(event) =>
                  onFormChange((current) => ({ ...current, postalCode: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t("customer.forms.location")}</Label>
              <Button
                className="h-12 w-full justify-center"
                disabled={isLocating}
                type="button"
                variant={hasCoordinates ? "secondary" : "outline"}
                onClick={onLocate}
              >
                {isLocating ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <LocateFixed className="size-4" aria-hidden="true" />
                )}
                {hasCoordinates
                  ? t("customer.forms.locationCaptured")
                  : t("customer.forms.useCurrentLocation")}
              </Button>
            </div>
          </div>

          <label className="flex min-h-12 items-center gap-3 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700">
            <input
              checked={form.isDefault}
              className="size-4 accent-blue-600"
              type="checkbox"
              onChange={(event) =>
                onFormChange((current) => ({ ...current, isDefault: event.target.checked }))
              }
            />
            {t("customer.forms.isDefault")}
          </label>

          <div className="space-y-2">
            <Label htmlFor="address-notes">{t("customer.forms.notes")}</Label>
            <Textarea
              className="min-h-20 resize-none text-base"
              id="address-notes"
              value={form.notes}
              onChange={(event) =>
                onFormChange((current) => ({ ...current, notes: event.target.value }))
              }
            />
          </div>

          <SheetFooter className="sticky bottom-0 -mx-5 mt-5 border-t border-slate-200 bg-white px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
            <Button className="h-12 w-full" disabled={isSubmitting} type="submit">
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <MapPin className="size-4" aria-hidden="true" />
              )}
              {t("customer.profile.saveAddress")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function PasswordFormSheet({
  error,
  form,
  isSubmitting,
  open,
  onFormChange,
  onOpenChange,
  onSubmit,
}: {
  error: string | null;
  form: CustomerPasswordFormState;
  isSubmitting: boolean;
  open: boolean;
  onFormChange: React.Dispatch<React.SetStateAction<CustomerPasswordFormState>>;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-[82dvh] p-5">
        <SheetHeader className="pr-8 text-left">
          <SheetTitle>{t("customer.profile.passwordTitle")}</SheetTitle>
          <SheetDescription>{t("customer.profile.passwordDescription")}</SheetDescription>
        </SheetHeader>

        {error ? <AlertMessage tone="error" message={error} /> : null}

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="current-password">{t("customer.forms.currentPassword")}</Label>
            <Input
              className="h-12 text-base"
              id="current-password"
              type="password"
              value={form.currentPassword}
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  currentPassword: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">{t("customer.forms.newPassword")}</Label>
            <Input
              className="h-12 text-base"
              id="new-password"
              type="password"
              value={form.newPassword}
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  newPassword: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">{t("customer.forms.confirmPassword")}</Label>
            <Input
              className="h-12 text-base"
              id="confirm-password"
              type="password"
              value={form.confirmPassword}
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  confirmPassword: event.target.value,
                }))
              }
            />
          </div>

          <SheetFooter className="sticky bottom-0 -mx-5 mt-5 border-t border-slate-200 bg-white px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
            <Button className="h-12 w-full" disabled={isSubmitting} type="submit">
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <KeyRound className="size-4" aria-hidden="true" />
              )}
              {t("customer.profile.updatePassword")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function ProfileView({
  addressActionId,
  addressBook,
  contactActionId,
  profile,
  onCreateAddress,
  onCreateContact,
  onDeleteAddress,
  onDeleteContact,
  onEditAddress,
  onEditContact,
  onEditProfile,
  onOpenPassword,
  onSetDefaultAddress,
}: {
  addressActionId: string | null;
  addressBook: MobileCustomerAddress[];
  contactActionId: string | null;
  profile: MobileCustomerProfile | null;
  onCreateAddress: () => void;
  onCreateContact: () => void;
  onDeleteAddress: (addressId: string) => void;
  onDeleteContact: (customerId: string) => void;
  onEditAddress: (address: MobileCustomerAddress) => void;
  onEditContact: (contact: MobileCustomerContact) => void;
  onEditProfile: () => void;
  onOpenPassword: () => void;
  onSetDefaultAddress: (addressId: string) => void;
}) {
  const { t } = useTranslation();

  if (!profile) {
    return (
      <EmptyState
        icon={UserRound}
        title={t("customer.empty.profileUnavailableTitle")}
        body={t("customer.empty.profileUnavailableBody")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-blue-50 text-blue-700">
            <UserRound className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="break-words text-base font-semibold text-slate-950">
                {profile.account.accountName}
              </h2>
              <StatusBadge view={getAccountStatusView(t, profile.account.status)} />
            </div>
            <ContactLine icon={Phone} value={profile.account.phone} />
            <ContactLine icon={Mail} value={profile.account.email} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button className="h-11" type="button" variant="outline" onClick={onEditProfile}>
            <Edit3 className="size-4" aria-hidden="true" />
            {t("common.edit")}
          </Button>
          <Button className="h-11" type="button" variant="outline" onClick={onOpenPassword}>
            <KeyRound className="size-4" aria-hidden="true" />
            {t("customer.profile.password")}
          </Button>
        </div>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              {t("customer.profile.addressBook")}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {t("customer.profile.addressBookCount", { count: addressBook.length })}
            </p>
          </div>
          <Button className="h-10 shrink-0 px-3" type="button" onClick={onCreateAddress}>
            <Plus className="size-4" aria-hidden="true" />
            {t("customer.profile.addAddress")}
          </Button>
        </div>
      </section>

      {addressBook.length ? (
        <section className="space-y-3">
          {addressBook.map((address) => (
            <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm" key={address.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="break-words text-sm font-semibold text-slate-950">{address.label}</p>
                    {address.isDefault ? (
                      <Badge className="border-amber-200 bg-amber-50 text-amber-800" variant="outline">
                        <Star className="size-3" aria-hidden="true" />
                        {t("customer.profile.defaultAddress")}
                      </Badge>
                    ) : null}
                  </div>
                  {address.contactName ? (
                    <p className="mt-1 text-xs font-medium text-slate-500">{address.contactName}</p>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <ContactLine icon={MapPin} value={formatCustomerAddress(address)} />
                <ContactLine icon={Phone} value={address.contactPhone} />
              </div>

              {address.notes ? (
                <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                  {address.notes}
                </p>
              ) : null}

              <div className="mt-4 grid grid-cols-3 gap-2">
                <Button className="h-10 px-2" type="button" variant="outline" onClick={() => onEditAddress(address)}>
                  <Edit3 className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  className="h-10 px-2"
                  disabled={address.isDefault || addressActionId === `default-${address.id}`}
                  type="button"
                  variant="outline"
                  onClick={() => onSetDefaultAddress(address.id)}
                >
                  {addressActionId === `default-${address.id}` ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Star className="size-4" aria-hidden="true" />
                  )}
                </Button>
                <Button
                  className="h-10 px-2"
                  disabled={addressActionId === `delete-${address.id}`}
                  type="button"
                  variant="outline"
                  onClick={() => onDeleteAddress(address.id)}
                >
                  {addressActionId === `delete-${address.id}` ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash2 className="size-4" aria-hidden="true" />
                  )}
                </Button>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <EmptyState
          icon={MapPin}
          title={t("customer.empty.noAddressTitle")}
          body={t("customer.empty.noAddressBody")}
        />
      )}

      {profile.addresses.length ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3 px-1">
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {t("customer.profile.linkedContacts")}
            </h2>
            <Button className="h-9 shrink-0 px-3" type="button" variant="outline" onClick={onCreateContact}>
              <Plus className="size-4" aria-hidden="true" />
              {t("customer.profile.addContact")}
            </Button>
          </div>
          {profile.addresses.map((address) => (
            <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm" key={address.customerId}>
              <div className="flex items-start gap-3">
                <button
                  className="min-w-0 flex-1 text-left"
                  type="button"
                  onClick={() => onEditContact(address)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-slate-950">{address.fullName}</p>
                      {address.relationship ? (
                        <p className="mt-1 text-xs font-medium text-slate-500">{address.relationship}</p>
                      ) : null}
                    </div>
                    <StatusBadge view={getAccountStatusView(t, address.status)} />
                  </div>

                  <div className="mt-4 space-y-2">
                    <ContactLine icon={MapPin} value={address.address} />
                    <ContactLine icon={Phone} value={address.phone} />
                    <ContactLine icon={Mail} value={address.email} />
                  </div>
                </button>
                <Button
                  className="size-9 shrink-0 p-0"
                  disabled={contactActionId === `delete-${address.customerId}`}
                  type="button"
                  variant="outline"
                  onClick={() => onDeleteContact(address.customerId)}
                >
                  {contactActionId === `delete-${address.customerId}` ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash2 className="size-4" aria-hidden="true" />
                  )}
                </Button>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <EmptyState
          icon={MapPin}
          title={t("customer.empty.noAddressTitle")}
          body={t("customer.empty.noLinkedAddressBody")}
          action={
            <Button className="mt-4 h-10" type="button" onClick={onCreateContact}>
              <Plus className="size-4" aria-hidden="true" />
              {t("customer.profile.addContact")}
            </Button>
          }
        />
      )}
    </div>
  );
}

function ContactLine({ icon: Icon, value }: { icon: typeof Phone; value: string | null }) {
  if (!value) {
    return null;
  }

  return (
    <div className="mt-2 flex items-start gap-2 text-sm text-slate-600">
      <Icon className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
      <span className="break-words">{value}</span>
    </div>
  );
}

function EmptyState({
  action,
  body,
  icon: Icon,
  title,
}: {
  action?: React.ReactNode;
  body: string;
  icon: typeof ReceiptText;
  title: string;
}) {
  return (
    <section className="rounded-md border border-dashed border-slate-300 bg-white p-5 text-center">
      <div className="mx-auto flex size-11 items-center justify-center rounded-md bg-slate-100 text-slate-600">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <h2 className="mt-3 text-base font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
      {action}
    </section>
  );
}

function ActivityIcon({ kind }: { kind: ActivityKind }) {
  const Icon = kind === "order" ? ReceiptText : TicketCheck;

  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
      <Icon className="size-5" aria-hidden="true" />
    </div>
  );
}

function StatusBadge({ view }: { view: StatusView }) {
  return (
    <Badge className={`${view.className} rounded-md border px-2.5 py-1`} variant="outline">
      <CheckCircle2 className="size-3" aria-hidden="true" />
      {view.label}
    </Badge>
  );
}
