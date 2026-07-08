"use client";

import { useMemo } from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import type {
  MobileCustomerAddress,
  MobileCustomerBranchOption,
} from "@cleanhub/api-client";
import { useTranslation } from "@cleanhub/i18n/react";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
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
  KeyRound,
  LocateFixed,
  Loader2,
  MapPin,
  RotateCcw,
} from "lucide-react";

import { formatTenantMoney } from "@/lib/currency";
import {
  getCountryFlag,
  getCountryOptions,
  getIntlLocale,
  normalizeCountryCode,
} from "../lib/country";
import {
  CUSTOM_APPOINTMENT_ADDRESS_ID,
  appointmentTypeKeys,
  formatCustomerAddress,
  getMinimumAppointmentDateValue,
} from "../lib/format";
import type {
  AppointmentFormState,
  CustomerAddressFormState,
  CustomerContactFormState,
  CustomerPasswordFormState,
  CustomerProfileFormState,
} from "../lib/format";

export type RefundFormState = {
  orderId: string;
  amount: string;
  reason: string;
};

type FormStateSetter<T> = Dispatch<SetStateAction<T>>;
type FormSubmitHandler = (event: FormEvent<HTMLFormElement>) => void;

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

type AppointmentFormSheetProps = {
  addressBook: MobileCustomerAddress[];
  branches: MobileCustomerBranchOption[];
  error: string | null;
  form: AppointmentFormState;
  isSubmitting: boolean;
  open: boolean;
  onFormChange: FormStateSetter<AppointmentFormState>;
  onOpenChange: (open: boolean) => void;
  onSubmit: FormSubmitHandler;
};

export function AppointmentFormSheet({
  addressBook,
  branches,
  error,
  form,
  isSubmitting,
  open,
  onFormChange,
  onOpenChange,
  onSubmit,
}: AppointmentFormSheetProps) {
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

type AppointmentFormProps = {
  addressBook: MobileCustomerAddress[];
  branches: MobileCustomerBranchOption[];
  form: AppointmentFormState;
  isSubmitting: boolean;
  onFormChange: FormStateSetter<AppointmentFormState>;
  onSubmit: FormSubmitHandler;
};

export function AppointmentForm({
  addressBook,
  branches,
  form,
  isSubmitting,
  onFormChange,
  onSubmit,
}: AppointmentFormProps) {
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

type RefundRequestSheetProps = {
  currency: string;
  error: string | null;
  form: RefundFormState;
  isSubmitting: boolean;
  open: boolean;
  onFormChange: FormStateSetter<RefundFormState>;
  onOpenChange: (open: boolean) => void;
  onSubmit: FormSubmitHandler;
};

export function RefundRequestSheet({
  currency,
  error,
  form,
  isSubmitting,
  open,
  onFormChange,
  onOpenChange,
  onSubmit,
}: RefundRequestSheetProps) {
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

type ProfileFormSheetProps = {
  error: string | null;
  form: CustomerProfileFormState;
  isSubmitting: boolean;
  open: boolean;
  onFormChange: FormStateSetter<CustomerProfileFormState>;
  onOpenChange: (open: boolean) => void;
  onSubmit: FormSubmitHandler;
};

export function ProfileFormSheet({
  error,
  form,
  isSubmitting,
  open,
  onFormChange,
  onOpenChange,
  onSubmit,
}: ProfileFormSheetProps) {
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

type ContactFormSheetProps = {
  error: string | null;
  form: CustomerContactFormState;
  isEditing: boolean;
  isSubmitting: boolean;
  open: boolean;
  onFormChange: FormStateSetter<CustomerContactFormState>;
  onOpenChange: (open: boolean) => void;
  onSubmit: FormSubmitHandler;
};

export function ContactFormSheet({
  error,
  form,
  isEditing,
  isSubmitting,
  open,
  onFormChange,
  onOpenChange,
  onSubmit,
}: ContactFormSheetProps) {
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

type AddressFormSheetProps = {
  error: string | null;
  form: CustomerAddressFormState;
  isEditing: boolean;
  isLocating: boolean;
  isSubmitting: boolean;
  open: boolean;
  onFormChange: FormStateSetter<CustomerAddressFormState>;
  onLocate: () => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: FormSubmitHandler;
};

export function AddressFormSheet({
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
}: AddressFormSheetProps) {
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

type PasswordFormSheetProps = {
  error: string | null;
  form: CustomerPasswordFormState;
  isSubmitting: boolean;
  open: boolean;
  onFormChange: FormStateSetter<CustomerPasswordFormState>;
  onOpenChange: (open: boolean) => void;
  onSubmit: FormSubmitHandler;
};

export function PasswordFormSheet({
  error,
  form,
  isSubmitting,
  open,
  onFormChange,
  onOpenChange,
  onSubmit,
}: PasswordFormSheetProps) {
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
