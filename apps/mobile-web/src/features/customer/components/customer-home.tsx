"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  MobileAuthContext,
  MobileCustomerActivityList,
  MobileCustomerAddress,
  MobileCustomerAddressInput,
  MobileCustomerAppointment,
  MobileCustomerAppointmentStatus,
  MobileCustomerAppointmentType,
  MobileCustomerOrderDetail,
  MobileCustomerOrderListItem,
  MobileCustomerOrderStatus,
  MobileCustomerProfile,
  MobileCustomerTicketDetail,
  MobileCustomerTicketListItem,
  MobileCustomerTicketStatus,
} from "@cleanhub/api-client";
import {
  Badge,
  Button,
  Input,
  Label,
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
  Loader2,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  Plus,
  ReceiptText,
  RefreshCcw,
  RotateCcw,
  Star,
  Trash2,
  TicketCheck,
  UserRound,
  XCircle,
} from "lucide-react";

import { getMobileSession } from "@/lib/token-storage";

import {
  cancelCustomerAppointment,
  changeCustomerPassword,
  createCustomerAddress,
  createCustomerAppointment,
  createCustomerPayment,
  createCustomerRefundRequest,
  deleteCustomerAddress,
  setDefaultCustomerAddress,
  updateCustomerAddress,
  updateCustomerProfile,
} from "../actions";
import {
  getCustomerActivityDetail,
  getCustomerAddresses,
  getCustomerAppointments,
  getCustomerOrdersAndTickets,
  getCustomerProfile,
} from "../queries";

type CustomerTab = "resume" | "orders" | "appointments" | "profile";

type ActivityKind = "order" | "ticket";

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

type AppointmentFormState = {
  type: MobileCustomerAppointmentType;
  expectedAt: string;
  address: string;
  notes: string;
};

type CustomerProfileFormState = {
  accountName: string;
  phone: string;
  email: string;
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

type ProfileSheet = "profile" | "address" | "password" | null;

type StatusView = {
  label: string;
  className: string;
};

const emptyActivity: MobileCustomerActivityList = {
  orders: [],
  tickets: [],
};

const emptyAddressForm: CustomerAddressFormState = {
  customerId: "",
  label: "Maison",
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

const emptyPasswordForm: CustomerPasswordFormState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const tabs: { value: CustomerTab; label: string; icon: typeof Home }[] = [
  { value: "resume", label: "Accueil", icon: Home },
  { value: "orders", label: "Suivi", icon: ReceiptText },
  { value: "appointments", label: "RDV", icon: CalendarClock },
  { value: "profile", label: "Profil", icon: UserRound },
];

const orderStatusViews: Record<MobileCustomerOrderStatus, StatusView> = {
  draft: {
    label: "Brouillon",
    className: "border-slate-200 bg-slate-50 text-slate-700",
  },
  received: {
    label: "Recu",
    className: "border-blue-200 bg-blue-50 text-blue-800",
  },
  paid: {
    label: "Payee",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  delivered: {
    label: "Livree",
    className: "border-teal-200 bg-teal-50 text-teal-800",
  },
  cancelled: {
    label: "Annulee",
    className: "border-red-200 bg-red-50 text-red-700",
  },
};

const ticketStatusViews: Record<MobileCustomerTicketStatus, StatusView> = {
  draft: {
    label: "Brouillon",
    className: "border-slate-200 bg-slate-50 text-slate-700",
  },
  pending: {
    label: "En attente",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  in_progress: {
    label: "En cours",
    className: "border-blue-200 bg-blue-50 text-blue-800",
  },
  ready_to_pick: {
    label: "Pret",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  picked_up: {
    label: "Retire",
    className: "border-teal-200 bg-teal-50 text-teal-800",
  },
  cancelled: {
    label: "Annule",
    className: "border-red-200 bg-red-50 text-red-700",
  },
  exception: {
    label: "Incident",
    className: "border-red-200 bg-red-50 text-red-700",
  },
};

const appointmentStatusViews: Record<MobileCustomerAppointmentStatus, StatusView> = {
  pending: {
    label: "En attente",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  accepted: {
    label: "Accepte",
    className: "border-blue-200 bg-blue-50 text-blue-800",
  },
  cancelled: {
    label: "Annule",
    className: "border-red-200 bg-red-50 text-red-700",
  },
  done: {
    label: "Termine",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
};

const appointmentTypeViews: Record<MobileCustomerAppointmentType, string> = {
  pickup: "Collecte a domicile",
  dropoff: "Depot en boutique",
};

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Non planifie";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
  }).format(date);
}

function getDefaultExpectedAt(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(Math.max(date.getHours() + 2, 10), 0, 0, 0);
  return toDateTimeLocalValue(date);
}

function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Action impossible pour le moment.";
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

function getActivityItems(activity: MobileCustomerActivityList): ActivityListItem[] {
  const orders: ActivityListItem[] = activity.orders.map((order) => ({
    kind: "order",
    id: order.id,
    title: `Commande ${order.id.slice(-6).toUpperCase()}`,
    subtitle: `Paiement ${order.paymentStatus}`,
    status: order.status,
    createdAt: order.createdAt,
    amount: order.totalAmount,
    source: order,
  }));
  const tickets: ActivityListItem[] = activity.tickets.map((ticket) => ({
    kind: "ticket",
    id: ticket.id,
    title: ticket.ticketNo ? `Ticket ${ticket.ticketNo}` : `Ticket ${ticket.id.slice(-6).toUpperCase()}`,
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

function toProfileForm(profile: MobileCustomerProfile | null): CustomerProfileFormState {
  return {
    accountName: profile?.account.accountName ?? "",
    phone: profile?.account.phone ?? "",
    email: profile?.account.email ?? "",
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
    country: address.country,
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
    country: form.country || "TH",
    latitude: form.latitude || null,
    longitude: form.longitude || null,
    isDefault: form.isDefault,
    notes: form.notes || null,
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

function getAppointmentSummary(appointments: MobileCustomerAppointment[]) {
  return {
    pending: appointments.filter((appointment) => appointment.status === "pending").length,
    next:
      [...appointments]
        .filter((appointment) => appointment.status === "pending" || appointment.status === "accepted")
        .sort(
          (left, right) =>
            new Date(left.expectedAt).getTime() - new Date(right.expectedAt).getTime(),
        )[0] ?? null,
  };
}

type CustomerSnapshot = {
  authContext: MobileAuthContext | null;
  profile: MobileCustomerProfile | null;
  addressBook: MobileCustomerAddress[];
  activity: MobileCustomerActivityList;
  appointments: MobileCustomerAppointment[];
  error: string | null;
};

async function fetchCustomerSnapshot(): Promise<CustomerSnapshot> {
  const session = await getMobileSession();

  if (!session || session.authContext.role !== "customer") {
    return {
      authContext: session?.authContext ?? null,
      profile: null,
      addressBook: [],
      activity: emptyActivity,
      appointments: [],
      error: "Session client requise.",
    };
  }

  const [profile, addressBook, activity, appointments] = await Promise.all([
    getCustomerProfile(),
    getCustomerAddresses(),
    getCustomerOrdersAndTickets(),
    getCustomerAppointments(),
  ]);

  return {
    authContext: session.authContext,
    profile,
    addressBook: addressBook.data,
    activity: activity.data,
    appointments: sortAppointments(appointments.data),
    error: null,
  };
}

export function CustomerHome() {
  const [activeTab, setActiveTab] = useState<CustomerTab>("resume");
  const [authContext, setAuthContext] = useState<MobileAuthContext | null>(null);
  const [profile, setProfile] = useState<MobileCustomerProfile | null>(null);
  const [addressBook, setAddressBook] = useState<MobileCustomerAddress[]>([]);
  const [activity, setActivity] = useState<MobileCustomerActivityList>(emptyActivity);
  const [appointments, setAppointments] = useState<MobileCustomerAppointment[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<ActivitySelection | null>(null);
  const [activityDetail, setActivityDetail] = useState<ActivityDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [appointmentSheetOpen, setAppointmentSheetOpen] = useState(false);
  const [profileSheet, setProfileSheet] = useState<ProfileSheet>(null);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState<CustomerProfileFormState>(() => toProfileForm(null));
  const [addressForm, setAddressForm] = useState<CustomerAddressFormState>(emptyAddressForm);
  const [passwordForm, setPasswordForm] = useState<CustomerPasswordFormState>(emptyPasswordForm);
  const [refundSheetOpen, setRefundSheetOpen] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState<AppointmentFormState>({
    type: "pickup",
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
  const [isSubmittingAddress, setIsSubmittingAddress] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);
  const [cancellingAppointmentId, setCancellingAppointmentId] = useState<string | null>(null);
  const [addressActionId, setAddressActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      setActivity(snapshot.activity);
      setAppointments(snapshot.appointments);
      setError(snapshot.error);
      setProfileForm(toProfileForm(snapshot.profile));
      setAppointmentForm((current) => ({
        ...current,
        address:
          current.address ||
          getAddressBookPrimaryAddress(snapshot.addressBook) ||
          getPrimaryAddress(snapshot.profile),
      }));
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

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
        setActivity(snapshot.activity);
        setAppointments(snapshot.appointments);
        setError(snapshot.error);
        setProfileForm(toProfileForm(snapshot.profile));
        setAppointmentForm((current) => ({
          ...current,
          address:
            current.address ||
            getAddressBookPrimaryAddress(snapshot.addressBook) ||
            getPrimaryAddress(snapshot.profile),
        }));
      })
      .catch((nextError: unknown) => {
        if (mounted) {
          setError(getErrorMessage(nextError));
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
  }, []);

  const activityItems = useMemo(() => getActivityItems(activity), [activity]);
  const appointmentSummary = useMemo(() => getAppointmentSummary(appointments), [appointments]);
  const latestActivity = activityItems[0] ?? null;

  async function handleSelectActivity(item: ActivityListItem) {
    setSelectedActivity({ kind: item.kind, id: item.id });
    setActivityDetail(null);
    setDetailOpen(true);
    setIsDetailLoading(true);
    setError(null);

    try {
      const detail = await getCustomerActivityDetail({ kind: item.kind, id: item.id });
      setActivityDetail(
        item.kind === "order"
          ? { kind: "order", data: detail as MobileCustomerOrderDetail }
          : { kind: "ticket", data: detail as MobileCustomerTicketDetail },
      );
    } catch (nextError) {
      setDetailOpen(false);
      setSelectedActivity(null);
      setError(getErrorMessage(nextError));
    } finally {
      setIsDetailLoading(false);
    }
  }

  async function refreshSelectedOrder(orderId: string) {
    const [detail, nextActivity] = await Promise.all([
      getCustomerActivityDetail({ kind: "order", id: orderId }),
      getCustomerOrdersAndTickets(),
    ]);

    setActivity(nextActivity.data);
    setActivityDetail({
      kind: "order",
      data: detail as MobileCustomerOrderDetail,
    });
  }

  async function handleCreatePayment(order: MobileCustomerOrderDetail) {
    const amount = getOrderBalance(order);

    if (amountToCents(amount) <= 0) {
      setError("Commande deja reglee.");
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

      window.open(result.gateway.paymentUrl, "_blank", "noopener,noreferrer");
      await refreshSelectedOrder(order.id);
      setMessage(
        result.idempotent
          ? "Paiement deja initie."
          : "Paiement cree. Finalisez-le dans la fenetre ouverte.",
      );
    } catch (nextError) {
      setError(getErrorMessage(nextError));
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
        throw new Error("Motif requis pour la demande.");
      }

      const refund = await createCustomerRefundRequest(refundForm.orderId, {
        amount: refundForm.amount,
        reason: refundForm.reason,
      });

      await refreshSelectedOrder(refund.orderId);
      setRefundSheetOpen(false);
      setMessage("Demande de remboursement envoyee.");
    } catch (nextError) {
      setError(getErrorMessage(nextError));
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
        throw new Error("Adresse requise pour le rendez-vous.");
      }

      if (Number.isNaN(expectedAt.getTime())) {
        throw new Error("Date de rendez-vous invalide.");
      }

      const created = await createCustomerAppointment({
        type: appointmentForm.type,
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
      setMessage("Rendez-vous cree.");
    } catch (nextError) {
      setError(getErrorMessage(nextError));
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
      setMessage("Rendez-vous annule.");
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setCancellingAppointmentId(null);
    }
  }

  function openProfileSheet() {
    setError(null);
    setMessage(null);
    setProfileForm(toProfileForm(profile));
    setProfileSheet("profile");
  }

  function openCreateAddressSheet() {
    setError(null);
    setMessage(null);
    setEditingAddressId(null);
    setAddressForm({
      ...emptyAddressForm,
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
        throw new Error("Nom requis.");
      }

      const updated = await updateCustomerProfile(profileForm);
      setProfile(updated);
      setProfileForm(toProfileForm(updated));
      setProfileSheet(null);
      setMessage("Profil mis a jour.");
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setIsSubmittingProfile(false);
    }
  }

  async function handleSaveAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmittingAddress(true);

    try {
      if (!addressForm.label.trim() || !addressForm.addressLine1.trim()) {
        throw new Error("Libelle et adresse requis.");
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
        address: current.address || formatCustomerAddress(saved),
      }));
      setProfileSheet(null);
      setEditingAddressId(null);
      setMessage(editingAddressId ? "Adresse mise a jour." : "Adresse ajoutee.");
    } catch (nextError) {
      setError(getErrorMessage(nextError));
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
      setMessage("Adresse supprimee.");
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setAddressActionId(null);
    }
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
        address: formatCustomerAddress(updated),
      }));
      setMessage("Adresse par defaut mise a jour.");
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setAddressActionId(null);
    }
  }

  async function handleChangePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("La confirmation ne correspond pas.");
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
      setMessage("Mot de passe mis a jour. Reconnectez-vous sur les autres appareils.");
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setIsSubmittingPassword(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-5">
        <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
          <Loader2 className="size-4 animate-spin text-teal-700" aria-hidden="true" />
          Chargement de l&apos;espace client
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-[calc(104px+env(safe-area-inset-bottom))] pt-[max(24px,env(safe-area-inset-top))]">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
            CleanHub
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-950">Espace client</h1>
          <p className="mt-2 truncate text-sm text-slate-600">
            {profile?.account.accountName ?? authContext?.displayName ?? "Client"}
          </p>
        </div>
        <Button
          aria-label="Actualiser"
          className="size-11"
          disabled={isRefreshing}
          size="icon"
          variant="outline"
          onClick={() => void loadCustomerData("refresh")}
        >
          {isRefreshing ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCcw className="size-4" aria-hidden="true" />
          )}
        </Button>
      </header>

      {error && !appointmentSheetOpen ? <AlertMessage tone="error" message={error} /> : null}
      {message ? <AlertMessage tone="success" message={message} /> : null}

      {activeTab === "resume" ? (
        <ResumeView
          activityCount={activity.orders.length + activity.tickets.length}
          appointmentSummary={appointmentSummary}
          latestActivity={latestActivity}
          profile={profile}
          onOpenActivity={(item) => {
            setActiveTab("orders");
            void handleSelectActivity(item);
          }}
          onOpenAppointments={() => setActiveTab("appointments")}
        />
      ) : null}

      {activeTab === "orders" ? (
        <ActivityView
          activityItems={activityItems}
          selectedActivity={selectedActivity}
          onSelectActivity={(item) => void handleSelectActivity(item)}
        />
      ) : null}

      {activeTab === "appointments" ? (
        <AppointmentsView
          appointments={appointments}
          cancellingAppointmentId={cancellingAppointmentId}
          onCancelAppointment={(appointmentId) => void handleCancelAppointment(appointmentId)}
          onOpenCreateAppointment={() => {
            setError(null);
            setMessage(null);
            setAppointmentSheetOpen(true);
          }}
        />
      ) : null}

      {activeTab === "profile" ? (
        <ProfileView
          addressActionId={addressActionId}
          addressBook={addressBook}
          profile={profile}
          onCreateAddress={openCreateAddressSheet}
          onDeleteAddress={(addressId) => void handleDeleteAddress(addressId)}
          onEditAddress={openEditAddressSheet}
          onEditProfile={openProfileSheet}
          onOpenPassword={openPasswordSheet}
          onSetDefaultAddress={(addressId) => void handleSetDefaultAddress(addressId)}
        />
      ) : null}

      <ActivityDetailSheet
        detail={activityDetail}
        isPaymentSubmitting={isSubmittingPayment}
        isLoading={isDetailLoading}
        item={activityItems.find(
          (item) => item.kind === selectedActivity?.kind && item.id === selectedActivity.id,
        ) ?? null}
        open={detailOpen}
        onCreatePayment={(order) => void handleCreatePayment(order)}
        onOpenChange={(open) => {
          setDetailOpen(open);

          if (!open) {
            setSelectedActivity(null);
            setActivityDetail(null);
          }
        }}
        onOpenRefund={openRefundSheet}
      />

      <AppointmentFormSheet
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
        isSubmitting={isSubmittingAddress}
        open={profileSheet === "address"}
        onFormChange={setAddressForm}
        onOpenChange={(open) => {
          setProfileSheet(open ? "address" : null);

          if (!open) {
            setEditingAddressId(null);
            setError(null);
          }
        }}
        onSubmit={handleSaveAddress}
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
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md border-t border-slate-200 bg-[#f8faf9]/95 px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur"
    >
      <div className="grid grid-cols-4 gap-2 rounded-md border border-slate-200 bg-white p-1 shadow-sm">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;

          return (
            <button
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-md px-1 text-xs font-medium transition ${
                isActive ? "bg-teal-700 text-white" : "text-slate-600 hover:bg-slate-50"
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
          : "border-teal-200 bg-teal-50 text-teal-800"
      }`}
    >
      {message}
    </p>
  );
}

function ResumeView({
  activityCount,
  appointmentSummary,
  latestActivity,
  profile,
  onOpenActivity,
  onOpenAppointments,
}: {
  activityCount: number;
  appointmentSummary: { pending: number; next: MobileCustomerAppointment | null };
  latestActivity: ActivityListItem | null;
  profile: MobileCustomerProfile | null;
  onOpenActivity: (item: ActivityListItem) => void;
  onOpenAppointments: () => void;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-teal-50 text-teal-700">
            <PackageCheck className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-950">
              {profile?.account.accountName ?? "Compte client"}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {profile?.account.phone ?? profile?.account.email ?? "Contact non renseigne"}
            </p>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-2">
          <StatBlock label="Suivis" value={activityCount} />
          <StatBlock label="RDV actifs" value={appointmentSummary.pending} />
          <StatBlock label="Adresses" value={profile?.addresses.length ?? 0} />
        </dl>
      </section>

      {latestActivity ? (
        <button
          className="w-full rounded-md border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-teal-300"
          type="button"
          onClick={() => onOpenActivity(latestActivity)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 gap-3">
              <ActivityIcon kind={latestActivity.kind} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">{latestActivity.title}</p>
                <p className="mt-1 text-xs text-slate-500">{formatDate(latestActivity.createdAt)}</p>
              </div>
            </div>
            <ChevronRight className="mt-1 size-4 text-slate-400" aria-hidden="true" />
          </div>
          <div className="mt-3">
            <StatusBadge
              view={
                latestActivity.kind === "order"
                  ? orderStatusViews[latestActivity.status]
                  : ticketStatusViews[latestActivity.status]
              }
            />
          </div>
        </button>
      ) : (
        <EmptyState
          icon={ReceiptText}
          title="Aucun suivi"
          body="Les commandes et tickets apparaitront ici apres prise en charge."
        />
      )}

      {appointmentSummary.next ? (
        <button
          className="w-full rounded-md border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-teal-300"
          type="button"
          onClick={onOpenAppointments}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 gap-3">
              <div className="flex size-10 items-center justify-center rounded-md bg-amber-50 text-amber-700">
                <CalendarClock className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-950">
                  {appointmentTypeViews[appointmentSummary.next.type]}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatDateTime(appointmentSummary.next.expectedAt)}
                </p>
              </div>
            </div>
            <ChevronRight className="mt-1 size-4 text-slate-400" aria-hidden="true" />
          </div>
        </button>
      ) : null}
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-slate-50 px-2 py-3 text-center">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

function ActivityView({
  activityItems,
  selectedActivity,
  onSelectActivity,
}: {
  activityItems: ActivityListItem[];
  selectedActivity: ActivitySelection | null;
  onSelectActivity: (item: ActivityListItem) => void;
}) {
  return (
    <div className="space-y-4">
      {activityItems.length ? (
        <section className="space-y-3">
          {activityItems.map((item) => {
            const selected = selectedActivity?.kind === item.kind && selectedActivity.id === item.id;

            return (
              <button
                className={`w-full rounded-md border bg-white p-4 text-left shadow-sm transition ${
                  selected ? "border-teal-400 ring-2 ring-teal-100" : "border-slate-200 hover:border-teal-300"
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
                      <p className="mt-1 text-xs text-slate-500">{formatDate(item.createdAt)}</p>
                    </div>
                  </div>
                  <ChevronRight className="mt-1 size-4 text-slate-400" aria-hidden="true" />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge
                    view={item.kind === "order" ? orderStatusViews[item.status] : ticketStatusViews[item.status]}
                  />
                  {item.kind === "order" ? (
                    <span className="text-xs font-medium text-slate-500">Total {item.amount}</span>
                  ) : item.expectedAt ? (
                    <span className="text-xs font-medium text-slate-500">
                      Retrait {formatDateTime(item.expectedAt)}
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </section>
      ) : (
        <EmptyState
          icon={ReceiptText}
          title="Aucune commande"
          body="Les commandes et tickets actifs apparaitront ici."
        />
      )}
    </div>
  );
}

function ActivityDetailSheet({
  detail,
  isPaymentSubmitting,
  isLoading,
  item,
  onCreatePayment,
  open,
  onOpenChange,
  onOpenRefund,
}: {
  detail: ActivityDetail | null;
  isPaymentSubmitting: boolean;
  isLoading: boolean;
  item: ActivityListItem | null;
  onCreatePayment: (order: MobileCustomerOrderDetail) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenRefund: (order: MobileCustomerOrderDetail) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-[90dvh] p-5">
        <SheetHeader className="pr-8 text-left">
          <SheetTitle>{item?.title ?? "Detail du suivi"}</SheetTitle>
          <SheetDescription>
            {item?.subtitle ?? "Commande ou ticket client"}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <Loader2 className="size-4 animate-spin text-teal-700" aria-hidden="true" />
              Chargement du detail
            </div>
          </div>
        ) : detail ? (
          <ActivityDetailPanel
            detail={detail}
            isPaymentSubmitting={isPaymentSubmitting}
            onCreatePayment={onCreatePayment}
            onOpenRefund={onOpenRefund}
          />
        ) : (
          <p className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Selectionnez un suivi pour afficher le detail.
          </p>
        )}

        <SheetFooter className="sticky bottom-0 -mx-5 mt-5 border-t border-slate-200 bg-white px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
          <SheetClose asChild>
            <Button className="h-11 w-full" type="button" variant="outline">
              Fermer
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ActivityDetailPanel({
  detail,
  isPaymentSubmitting,
  onCreatePayment,
  onOpenRefund,
}: {
  detail: ActivityDetail;
  isPaymentSubmitting: boolean;
  onCreatePayment: (order: MobileCustomerOrderDetail) => void;
  onOpenRefund: (order: MobileCustomerOrderDetail) => void;
}) {
  if (detail.kind === "order") {
    const balance = getOrderBalance(detail.data);
    const canPay =
      amountToCents(balance) > 0 &&
      detail.data.paymentStatus !== "paid" &&
      detail.data.paymentStatus !== "refunded";
    const canRefund = amountToCents(detail.data.paidAmount) > 0;

    return (
      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-950">
              Commande {detail.data.id.slice(-6).toUpperCase()}
            </p>
            <p className="mt-1 text-sm text-slate-600">{detail.data.orderType}</p>
          </div>
          <StatusBadge view={orderStatusViews[detail.data.status]} />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <DetailTerm label="Total" value={detail.data.totalAmount} />
          <DetailTerm label="Paye" value={detail.data.paidAmount} />
          <DetailTerm label="Paiement" value={detail.data.paymentStatus} />
          <DetailTerm label="Creee" value={formatDateTime(detail.data.createdAt)} />
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
            Payer
          </Button>
          <Button
            className="h-11"
            disabled={!canRefund}
            type="button"
            variant="outline"
            onClick={() => onOpenRefund(detail.data)}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Rembourser
          </Button>
        </div>

        <ItemList
          emptyLabel="Aucun article"
          items={detail.data.items.map((item) => ({
            id: item.id,
            title: item.itemName,
            subtitle: `${item.quantity} x ${item.unitAmount}`,
            amount: item.lineAmount,
          }))}
        />
      </section>
    );
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">
            {detail.data.ticketNo ? `Ticket ${detail.data.ticketNo}` : "Ticket"}
          </p>
          <p className="mt-1 text-sm text-slate-600">{detail.data.ticketType}</p>
        </div>
        <StatusBadge view={ticketStatusViews[detail.data.ticketStatus]} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <DetailTerm label="Priorite" value={detail.data.priority} />
        <DetailTerm label="Retrait" value={formatDateTime(detail.data.expectedPickupAt)} />
        <DetailTerm label="Termine" value={formatDateTime(detail.data.completedAt)} />
        <DetailTerm label="Cree" value={formatDateTime(detail.data.createdAt)} />
      </dl>

      {detail.data.remark ? (
        <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
          {detail.data.remark}
        </p>
      ) : null}

      <ItemList
        emptyLabel="Aucun article"
        items={detail.data.items.map((item) => ({
          id: item.id,
          title: item.itemName,
          subtitle: `${item.quantity} x ${item.unitAmount}${item.itemCategory ? ` - ${item.itemCategory}` : ""}`,
          amount: item.lineAmount,
          status: item.itemStatus,
        }))}
      />
    </section>
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
}: {
  emptyLabel: string;
  items: { id: string; title: string; subtitle: string; amount: string; status?: string }[];
}) {
  return (
    <div className="mt-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Articles</p>
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
  return (
    <div className="space-y-4">
      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-teal-50 text-teal-700">
            <Plus className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-950">Rendez-vous</h2>
            <p className="mt-1 text-sm text-slate-600">Collectes et depots planifies</p>
          </div>
          <Button className="h-11 shrink-0" type="button" onClick={onOpenCreateAppointment}>
            <Plus className="size-4" aria-hidden="true" />
            Nouveau
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
        <EmptyState icon={CalendarClock} title="Aucun rendez-vous" body="Les demandes creees apparaitront ici." />
      )}
    </div>
  );
}

function AppointmentFormSheet({
  error,
  form,
  isSubmitting,
  open,
  onFormChange,
  onOpenChange,
  onSubmit,
}: {
  error: string | null;
  form: AppointmentFormState;
  isSubmitting: boolean;
  open: boolean;
  onFormChange: React.Dispatch<React.SetStateAction<AppointmentFormState>>;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-[92dvh] p-5">
        <SheetHeader className="pr-8 text-left">
          <SheetTitle>Nouveau rendez-vous</SheetTitle>
          <SheetDescription>Collecte a domicile ou depot en boutique</SheetDescription>
        </SheetHeader>

        {error ? <AlertMessage tone="error" message={error} /> : null}

        <AppointmentForm
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
  form,
  isSubmitting,
  onFormChange,
  onSubmit,
}: {
  form: AppointmentFormState;
  isSubmitting: boolean;
  onFormChange: React.Dispatch<React.SetStateAction<AppointmentFormState>>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="sr-only">Type de rendez-vous</legend>
        {(["pickup", "dropoff"] as const).map((type) => (
          <button
            className={`min-h-12 rounded-md border px-3 text-sm font-medium transition ${
              form.type === type
                ? "border-teal-700 bg-teal-50 text-teal-900"
                : "border-slate-200 bg-white text-slate-700"
            }`}
            key={type}
            type="button"
            onClick={() => onFormChange((current) => ({ ...current, type }))}
          >
            {appointmentTypeViews[type]}
          </button>
        ))}
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="appointment-expected-at">Date et heure</Label>
        <Input
          className="h-12 text-base"
          id="appointment-expected-at"
          type="datetime-local"
          value={form.expectedAt}
          onChange={(event) =>
            onFormChange((current) => ({ ...current, expectedAt: event.target.value }))
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="appointment-address">Adresse</Label>
        <Textarea
          className="min-h-24 resize-none text-base"
          id="appointment-address"
          placeholder="Adresse de collecte ou de depot"
          value={form.address}
          onChange={(event) =>
            onFormChange((current) => ({ ...current, address: event.target.value }))
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="appointment-notes">Notes</Label>
        <Textarea
          className="min-h-20 resize-none text-base"
          id="appointment-notes"
          placeholder="Instructions utiles"
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
          Creer le rendez-vous
        </Button>
      </SheetFooter>
    </form>
  );
}

function RefundRequestSheet({
  error,
  form,
  isSubmitting,
  open,
  onFormChange,
  onOpenChange,
  onSubmit,
}: {
  error: string | null;
  form: RefundFormState;
  isSubmitting: boolean;
  open: boolean;
  onFormChange: React.Dispatch<React.SetStateAction<RefundFormState>>;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-[92dvh] p-5">
        <SheetHeader className="pr-8 text-left">
          <SheetTitle>Demande de remboursement</SheetTitle>
          <SheetDescription>Validation par l&apos;owner avant traitement</SheetDescription>
        </SheetHeader>

        {error ? <AlertMessage tone="error" message={error} /> : null}

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="refund-amount">Montant</Label>
            <Input
              className="h-12 text-base"
              id="refund-amount"
              inputMode="decimal"
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
            <Label htmlFor="refund-reason">Motif</Label>
            <Textarea
              className="min-h-24 resize-none text-base"
              id="refund-reason"
              placeholder="Expliquez la demande"
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
              Envoyer la demande
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
  const isCancelling = cancellingAppointmentId === appointment.id;

  return (
    <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-950">{appointmentTypeViews[appointment.type]}</p>
          <p className="mt-1 text-sm text-slate-600">{formatDateTime(appointment.expectedAt)}</p>
        </div>
        <StatusBadge view={appointmentStatusViews[appointment.status]} />
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
          Annuler
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
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-[86dvh] p-5">
        <SheetHeader className="pr-8 text-left">
          <SheetTitle>Modifier le profil</SheetTitle>
          <SheetDescription>Coordonnees principales du compte client</SheetDescription>
        </SheetHeader>

        {error ? <AlertMessage tone="error" message={error} /> : null}

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="profile-name">Nom</Label>
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
            <Label htmlFor="profile-phone">Telephone</Label>
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
            <Label htmlFor="profile-email">Email</Label>
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
              Enregistrer
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
  isSubmitting,
  open,
  onFormChange,
  onOpenChange,
  onSubmit,
}: {
  error: string | null;
  form: CustomerAddressFormState;
  isEditing: boolean;
  isSubmitting: boolean;
  open: boolean;
  onFormChange: React.Dispatch<React.SetStateAction<CustomerAddressFormState>>;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-[92dvh] p-5">
        <SheetHeader className="pr-8 text-left">
          <SheetTitle>{isEditing ? "Modifier l'adresse" : "Nouvelle adresse"}</SheetTitle>
          <SheetDescription>Adresse de collecte ou livraison</SheetDescription>
        </SheetHeader>

        {error ? <AlertMessage tone="error" message={error} /> : null}

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="address-label">Libelle</Label>
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
              <Label htmlFor="address-country">Pays</Label>
              <Input
                className="h-12 text-base uppercase"
                id="address-country"
                maxLength={2}
                value={form.country}
                onChange={(event) =>
                  onFormChange((current) => ({ ...current, country: event.target.value.toUpperCase() }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="address-contact-name">Contact</Label>
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
              <Label htmlFor="address-contact-phone">Telephone</Label>
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
            <Label htmlFor="address-line1">Adresse</Label>
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
            <Label htmlFor="address-line2">Complement</Label>
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
              <Label htmlFor="address-city">Ville</Label>
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
              <Label htmlFor="address-province">Region</Label>
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

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="address-postal">Code</Label>
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
              <Label htmlFor="address-latitude">Lat</Label>
              <Input
                className="h-12 text-base"
                id="address-latitude"
                inputMode="decimal"
                value={form.latitude}
                onChange={(event) =>
                  onFormChange((current) => ({ ...current, latitude: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-longitude">Lng</Label>
              <Input
                className="h-12 text-base"
                id="address-longitude"
                inputMode="decimal"
                value={form.longitude}
                onChange={(event) =>
                  onFormChange((current) => ({ ...current, longitude: event.target.value }))
                }
              />
            </div>
          </div>

          <label className="flex min-h-12 items-center gap-3 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700">
            <input
              checked={form.isDefault}
              className="size-4 accent-teal-700"
              type="checkbox"
              onChange={(event) =>
                onFormChange((current) => ({ ...current, isDefault: event.target.checked }))
              }
            />
            Adresse par defaut
          </label>

          <div className="space-y-2">
            <Label htmlFor="address-notes">Notes</Label>
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
              Enregistrer l&apos;adresse
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
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-[82dvh] p-5">
        <SheetHeader className="pr-8 text-left">
          <SheetTitle>Modifier le mot de passe</SheetTitle>
          <SheetDescription>La session des autres appareils sera expiree</SheetDescription>
        </SheetHeader>

        {error ? <AlertMessage tone="error" message={error} /> : null}

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="current-password">Mot de passe actuel</Label>
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
            <Label htmlFor="new-password">Nouveau mot de passe</Label>
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
            <Label htmlFor="confirm-password">Confirmation</Label>
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
              Mettre a jour
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
  profile,
  onCreateAddress,
  onDeleteAddress,
  onEditAddress,
  onEditProfile,
  onOpenPassword,
  onSetDefaultAddress,
}: {
  addressActionId: string | null;
  addressBook: MobileCustomerAddress[];
  profile: MobileCustomerProfile | null;
  onCreateAddress: () => void;
  onDeleteAddress: (addressId: string) => void;
  onEditAddress: (address: MobileCustomerAddress) => void;
  onEditProfile: () => void;
  onOpenPassword: () => void;
  onSetDefaultAddress: (addressId: string) => void;
}) {
  if (!profile) {
    return <EmptyState icon={UserRound} title="Profil indisponible" body="Reconnectez-vous puis reessayez." />;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-teal-50 text-teal-700">
            <UserRound className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="break-words text-base font-semibold text-slate-950">
                {profile.account.accountName}
              </h2>
              <StatusBadge
                view={
                  profile.account.status === "active"
                    ? {
                        label: "Actif",
                        className: "border-emerald-200 bg-emerald-50 text-emerald-800",
                      }
                    : {
                        label: "Desactive",
                        className: "border-red-200 bg-red-50 text-red-700",
                      }
                }
              />
            </div>
            <ContactLine icon={Phone} value={profile.account.phone} />
            <ContactLine icon={Mail} value={profile.account.email} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button className="h-11" type="button" variant="outline" onClick={onEditProfile}>
            <Edit3 className="size-4" aria-hidden="true" />
            Modifier
          </Button>
          <Button className="h-11" type="button" variant="outline" onClick={onOpenPassword}>
            <KeyRound className="size-4" aria-hidden="true" />
            Mot de passe
          </Button>
        </div>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Carnet d&apos;adresses</h2>
            <p className="mt-1 text-sm text-slate-600">
              {addressBook.length} adresse(s) de collecte ou livraison
            </p>
          </div>
          <Button className="h-10 shrink-0 px-3" type="button" onClick={onCreateAddress}>
            <Plus className="size-4" aria-hidden="true" />
            Ajouter
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
                        Defaut
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
        <EmptyState icon={MapPin} title="Aucune adresse" body="Ajoutez une adresse de collecte ou livraison." />
      )}

      {profile.addresses.length ? (
        <section className="space-y-3">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Contacts lies
          </h2>
          {profile.addresses.map((address) => (
            <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm" key={address.customerId}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-slate-950">{address.fullName}</p>
                  {address.relationship ? (
                    <p className="mt-1 text-xs font-medium text-slate-500">{address.relationship}</p>
                  ) : null}
                </div>
                <StatusBadge
                  view={
                    address.status === "active"
                      ? {
                          label: "Actif",
                          className: "border-emerald-200 bg-emerald-50 text-emerald-800",
                        }
                      : {
                          label: "Desactive",
                          className: "border-red-200 bg-red-50 text-red-700",
                        }
                  }
                />
              </div>

              <div className="mt-4 space-y-2">
                <ContactLine icon={MapPin} value={address.address} />
                <ContactLine icon={Phone} value={address.phone} />
                <ContactLine icon={Mail} value={address.email} />
              </div>
            </article>
          ))}
        </section>
      ) : (
        <EmptyState icon={MapPin} title="Aucune adresse" body="Aucune adresse client n'est liee au compte." />
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
  body,
  icon: Icon,
  title,
}: {
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
