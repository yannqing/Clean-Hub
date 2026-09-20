"use client";

import type {
  TenantCustomerAccountCustomersResponse,
  TenantCustomerAccountDetail,
  TenantCustomerStatus,
} from "@cleanhub/api-client";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Icon,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from "@cleanhub/ui";
import { DataTable, DataTablePagePagination } from "@cleanhub/ui/data-table";
import {
  ChevronRight,
  ContactRound,
  Copy,
  KeyRound,
  LoaderCircle,
  Mail,
  Pencil,
  Phone,
  UserRound,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { interpolate, useTenantI18n } from "@/i18n";

import {
  resetTenantCustomerAccountPasswordAction,
  updateTenantCustomerAccountAction,
} from "../actions";
import { getTenantCustomerAccountCustomersQuery } from "../queries";

const PAGE_SIZE = 10;

type AccountForm = {
  accountName: string;
  phone: string;
  email: string;
  status: TenantCustomerStatus;
};

function toAccountForm(account: TenantCustomerAccountDetail): AccountForm {
  return {
    accountName: account.accountName,
    phone: account.phone ?? "",
    email: account.email ?? "",
    status: account.status,
  };
}

export function TenantCustomerAccountDetailView({
  initialAccount,
  initialCustomers,
  initialEditing = false,
}: {
  initialAccount: TenantCustomerAccountDetail;
  initialCustomers: TenantCustomerAccountCustomersResponse;
  initialEditing?: boolean;
}) {
  const router = useRouter();
  const { formatDateTime, locale, m } = useTenantI18n();
  const copy = m.customers.accounts.detail;
  const [account, setAccount] = useState(initialAccount);
  const [customersResult, setCustomersResult] = useState(initialCustomers);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState<string | null>(null);
  const [editing, setEditing] = useState(initialEditing);
  const [form, setForm] = useState<AccountForm>(() => toAccountForm(account));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // The issued password lives only in this state: the API returns it once and
  // never stores anything readable, so closing the panel really does discard it.
  const [appPassword, setAppPassword] = useState<string | null>(null);
  const [issuingPassword, setIssuingPassword] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const nextSearch = search.trim();
      if (nextSearch === debouncedSearch) return;
      setCustomersLoading(true);
      setCustomersError(null);
      setDebouncedSearch(nextSearch);
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [debouncedSearch, search]);

  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    getTenantCustomerAccountCustomersQuery(
      account.id,
      {
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        q: debouncedSearch || undefined,
      },
      { signal: controller.signal },
    )
      .then((result) => {
        if (current) setCustomersResult(result);
      })
      .catch((error: unknown) => {
        if (!current || controller.signal.aborted) return;
        setCustomersError(
          error instanceof Error ? error.message : m.customers.loadError,
        );
      })
      .finally(() => {
        if (current) setCustomersLoading(false);
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [account.id, debouncedSearch, m.customers.loadError, page]);

  const totalPages = Math.max(
    1,
    Math.ceil(customersResult.total / PAGE_SIZE),
  );

  function openEditor() {
    setForm(toAccountForm(account));
    setFormError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setForm(toAccountForm(account));
    setFormError(null);
    setEditing(false);
    router.replace(webAdminRoutes.tenant.customerAccount(account.id), {
      scroll: false,
    });
  }

  async function saveAccount() {
    const accountName = form.accountName.trim();
    const phone = form.phone.trim();
    const email = form.email.trim();
    if (!accountName) {
      setFormError(copy.accountNameRequired);
      return;
    }
    if (!phone && !email) {
      setFormError(copy.contactRequired);
      return;
    }

    setSaving(true);
    setFormError(null);
    const result = await updateTenantCustomerAccountAction(account.id, {
      accountName,
      email: email || null,
      phone: phone || null,
      status: form.status,
      version: account.version,
    });
    setSaving(false);

    if (!result.ok) {
      setFormError(
        result.code === "ACCOUNT_VERSION_CONFLICT"
          ? copy.versionConflict
          : result.code === "ACCOUNT_CONTACT_REQUIRED"
            ? copy.contactRequired
            : result.code === "ACCOUNT_PHONE_CONFLICT"
              ? copy.phoneConflict
              : result.code === "ACCOUNT_EMAIL_CONFLICT"
                ? copy.emailConflict
            : result.message || copy.saveError,
      );
      return;
    }

    setAccount(result.data);
    setForm(toAccountForm(result.data));
    setEditing(false);
    toast.success(copy.saveSuccess);
    router.replace(webAdminRoutes.tenant.customerAccount(result.data.id), {
      scroll: false,
    });
    router.refresh();
  }

  async function issueAppPassword() {
    setIssuingPassword(true);
    const result = await resetTenantCustomerAccountPasswordAction(account.id);
    setIssuingPassword(false);

    if (!result.ok) {
      toast.error(
        result.code === "ACCOUNT_DISABLED"
          ? copy.appPasswordDisabled
          : result.message || copy.appPasswordError,
      );
      return;
    }

    setAppPassword(result.data.temporaryPassword);
    toast.success(copy.appPasswordSuccess);
  }

  async function copyAppPassword() {
    if (!appPassword) return;

    try {
      await navigator.clipboard.writeText(appPassword);
      toast.success(copy.appPasswordCopied);
    } catch {
      // Clipboard access can be blocked; the password stays on screen to read.
    }
  }

  return (
    <section
      className="mx-auto w-full max-w-[1120px] space-y-5 pb-20"
      data-testid="tenant-customer-account-detail-view"
    >
      <header className="space-y-3">
        <nav aria-label={copy.breadcrumbLabel}>
          <ol className="flex items-center gap-2 text-sm">
            <li>
              <Link
                aria-label={copy.backToAccounts}
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                href={webAdminRoutes.tenant.customerAccounts}
                title={m.customers.accounts.title}
              >
                <Icon aria-hidden icon={UsersRound} size={16} />
              </Link>
            </li>
            <li aria-hidden className="text-muted-foreground">
              <Icon aria-hidden icon={ChevronRight} size={14} />
            </li>
            <li>
              <span
                aria-current="page"
                className="block max-w-64 truncate font-medium"
              >
                {account.accountName}
              </span>
            </li>
          </ol>
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {account.accountName}
            </h1>
            <Badge variant={account.status === "active" ? "default" : "outline"}>
              {m.customers.statusLabels[account.status]}
            </Badge>
          </div>
          {!editing ? (
            <Button
              className="gap-2"
              onClick={openEditor}
              size="sm"
              type="button"
            >
              <Icon aria-hidden icon={Pencil} size={14} />
              {copy.editAction}
            </Button>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {account.id} · {formatDateTime(account.createdAt)}
        </p>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="grid min-w-0 gap-5">
          <Card className="gap-0 rounded-xl py-0 shadow-none">
            <CardContent className="py-5">
              <div className="flex items-center gap-2">
                <Icon aria-hidden icon={UserRound} size={17} />
                <h2 className="text-sm font-semibold">{copy.summaryTitle}</h2>
              </div>
              {editing ? (
                <div className="mt-5 grid gap-5">
                  <p className="text-sm text-muted-foreground">
                    {copy.editDescription}
                  </p>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="grid gap-2 sm:col-span-2">
                      <Label htmlFor="customer-account-name">
                        {copy.accountName}
                      </Label>
                      <Input
                        autoFocus
                        id="customer-account-name"
                        maxLength={200}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            accountName: event.target.value,
                          }))
                        }
                        value={form.accountName}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="customer-account-phone">
                        {copy.phone}
                      </Label>
                      <Input
                        id="customer-account-phone"
                        maxLength={32}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            phone: event.target.value,
                          }))
                        }
                        value={form.phone}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="customer-account-email">
                        {copy.email}
                      </Label>
                      <Input
                        id="customer-account-email"
                        maxLength={320}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            email: event.target.value,
                          }))
                        }
                        type="email"
                        value={form.email}
                      />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                      <Label htmlFor="customer-account-status">
                        {copy.status}
                      </Label>
                      <Select
                        onValueChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            status: value as TenantCustomerStatus,
                          }))
                        }
                        value={form.status}
                      >
                        <SelectTrigger id="customer-account-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">
                            {m.customers.statusLabels.active}
                          </SelectItem>
                          <SelectItem value="disabled">
                            {m.customers.statusLabels.disabled}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {formError ? (
                    <p
                      className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
                      role="alert"
                    >
                      {formError}
                    </p>
                  ) : null}
                </div>
              ) : (
                <dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon aria-hidden icon={Phone} size={13} />
                      {copy.phone}
                    </dt>
                    <dd className="mt-1 font-medium">
                      {account.phone || m.customers.notProvided}
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon aria-hidden icon={Mail} size={13} />
                      {copy.email}
                    </dt>
                    <dd className="mt-1 break-all font-medium">
                      {account.email || m.customers.notProvided}
                    </dd>
                  </div>
                </dl>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 overflow-hidden rounded-xl py-0 shadow-none">
            <CardContent className="p-0">
              <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Icon aria-hidden icon={ContactRound} size={17} />
                    <h2 className="text-sm font-semibold">
                      {copy.linkedCustomersTitle}
                    </h2>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {interpolate(copy.linkedCustomersDescription, {
                      count: account.customerCount.toLocaleString(locale),
                    })}
                  </p>
                </div>
                <Input
                  aria-label={m.customers.toolbar.searchLabel}
                  className="h-8 w-full text-xs sm:w-64"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={m.customers.toolbar.searchPlaceholder}
                  value={search}
                />
              </div>

              {customersLoading ? (
                <div className="grid gap-2 border-t p-4">
                  {[0, 1, 2].map((row) => (
                    <div className="h-9 animate-pulse rounded bg-muted" key={row} />
                  ))}
                </div>
              ) : customersError ? (
                <p className="border-t px-5 py-8 text-center text-sm text-destructive">
                  {customersError}
                </p>
              ) : customersResult.data.length === 0 ? (
                <p className="border-t px-5 py-10 text-center text-sm text-muted-foreground">
                  {copy.linkedCustomersEmpty}
                </p>
              ) : (
                <DataTable className="border-t text-xs [&_td]:py-2">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{m.customers.columns.customer}</TableHead>
                      <TableHead>{m.customers.columns.phone}</TableHead>
                      <TableHead>{m.customers.columns.email}</TableHead>
                      <TableHead>{m.customers.columns.status}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customersResult.data.map((customer) => (
                      <TableRow
                        aria-label={interpolate(
                          m.customers.detail.openCustomer,
                          { customer: customer.fullName },
                        )}
                        className="cursor-pointer transition-colors focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        key={customer.id}
                        onClick={() =>
                          router.push(
                            webAdminRoutes.tenant.customerFromAccount(
                              customer.id,
                              account.id,
                            ),
                          )
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            router.push(
                              webAdminRoutes.tenant.customerFromAccount(
                                customer.id,
                                account.id,
                              ),
                            );
                          }
                        }}
                        role="link"
                        tabIndex={0}
                      >
                        <TableCell className="font-medium">{customer.fullName}</TableCell>
                        <TableCell>{customer.phone || m.customers.notProvided}</TableCell>
                        <TableCell>{customer.email || m.customers.notProvided}</TableCell>
                        <TableCell>
                          <Badge
                            className="px-1.5 py-px text-[11px]"
                            variant={customer.status === "active" ? "default" : "outline"}
                          >
                            {m.customers.statusLabels[customer.status]}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </DataTable>
              )}

              <DataTablePagePagination
                loading={customersLoading}
                nextLabel={m.common.next}
                onPageChange={(nextPage) => {
                  setCustomersLoading(true);
                  setCustomersError(null);
                  setPage(nextPage);
                }}
                page={page}
                previousLabel={m.common.previous}
                totalPages={totalPages}
              />
            </CardContent>
          </Card>
        </main>

        <aside className="grid gap-5">
          <Card className="gap-0 rounded-xl py-0 shadow-none">
            <CardContent className="py-5">
              <div className="flex items-center gap-2">
                <Icon aria-hidden icon={KeyRound} size={17} />
                <h2 className="text-sm font-semibold">
                  {copy.appPasswordTitle}
                </h2>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {copy.appPasswordDescription}
              </p>
              {appPassword ? (
                <div className="mt-4 grid gap-3">
                  <code
                    className="rounded-md bg-muted px-3 py-2 font-mono text-sm break-all select-all"
                    data-testid="customer-app-password"
                  >
                    {appPassword}
                  </code>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="gap-2"
                      onClick={() => void copyAppPassword()}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Icon aria-hidden icon={Copy} size={14} />
                      {copy.appPasswordCopy}
                    </Button>
                    <Button
                      onClick={() => setAppPassword(null)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      {copy.appPasswordDone}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  className="mt-4 gap-2"
                  disabled={issuingPassword || account.status === "disabled"}
                  onClick={() => void issueAppPassword()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {issuingPassword ? (
                    <Icon
                      aria-hidden
                      className="animate-spin"
                      icon={LoaderCircle}
                      size={14}
                    />
                  ) : (
                    <Icon aria-hidden icon={KeyRound} size={14} />
                  )}
                  {issuingPassword
                    ? copy.appPasswordPending
                    : copy.appPasswordAction}
                </Button>
              )}
              {account.status === "disabled" ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  {copy.appPasswordDisabled}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="gap-0 rounded-xl py-0 shadow-none">
            <CardContent className="py-5">
              <h2 className="text-sm font-semibold">{copy.recordDetailsTitle}</h2>
              <dl className="mt-5 grid gap-4 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">{copy.accountId}</dt>
                  <dd className="mt-1 break-all font-medium">{account.id}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{copy.createdAt}</dt>
                  <dd className="mt-1 font-medium">{formatDateTime(account.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{copy.updatedAt}</dt>
                  <dd className="mt-1 font-medium">{formatDateTime(account.updatedAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{copy.version}</dt>
                  <dd className="mt-1 font-medium">v{account.version}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>

      {editing ? (
        <div className="pointer-events-none sticky bottom-4 z-30 flex justify-end px-1">
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-xl border border-border/80 bg-background/90 p-1.5 shadow-[0_14px_40px_-16px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <Button
              disabled={saving}
              onClick={cancelEditing}
              size="sm"
              type="button"
              variant="ghost"
            >
              {m.common.cancel}
            </Button>
            <Button
              aria-busy={saving}
              className="min-w-28 gap-2"
              disabled={saving}
              onClick={() => void saveAccount()}
              size="sm"
              type="button"
            >
              {saving ? (
                <Icon
                  aria-hidden
                  className="animate-spin"
                  icon={LoaderCircle}
                  size={14}
                />
              ) : null}
              {saving ? m.common.saving : copy.saveAction}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
