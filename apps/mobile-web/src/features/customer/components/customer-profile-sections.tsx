"use client";

import type {
  MobileCustomerAddress,
  MobileCustomerContact,
  MobileCustomerProfile,
} from "@cleanhub/api-client";
import { useTranslation } from "@cleanhub/i18n/react";
import { Badge, Button } from "@cleanhub/ui";
import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2,
  Edit3,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";

type Translator = ReturnType<typeof useTranslation>["t"];

type StatusView = {
  label: string;
  className: string;
};

function getAccountStatusView(
  t: Translator,
  status: MobileCustomerProfile["account"]["status"] | MobileCustomerContact["status"],
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

function ContactLine({ icon: Icon, value }: { icon: LucideIcon; value: string | null }) {
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

function StatusBadge({ view }: { view: StatusView }) {
  return (
    <Badge className={`${view.className} rounded-md border px-2.5 py-1`} variant="outline">
      <CheckCircle2 className="size-3" aria-hidden="true" />
      {view.label}
    </Badge>
  );
}

function ProfileEmptyState({
  action,
  body,
  icon: Icon,
  title,
}: {
  action?: React.ReactNode;
  body: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <section className="rounded-md border border-dashed border-slate-300 bg-white p-5 text-center">
      <div className="mx-auto flex size-11 items-center justify-center rounded-md bg-slate-100 text-slate-600">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-slate-950">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-600">{body}</p>
      {action}
    </section>
  );
}

export function CustomerProfileUnavailableState() {
  const { t } = useTranslation();

  return (
    <ProfileEmptyState
      icon={UserRound}
      title={t("customer.empty.profileUnavailableTitle")}
      body={t("customer.empty.profileUnavailableBody")}
    />
  );
}

export function CustomerAccountCard({
  profile,
  onEditProfile,
  onOpenPassword,
}: {
  profile: MobileCustomerProfile;
  onEditProfile: () => void;
  onOpenPassword: () => void;
}) {
  const { t } = useTranslation();

  return (
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
  );
}

export function CustomerAddressBookSection({
  addressActionId,
  addressBook,
  onCreateAddress,
  onDeleteAddress,
  onEditAddress,
  onSetDefaultAddress,
}: {
  addressActionId: string | null;
  addressBook: MobileCustomerAddress[];
  onCreateAddress: () => void;
  onDeleteAddress: (addressId: string) => void;
  onEditAddress: (address: MobileCustomerAddress) => void;
  onSetDefaultAddress: (addressId: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <>
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
        <ProfileEmptyState
          icon={MapPin}
          title={t("customer.empty.noAddressTitle")}
          body={t("customer.empty.noAddressBody")}
        />
      )}
    </>
  );
}

export function CustomerLinkedContactsSection({
  contactActionId,
  contacts,
  onCreateContact,
  onDeleteContact,
  onEditContact,
}: {
  contactActionId: string | null;
  contacts: MobileCustomerContact[];
  onCreateContact: () => void;
  onDeleteContact: (customerId: string) => void;
  onEditContact: (contact: MobileCustomerContact) => void;
}) {
  const { t } = useTranslation();

  if (!contacts.length) {
    return (
      <ProfileEmptyState
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
    );
  }

  return (
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
      {contacts.map((contact) => (
        <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm" key={contact.customerId}>
          <div className="flex items-start gap-3">
            <button
              className="min-w-0 flex-1 text-left"
              type="button"
              onClick={() => onEditContact(contact)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-slate-950">{contact.fullName}</p>
                  {contact.relationship ? (
                    <p className="mt-1 text-xs font-medium text-slate-500">{contact.relationship}</p>
                  ) : null}
                </div>
                <StatusBadge view={getAccountStatusView(t, contact.status)} />
              </div>

              <div className="mt-4 space-y-2">
                <ContactLine icon={MapPin} value={contact.address} />
                <ContactLine icon={Phone} value={contact.phone} />
                <ContactLine icon={Mail} value={contact.email} />
              </div>
            </button>
            <Button
              className="size-9 shrink-0 p-0"
              disabled={contactActionId === `delete-${contact.customerId}`}
              type="button"
              variant="outline"
              onClick={() => onDeleteContact(contact.customerId)}
            >
              {contactActionId === `delete-${contact.customerId}` ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="size-4" aria-hidden="true" />
              )}
            </Button>
          </div>
        </article>
      ))}
    </section>
  );
}
