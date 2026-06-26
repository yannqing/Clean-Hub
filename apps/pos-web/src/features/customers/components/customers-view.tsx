"use client";

import { useCallback, useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { toast } from "@cleanhub/ui";

import { customerDetailPath } from "@/config";

import { CUSTOMER_DEFAULT_FILTERS } from "../constants";
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
export function CustomersView() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<CustomerViewMode>("list");
  const [accountContext, setAccountContext] =
    useState<{ accountId: string; accountName: string } | null>(null);
  const [previousFilters, setPreviousFilters] =
    useState<CustomerFilterState | null>(null);

  const [filters, setFilters] = useState<CustomerFilterState>({
    ...CUSTOMER_DEFAULT_FILTERS,
  });
  const [draftQuery, setDraftQuery] = useState("");

  const [rows, setRows] = useState<CustomerListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [totalProfiles, setTotalProfiles] = useState(0);
  const [loading, setLoading] = useState(false);

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
    setLoading(true);
    try {
      let data: { rows: CustomerListRow[]; total: number };
      if (viewMode === "account" && accountContext) {
        data = await fetchAccountProfiles(accountContext.accountId, filters);
        setRows(data.rows);
        setTotal(data.total);
        setTotalAccounts(0);
        setTotalProfiles(0);
      } else {
        const listData = await fetchCustomerList(filters);
        data = listData;
        setRows(listData.rows);
        setTotal(listData.total);
        setTotalAccounts(listData.totalAccounts);
        setTotalProfiles(listData.totalProfiles);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "加载数据失败，请重试。",
      );
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [viewMode, accountContext, filters]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial/dependent data fetch; setState happens in the async continuation, not synchronously in the effect body.
    void reload();
  }, [reload]);

  // ---- search / pagination handlers ---------------------------------------

  function handleSearch() {
    setFilters((current) => ({ ...current, query: draftQuery, page: 1 }));
  }

  function handleReset() {
    setDraftQuery("");
    setFilters({
      ...CUSTOMER_DEFAULT_FILTERS,
      resultType: accountContext ? "all" : CUSTOMER_DEFAULT_FILTERS.resultType,
    });
  }

  function handleResultTypeChange(value: CustomerFilterState["resultType"]) {
    setFilters((current) => ({ ...current, resultType: value, page: 1 }));
  }

  function handlePageChange(page: number) {
    setFilters((current) => ({ ...current, page }));
  }

  function handlePageSizeChange(pageSize: number) {
    setFilters((current) => ({ ...current, pageSize, page: 1 }));
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

  const currentAccount =
    viewMode === "account" ? accountContext : null;

  return (
    <div className="px-6 py-5">
      <div className="mb-5 flex items-end justify-between gap-5">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
            <span>POS</span>
            <span>›</span>
            {currentAccount ? (
              <>
                <button
                  className="hover:text-blue-700"
                  type="button"
                  onClick={handleBackToList}
                >
                  客户管理
                </button>
                <span>›</span>
                <span className="rounded-md bg-blue-50 px-2 py-1 text-blue-700">
                  {currentAccount.accountName}
                </span>
              </>
            ) : (
              <span className="text-slate-600">客户管理</span>
            )}
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">
            {currentAccount ? `${currentAccount.accountName}的客户档案` : "客户管理"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {currentAccount
              ? "正在查看该账户下的全部客户档案。"
              : "一次查询同时匹配客户账户和客户档案，店员无需提前判断手机号属于哪种数据。"}
          </p>
        </div>
        <div className="flex gap-2">
          {currentAccount ? (
            <>
              <button
                className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                type="button"
                onClick={handleBackToList}
              >
                返回客户列表
              </button>
              <button
                className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white"
                type="button"
                onClick={openCreateProfile}
              >
                新增档案
              </button>
            </>
          ) : (
            <>
              <button
                className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                type="button"
                onClick={openCreateProfile}
              >
                新增档案
              </button>
              <button
                className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white"
                type="button"
                onClick={openCreateAccount}
              >
                新增账户
              </button>
            </>
          )}
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <CustomerSearchBar
          accountContext={viewMode === "account"}
          draftQuery={draftQuery}
          filters={filters}
          onDraftQueryChange={setDraftQuery}
          onReset={handleReset}
          onResultTypeChange={handleResultTypeChange}
          onSearch={handleSearch}
        />
        <CustomerTable
          accountContext={viewMode === "account"}
          loading={loading}
          rows={rows}
          totalAccounts={totalAccounts}
          totalProfiles={totalProfiles}
          onDelete={openDelete}
          onEdit={openEdit}
          onService={(row) => router.push(customerDetailPath(row.id))}
          onToggleStatus={handleToggleStatus}
          onViewProfiles={handleViewProfiles}
        />
        <CustomerPagination
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
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
        open={dialog.type === "create-account" || dialog.type === "edit-account"}
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
        open={dialog.type === "create-profile" || dialog.type === "edit-profile"}
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
                  row.kind === "profile" && row.customerAccountId === dialog.accountId,
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
        open={dialog.type === "delete-account" || dialog.type === "delete-profile"}
      />
    </div>
  );
}
