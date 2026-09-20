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
import { toast } from "@cleanhub/ui";

import { getMobileSession } from "@/lib/token-storage";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { MobilePageSkeleton } from "@/components/mobile-skeleton";
import { MobilePullToRefresh } from "@/components/mobile-pull-to-refresh";
import { WorkspaceHeader } from "@/components/workspace-header";
import { resolveTenantCurrency } from "@/lib/currency";
import {
  readMobileDetailUrlState,
  writeMobileDetailUrlState,
} from "@/lib/detail-url";
import { getCurrentAddressCoordinates } from "../lib/capacitor";
import { getDeviceCountry } from "../lib/country";
import {
  CUSTOM_APPOINTMENT_ADDRESS_ID,
  emptyActivity,
  emptyAddressForm,
  emptyContactForm,
  emptyPasswordForm,
  filterActivityItems,
  formatCustomerAddress,
  getActivityItems,
  getAddressBookPrimaryAddress,
  getAddressBookPrimaryAddressId,
  getConfirmDescription,
  getConfirmLabel,
  getConfirmTitle,
  getDefaultExpectedAt,
  getErrorMessage,
  getMinimumAppointmentDate,
  getPrimaryAddress,
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
} from "../lib/format";
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
  ActivityDetailSheet,
  ActivityView,
  AlertMessage,
  AppointmentsView,
  CustomerOverviewView,
  CustomerTabBar,
  ProfileView,
  type CustomerTab,
} from "./customer-views";

import {
  cancelCustomerAppointment,
  changeCustomerPassword,
  createCustomerAddress,
  createCustomerAppointment,
  createCustomerContact,
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

type ActivitySelection = {
  kind: ActivityKind;
  id: string;
};

type ProfileSheet = "profile" | "contact" | "address" | "password" | null;

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

type CustomerSnapshotFallback = Omit<CustomerSnapshot, "authContext" | "errorKey">;

function getSettledValue<T>(
  result: PromiseSettledResult<T>,
  fallback: T,
): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

function hasCustomerSnapshotData(snapshot: CustomerSnapshotFallback): boolean {
  return Boolean(
    snapshot.profile ||
      snapshot.addressBook.length ||
      snapshot.branches.length ||
      snapshot.activity.orders.length ||
      snapshot.activity.tickets.length ||
      snapshot.appointments.length ||
      snapshot.refundRequests.length,
  );
}

async function fetchCustomerSnapshot(
  fallback: CustomerSnapshotFallback = {
    profile: null,
    addressBook: [],
    branches: [],
    activity: emptyActivity,
    appointments: [],
    refundRequests: [],
  },
): Promise<CustomerSnapshot> {
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

  const [profile, addressBook, branches, activity, appointments, refundRequests] = await Promise.allSettled([
    getCustomerProfile(),
    getCustomerAddresses(),
    getCustomerBranches(),
    getCustomerOrdersAndTickets(),
    getCustomerAppointments(),
    getCustomerRefundRequests(),
  ]);

  const hasFailedRequest = [
    profile,
    addressBook,
    branches,
    activity,
    appointments,
    refundRequests,
  ].some((result) => result.status === "rejected");
  const nextProfile = getSettledValue(profile, fallback.profile);
  const nextAddressBook = getSettledValue(addressBook, {
    data: fallback.addressBook,
  }).data;
  const nextBranches = getSettledValue(branches, {
    data: fallback.branches,
  }).data;
  const nextActivity = getSettledValue(activity, {
    data: fallback.activity,
  }).data;
  const nextAppointments = sortAppointments(
    getSettledValue(appointments, { data: fallback.appointments }).data,
  );
  const nextRefundRequests = getSettledValue(refundRequests, {
    data: fallback.refundRequests,
  }).data;
  const nextSnapshotData = {
    profile: nextProfile,
    addressBook: nextAddressBook,
    branches: nextBranches,
    activity: nextActivity,
    appointments: nextAppointments,
    refundRequests: nextRefundRequests,
  };

  return {
    authContext: session.authContext,
    ...nextSnapshotData,
    errorKey:
      hasFailedRequest && !hasCustomerSnapshotData(nextSnapshotData)
        ? "common.errors.genericLoad"
        : null,
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
    const currentSnapshotData: CustomerSnapshotFallback = {
      profile,
      addressBook,
      branches,
      activity,
      appointments,
      refundRequests,
    };

    if (mode === "boot") {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    setError(null);

    try {
      const snapshot = await fetchCustomerSnapshot(
        mode === "refresh" ? currentSnapshotData : undefined,
      );
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
      if (mode === "boot" || !hasCustomerSnapshotData(currentSnapshotData)) {
        setError(getErrorMessage(nextError, t("common.errors.genericAction")));
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activity, addressBook, appointments, branches, profile, refundRequests, t]);

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

  const activityItems = useMemo(
    () => getActivityItems(activity, t, refundRequests),
    [activity, refundRequests, t],
  );
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

  // Payment is taken at the counter, so the customer's phone learns about it
  // only by asking again. Refresh the open order when the app comes back to
  // the foreground, which is exactly when someone looks down to check that
  // the cashier's payment went through.
  useEffect(() => {
    const refreshOpenOrder = () => {
      if (
        document.visibilityState !== "visible" ||
        !detailOpen ||
        selectedActivity?.kind !== "order"
      ) {
        return;
      }

      void refreshSelectedOrder(selectedActivity.id).catch((nextError) => {
        setError(getErrorMessage(nextError, t("common.errors.genericAction")));
      });
    };

    window.addEventListener("focus", refreshOpenOrder);
    document.addEventListener("visibilitychange", refreshOpenOrder);

    return () => {
      window.removeEventListener("focus", refreshOpenOrder);
      document.removeEventListener("visibilitychange", refreshOpenOrder);
    };
  }, [detailOpen, refreshSelectedOrder, selectedActivity, t]);

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
    return <MobilePageSkeleton label={t("customer.home.loading")} />;
  }

  return (
    <MobilePullToRefresh
      isRefreshing={isRefreshing}
      label={t("common.refresh")}
      onRefresh={() => loadCustomerData("refresh")}
    >
    <main className="mobile-page mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-[calc(104px+env(safe-area-inset-bottom))] pt-[max(28px,env(safe-area-inset-top))]">
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
        isLoading={isDetailLoading}
        item={activityItems.find(
          (item) => item.kind === selectedActivity?.kind && item.id === selectedActivity.id,
        ) ?? null}
        open={detailOpen}
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
    </MobilePullToRefresh>
  );
}
