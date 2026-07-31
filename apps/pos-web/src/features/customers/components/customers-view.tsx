"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { Icon, PosBreadcrumb } from "@/components/app-shell";
import { posToast as toast } from "@/lib/pos-toast";

import { customerDetailPath } from "@/config";

import {
  CUSTOMER_COLUMN_KEYS,
  CUSTOMER_DEFAULT_FILTERS,
  type CustomerColumnKey,
} from "../constants";
import {
  changeAccountStatus,
  changeProfileStatus,
  fetchAccountOptions,
  fetchAccountProfiles,
  fetchCustomerList,
} from "../queries";
import type {
  CustomerDialogState,
  CustomerFilterState,
  CustomerListRow,
  CustomerStatusFilter,
  CustomerViewMode,
  PosCustomerAccountSummary,
} from "../types";
import { AccountFormDialog } from "./account-form-dialog";
import { CustomerDeleteDialog } from "./customer-delete-dialog";
import { CustomerPagination } from "./customer-pagination";
import { CustomerSearchBar } from "./customer-search-bar";
import { CustomerTable } from "./customer-table";
import { ProfileFormDialog } from "./profile-form-dialog";

/**
 * Page container for customer management. Holds the two view modes (full list
 * vs. an account's profiles), filter/pagination state, and which dialog is
 * open. All data is fetched client-side via the queries module.
 */
type CustomersViewProps = {
  canDelete?: boolean;
  initialQuery?: string;
};

export function CustomersView({
  canDelete = false,
  initialQuery = "",
}: CustomersViewProps) {
  const router = useRouter();
  const normalizedInitialQuery = initialQuery.trim();
  const [viewMode, setViewMode] = useState<CustomerViewMode>("list");
  const [accountContext, setAccountContext] = useState<{
    accountId: string;
    accountName: string;
  } | null>(null);
  const [previousFilters, setPreviousFilters] =
    useState<CustomerFilterState | null>(null);

  const [filters, setFilters] = useState<CustomerFilterState>({
    ...CUSTOMER_DEFAULT_FILTERS,
    query: normalizedInitialQuery,
  });
  const [draftQuery, setDraftQuery] = useState(normalizedInitialQuery);

  const [rows, setRows] = useState<CustomerListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [totalProfiles, setTotalProfiles] = useState(0);
  const [loading, setLoading] = useState(false);
  const reloadRequestIdRef = useRef(0);
  const [visibleColumns, setVisibleColumns] = useState<Set<CustomerColumnKey>>(
    () => new Set(CUSTOMER_COLUMN_KEYS),
  );

  const [accounts, setAccounts] = useState<PosCustomerAccountSummary[]>([]);
  const [dialog, setDialog] = useState<CustomerDialogState>({ type: "none" });

  // Load account options independently so the profile form dropdown is always
  // populated, regardless of which page/filter the list is showing.
  useEffect(() => {
    let cancelled = false;
    void fetchAccountOptions().then((result) => {
      if (!cancelled) setAccounts(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const reload = useCallback(async () => {
    const requestId = reloadRequestIdRef.current + 1;
    reloadRequestIdRef.current = requestId;
    setLoading(true);
    try {
      let data: { rows: CustomerListRow[]; total: number };
      if (viewMode === "account" && accountContext) {
        data = await fetchAccountProfiles(accountContext.accountId, filters);
        if (reloadRequestIdRef.current !== requestId) return;
        setRows(data.rows);
        setTotal(data.total);
        setTotalAccounts(0);
        setTotalProfiles(0);
      } else {
        const listData = await fetchCustomerList(filters);
        data = listData;
        if (reloadRequestIdRef.current !== requestId) return;
        setRows(listData.rows);
        setTotal(listData.total);
        setTotalAccounts(listData.totalAccounts);
        setTotalProfiles(listData.totalProfiles);
      }
    } catch (error) {
      if (reloadRequestIdRef.current !== requestId) return;
      toast.error(
        error instanceof Error ? error.message : "加载数据失败，请重试。",
      );
      setRows([]);
      setTotal(0);
    } finally {
      if (reloadRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [viewMode, accountContext, filters]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial/dependent data fetch; setState happens in the async continuation, not synchronously in the effect body.
    void reload();
  }, [reload]);

  // ---- search / pagination handlers ---------------------------------------

  function replaceCustomerQueryParam(value: string | undefined) {
    const search = new URLSearchParams();
    if (value) {
      search.set("q", value);
    }

    const queryString = search.toString();
    router.replace(queryString ? `/customers?${queryString}` : "/customers", {
      scroll: false,
    });
  }

  function handleSearch() {
    const query = draftQuery.trim();
    if (query === filters.query) {
      return;
    }
    setFilters((current) => ({ ...current, query, page: 1 }));
    if (viewMode === "list") {
      replaceCustomerQueryParam(query || undefined);
    }
  }

  function handleReset() {
    setDraftQuery("");
    setFilters({
      ...CUSTOMER_DEFAULT_FILTERS,
      resultType: accountContext ? "all" : CUSTOMER_DEFAULT_FILTERS.resultType,
    });
    if (viewMode === "list") {
      replaceCustomerQueryParam(undefined);
    }
  }

  function handleResultTypeChange(value: CustomerFilterState["resultType"]) {
    setFilters((current) => ({ ...current, resultType: value, page: 1 }));
  }

  function handleStatusChange(value: CustomerStatusFilter) {
    setFilters((current) => ({ ...current, status: value, page: 1 }));
  }

  function handlePageChange(page: number) {
    setFilters((current) => ({ ...current, page }));
  }

  function handleColumnVisibleChange(
    column: CustomerColumnKey,
    checked: boolean,
  ) {
    setVisibleColumns((current) => {
      if (!checked && current.has(column) && current.size === 1) {
        return current;
      }
      const next = new Set(current);
      if (checked) {
        next.add(column);
      } else {
        next.delete(column);
      }
      return next;
    });
  }

  // ---- view mode handlers --------------------------------------------------

  function handleViewProfiles(accountId: string) {
    const account = rows.find(
      (row): row is Extract<CustomerListRow, { kind: "account" }> =>
        row.kind === "account" && row.id === accountId,
    );
    setPreviousFilters(filters);
    setAccountContext({ accountId, accountName: account?.accountName ?? "" });
    setFilters({ ...CUSTOMER_DEFAULT_FILTERS });
    setDraftQuery("");
    setViewMode("account");
  }

  function handleBackToList() {
    setViewMode("list");
    setAccountContext(null);
    if (previousFilters) {
      setFilters(previousFilters);
      setDraftQuery(previousFilters.query);
    }
    setPreviousFilters(null);
  }

  // ---- status toggle -------------------------------------------------------

  async function handleToggleStatus(row: CustomerListRow) {
    const nextStatus = row.status === "active" ? "disabled" : "active";
    try {
      if (row.kind === "account") {
        await changeAccountStatus(row.id, { status: nextStatus });
      } else {
        await changeProfileStatus(row.id, { status: nextStatus });
      }
      toast.success(nextStatus === "active" ? "已恢复正常" : "已停用");
      void reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "操作失败，请重试。",
      );
    }
  }

  // ---- dialog openers ------------------------------------------------------

  function openCreateAccount() {
    setDialog({ type: "create-account" });
  }

  function openCreateProfile() {
    setDialog({ type: "create-profile" });
  }

  function openEdit(row: CustomerListRow) {
    if (row.kind === "account") {
      setDialog({ type: "edit-account", accountId: row.id });
    } else {
      setDialog({ type: "edit-profile", customerId: row.id });
    }
  }

  function openDelete(row: CustomerListRow) {
    if (row.kind === "account") {
      setDialog({
        type: "delete-account",
        accountId: row.id,
        accountName: row.accountName,
      });
    } else {
      setDialog({
        type: "delete-profile",
        customerId: row.id,
        fullName: row.fullName,
      });
    }
  }

  // ---- header actions ------------------------------------------------------

  const currentAccount = viewMode === "account" ? accountContext : null;

  return (
    <div className="space-y-7 pb-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {currentAccount ? (
            <PosBreadcrumb
              className="mb-2"
              items={[
                { label: "客户管理", onClick: handleBackToList },
                { label: currentAccount.accountName },
              ]}
            />
          ) : null}
          <h1 className="flex min-w-0 items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
            <Icon className="size-[19px]" name="users" />
            <span className="truncate">
              {currentAccount
                ? `${currentAccount.accountName}的客户档案`
                : "客户"}
            </span>
          </h1>
        </div>
        <div className="flex gap-2">
          {currentAccount ? (
            <>
              <button
                className="flex h-8 items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium transition-colors hover:bg-accent"
                type="button"
                onClick={handleBackToList}
              >
                返回客户列表
              </button>
              <button
                className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                type="button"
                onClick={openCreateProfile}
              >
                新增档案
              </button>
            </>
          ) : (
            <>
              <button
                className="h-8 rounded-md border bg-background px-3 text-xs font-medium transition-colors hover:bg-accent"
                type="button"
                onClick={openCreateProfile}
              >
                新增档案
              </button>
              <button
                className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                type="button"
                onClick={openCreateAccount}
              >
                新增账户
              </button>
            </>
          )}
        </div>
      </header>

      <CustomerMetrics
        accountContext={viewMode === "account"}
        activeOnPage={rows.filter((row) => row.status === "active").length}
        loading={loading}
        total={total}
        totalAccounts={totalAccounts}
        totalProfiles={totalProfiles}
      />

      <section className="min-w-0 overflow-hidden border-y bg-background">
        <CustomerSearchBar
          accountContext={viewMode === "account"}
          draftQuery={draftQuery}
          filters={filters}
          onColumnVisibleChange={handleColumnVisibleChange}
          onDraftQueryChange={setDraftQuery}
          onReset={handleReset}
          onResultTypeChange={handleResultTypeChange}
          onSearch={handleSearch}
          onStatusChange={handleStatusChange}
          visibleColumns={visibleColumns}
        />
        <CustomerTable
          accountContext={viewMode === "account"}
          loading={loading}
          rows={rows}
          visibleColumns={visibleColumns}
          onDelete={canDelete ? openDelete : undefined}
          onEdit={openEdit}
          onService={(row) => router.push(customerDetailPath(row.id))}
          onToggleStatus={handleToggleStatus}
          onViewProfiles={handleViewProfiles}
        />
        <CustomerPagination
          onPageChange={handlePageChange}
          page={filters.page}
          pageSize={filters.pageSize}
          total={total}
        />
      </section>

      {/* Dialogs */}
      <AccountFormDialog
        key={
          dialog.type === "edit-account"
            ? `edit-account-${dialog.accountId}`
            : "create-account"
        }
        accountId={
          dialog.type === "edit-account" ? dialog.accountId : undefined
        }
        initial={
          dialog.type === "edit-account"
            ? (() => {
                const row = rows.find(
                  (row): row is Extract<CustomerListRow, { kind: "account" }> =>
                    row.kind === "account" && row.id === dialog.accountId,
                );
                return row
                  ? {
                      accountName: row.accountName,
                      phone: row.phone ?? "",
                      email: row.email ?? "",
                    }
                  : undefined;
              })()
            : undefined
        }
        mode={dialog.type === "edit-account" ? "edit" : "create"}
        onOpenChange={(open) => {
          if (!open) setDialog({ type: "none" });
        }}
        onSaved={() => void reload()}
        open={
          dialog.type === "create-account" || dialog.type === "edit-account"
        }
      />

      <ProfileFormDialog
        key={
          dialog.type === "edit-profile"
            ? `edit-profile-${dialog.customerId}`
            : `create-profile-${accountContext?.accountId ?? "list"}`
        }
        accounts={accounts}
        customerId={
          dialog.type === "edit-profile" ? dialog.customerId : undefined
        }
        initial={
          dialog.type === "edit-profile"
            ? (() => {
                const row = rows.find(
                  (row): row is Extract<CustomerListRow, { kind: "profile" }> =>
                    row.kind === "profile" && row.id === dialog.customerId,
                );
                return row
                  ? {
                      customerAccountId: row.customerAccountId,
                      fullName: row.fullName,
                      phone: row.phone ?? "",
                      email: row.email ?? "",
                      relationship: "本人",
                      address: "",
                      notes: "",
                    }
                  : undefined;
              })()
            : undefined
        }
        lockedAccountId={accountContext?.accountId}
        mode={dialog.type === "edit-profile" ? "edit" : "create"}
        onOpenChange={(open) => {
          if (!open) setDialog({ type: "none" });
        }}
        onSaved={() => void reload()}
        open={
          dialog.type === "create-profile" || dialog.type === "edit-profile"
        }
      />

      <CustomerDeleteDialog
        id={
          dialog.type === "delete-account"
            ? dialog.accountId
            : dialog.type === "delete-profile"
              ? dialog.customerId
              : ""
        }
        kind={dialog.type === "delete-account" ? "account" : "profile"}
        linkedCount={
          dialog.type === "delete-account"
            ? rows.filter(
                (row) =>
                  row.kind === "profile" &&
                  row.customerAccountId === dialog.accountId,
              ).length
            : 0
        }
        name={
          dialog.type === "delete-account"
            ? dialog.accountName
            : dialog.type === "delete-profile"
              ? dialog.fullName
              : ""
        }
        onDeleted={() => {
          if (viewMode === "account") handleBackToList();
          else void reload();
        }}
        onOpenChange={(open) => {
          if (!open) setDialog({ type: "none" });
        }}
        open={
          dialog.type === "delete-account" || dialog.type === "delete-profile"
        }
      />
    </div>
  );
}

function CustomerMetrics({
  accountContext,
  activeOnPage,
  loading,
  total,
  totalAccounts,
  totalProfiles,
}: {
  accountContext: boolean;
  activeOnPage: number;
  loading: boolean;
  total: number;
  totalAccounts: number;
  totalProfiles: number;
}) {
  const metrics: Array<{
    label: string;
    value: number;
    icon: Parameters<typeof Icon>[0]["name"];
  }> = [
    { label: "匹配结果", value: total, icon: "users" },
    {
      label: "客户账户",
      value: accountContext ? 1 : totalAccounts,
      icon: "user-circle",
    },
    {
      label: "客户档案",
      value: accountContext ? total : totalProfiles,
      icon: "user-plus",
    },
    { label: "本页正常", value: activeOnPage, icon: "package-check" },
  ];

  return (
    <section
      aria-label="客户统计"
      className="grid grid-cols-2 gap-2.5 xl:grid-cols-4"
    >
      {metrics.map((metric) => (
        <div
          className="flex min-h-20 items-center gap-2.5 rounded-md border bg-background px-3 py-2.5"
          key={metric.label}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icon className="size-[15px]" name={metric.icon} />
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] font-medium text-muted-foreground">
              {metric.label}
            </span>
            {loading ? (
              <span className="mt-1.5 block h-5 w-16 animate-pulse rounded bg-muted" />
            ) : (
              <span className="mt-0.5 block truncate text-lg font-semibold text-foreground">
                {metric.value}
              </span>
            )}
          </span>
        </div>
      ))}
    </section>
  );
}
