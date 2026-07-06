"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  MobileAuthContext,
  MobileCustomerActivityList,
  MobileCustomerAddress,
  MobileCustomerAppointment,
  MobileCustomerBranchOption,
  MobileCustomerContact,
  MobileCustomerOrderDetail,
  MobileCustomerProfile,
  MobileCustomerTicketDetail,
  MobileRefundRequest,
} from "@cleanhub/api-client";
import type { TranslationKey } from "@cleanhub/i18n";
import { useTranslation } from "@cleanhub/i18n/react";
import {
  Badge,
  Button,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  toast,
} from "@cleanhub/ui";
import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Home,
  Loader2,
  MapPin,
  Plus,
  ReceiptText,
  RotateCcw,
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
import { getCurrentAddressCoordinates } from "../lib/capacitor";
import {
  getDeviceCountry,
  getIntlLocale,
} from "../lib/country";
import {
  CUSTOM_APPOINTMENT_ADDRESS_ID,
  activityStatusFilters,
  amountToCents,
  appointmentTypeKeys,
  emptyActivity,
  emptyAddressForm,
  emptyContactForm,
  emptyPasswordForm,
  filterActivityItems,
  formatCustomerAddress,
  formatDate,
  formatDateTime,
  getActivityItems,
  getAddressBookPrimaryAddress,
  getAddressBookPrimaryAddressId,
  getAppointmentStatusView,
  getConfirmDescription,
  getConfirmLabel,
  getConfirmTitle,
  getDefaultExpectedAt,
  getErrorMessage,
  getMinimumAppointmentDate,
  getNextOverviewItem,
  getOrderBalance,
  getOrderStatusView,
  getPrimaryAddress,
  getReadyForPickupCount,
  getRefundStatusView,
  getTicketStatusView,
  isOpenAppointment,
  sortAppointments,
  toAddressForm,
  toAddressInput,
  toContactForm,
  toContactInput,
  toProfileForm,
} from "../lib/format";
import type {
  ActivityDetail,
  ActivityKind,
  ActivityListItem,
  ActivityStatusFilter,
  AppointmentFormState,
  CustomerAddressFormState,
  CustomerConfirmTarget,
  CustomerContactFormState,
  CustomerPasswordFormState,
  CustomerProfileFormState,
  StatusView,
} from "../lib/format";
import { openExternalUrl } from "../lib/open-external";
import {
  CustomerAccountCard,
  CustomerAddressBookSection,
  CustomerLinkedContactsSection,
  CustomerProfileUnavailableState,
} from "./customer-profile-sections";
import {
  AddressFormSheet,
  AppointmentFormSheet,
  ContactFormSheet,
  PasswordFormSheet,
  ProfileFormSheet,
  RefundRequestSheet,
} from "./customer-form-sheets";
import type { RefundFormState } from "./customer-form-sheets";

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

type ActivitySelection = {
  kind: ActivityKind;
  id: string;
};

type ProfileSheet = "profile" | "contact" | "address" | "password" | null;

const tabIcons: Record<CustomerTab, typeof Home> = {
  resume: Home,
  orders: ReceiptText,
  appointments: CalendarClock,
  profile: UserRound,
};

const customerDetailUrlViews = ["order", "ticket"] as const;

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
            toast.success(t("customer.paymentMock.paidTitle"));
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
    setIsSubmittingPayment(true);

    try {
      const result = await createCustomerPayment({
        orderId: order.id,
        amount,
      });

      setPendingPaymentOrderId(order.id);
      await openExternalUrl(result.gateway.paymentUrl);
      await refreshSelectedOrder(order.id);
      toast.success(
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
      toast.success(t("customer.messages.refundRequested"));
    } catch (nextError) {
      setError(getErrorMessage(nextError, t("common.errors.genericAction")));
    } finally {
      setIsSubmittingRefund(false);
    }
  }

  async function handleCreateAppointment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
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
      toast.success(t("customer.messages.appointmentCreated"));
    } catch (nextError) {
      setError(getErrorMessage(nextError, t("common.errors.genericAction")));
    } finally {
      setIsSubmittingAppointment(false);
    }
  }

  async function handleCancelAppointment(appointmentId: string) {
    setError(null);
    setCancellingAppointmentId(appointmentId);

    try {
      const updated = await cancelCustomerAppointment(appointmentId);
      setAppointments((current) =>
        sortAppointments(current.map((appointment) => (appointment.id === updated.id ? updated : appointment))),
      );
      toast.success(t("customer.messages.appointmentCancelled"));
    } catch (nextError) {
      setError(getErrorMessage(nextError, t("common.errors.genericAction")));
    } finally {
      setCancellingAppointmentId(null);
    }
  }

  function requestCancelAppointment(appointmentId: string) {
    setError(null);
    setConfirmTarget({ kind: "cancel-appointment", appointmentId });
  }

  function openProfileSheet() {
    setError(null);
    setProfileForm(toProfileForm(profile));
    setProfileSheet("profile");
  }

  function openCreateContactSheet() {
    setError(null);
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
    setEditingContactId(contact.customerId);
    setContactForm(toContactForm(contact));
    setProfileSheet("contact");
  }

  function openCreateAddressSheet() {
    setError(null);
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
    setEditingAddressId(address.id);
    setAddressForm(toAddressForm(address));
    setProfileSheet("address");
  }

  async function handleLocateAddress() {
    setError(null);
    setIsLocatingAddress(true);

    try {
      const coordinates = await getCurrentAddressCoordinates();
      setAddressForm((current) => ({
        ...current,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      }));
      toast.success(t("customer.messages.addressLocationCaptured"));
    } catch {
      setError(t("customer.messages.addressLocationUnavailable"));
    } finally {
      setIsLocatingAddress(false);
    }
  }

  function openPasswordSheet() {
    setError(null);
    setPasswordForm(emptyPasswordForm);
    setProfileSheet("password");
  }

  async function handleUpdateProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmittingProfile(true);

    try {
      if (!profileForm.accountName.trim()) {
        throw new Error(t("customer.messages.nameRequired"));
      }

      const updated = await updateCustomerProfile(profileForm);
      setProfile(updated);
      setProfileForm(toProfileForm(updated));
      setProfileSheet(null);
      toast.success(t("customer.messages.profileSaved"));
    } catch (nextError) {
      setError(getErrorMessage(nextError, t("common.errors.genericAction")));
    } finally {
      setIsSubmittingProfile(false);
    }
  }

  async function handleSaveContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
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
      toast.success(
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
      toast.success(t("customer.messages.contactDeleted"));
    } catch (nextError) {
      setError(getErrorMessage(nextError, t("common.errors.genericAction")));
    } finally {
      setContactActionId(null);
    }
  }

  function requestDeleteContact(customerId: string) {
    setError(null);
    setConfirmTarget({ kind: "delete-contact", customerId });
  }

  async function handleSaveAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
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
      toast.success(
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
    setAddressActionId(`delete-${addressId}`);

    try {
      await deleteCustomerAddress(addressId);
      setAddressBook((current) => current.filter((address) => address.id !== addressId));
      setAppointmentForm((current) =>
        current.addressId === addressId
          ? { ...current, addressId: CUSTOM_APPOINTMENT_ADDRESS_ID }
          : current,
      );
      toast.success(t("customer.messages.addressDeleted"));
    } catch (nextError) {
      setError(getErrorMessage(nextError, t("common.errors.genericAction")));
    } finally {
      setAddressActionId(null);
    }
  }

  function requestDeleteAddress(addressId: string) {
    setError(null);
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
      toast.success(t("customer.messages.defaultAddressUpdated"));
    } catch (nextError) {
      setError(getErrorMessage(nextError, t("common.errors.genericAction")));
    } finally {
      setAddressActionId(null);
    }
  }

  async function handleChangePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

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
      toast.success(t("customer.messages.passwordChangedOtherDevices"));
    } catch (nextError) {
      setError(getErrorMessage(nextError, t("common.errors.genericAction")));
    } finally {
      setIsSubmittingPassword(false);
    }
  }

  function openAppointmentSheet() {
    setError(null);
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
  if (!profile) {
    return <CustomerProfileUnavailableState />;
  }

  return (
    <div className="space-y-4">
      <CustomerAccountCard
        profile={profile}
        onEditProfile={onEditProfile}
        onOpenPassword={onOpenPassword}
      />
      <CustomerAddressBookSection
        addressActionId={addressActionId}
        addressBook={addressBook}
        onCreateAddress={onCreateAddress}
        onDeleteAddress={onDeleteAddress}
        onEditAddress={onEditAddress}
        onSetDefaultAddress={onSetDefaultAddress}
      />
      <CustomerLinkedContactsSection
        contactActionId={contactActionId}
        contacts={profile.addresses}
        onCreateContact={onCreateContact}
        onDeleteContact={onDeleteContact}
        onEditContact={onEditContact}
      />
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
