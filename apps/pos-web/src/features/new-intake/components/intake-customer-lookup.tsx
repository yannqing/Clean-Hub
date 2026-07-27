"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@cleanhub/i18n/react";

import { useRouter } from "next/navigation";

import { PosBreadcrumb } from "@/components/app-shell";
import { translatePosText } from "@/components/i18n/pos-runtime-text";
import { posToast as toast } from "@/lib/pos-toast";

import { customerDetailPath } from "@/config";

import {
  INTAKE_DEFAULT_QUERY,
  INTAKE_EMPTY_ACCOUNT_FORM,
  INTAKE_EMPTY_PROFILE_FORM,
  INTAKE_PAGE_SIZE_OPTIONS,
  NEWINTAKE_PAGE_DESCRIPTION,
} from "../constants";
import { listIntakeAccountProfiles, searchIntakeProfiles } from "../queries";
import type {
  IntakeAccountOption,
  IntakeCreatedAccount,
  IntakeCreatedProfile,
} from "../queries";
import type {
  IntakeAccountRow,
  IntakeCreateAccountInput,
  IntakeCreateProfileInput,
  IntakeLookupRow,
  IntakeProfileQuery,
  IntakeProfileRow,
} from "../types";
import { IntakeCreateCustomerDialog } from "./intake-create-customer-dialog";
import { IntakeCreateProfileDialog } from "./intake-create-profile-dialog";
import { IntakeCustomerSearch } from "./intake-customer-search";
import { IntakeProfileList } from "./intake-profile-list";

type IntakeCustomerLookupProps = {
  initialQuery?: string;
};

export function IntakeCustomerLookup({
  initialQuery = "",
}: IntakeCustomerLookupProps) {
  const { locale } = useTranslation();
  const router = useRouter();
  const normalizedInitialQuery = initialQuery.trim();
  const text = (value: string) => translatePosText(value, locale);

  const [draftQuery, setDraftQuery] = useState(normalizedInitialQuery);
  const [resultFilter, setResultFilter] = useState("");
  const [hasSearched, setHasSearched] = useState(
    normalizedInitialQuery.length > 0,
  );
  const [query, setQuery] = useState<IntakeProfileQuery>({
    ...INTAKE_DEFAULT_QUERY,
    q: normalizedInitialQuery,
    page: 1,
  });
  const [rows, setRows] = useState<IntakeLookupRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedAccount, setSelectedAccount] =
    useState<IntakeAccountOption | null>(null);
  const reloadRequestIdRef = useRef(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialogState, setCreateDialogState] = useState<{
    key: number;
    initialForm: IntakeCreateAccountInput;
  }>({
    key: 0,
    initialForm: { ...INTAKE_EMPTY_ACCOUNT_FORM },
  });
  const [createProfileDialogState, setCreateProfileDialogState] = useState<{
    key: number;
    initialAccount: IntakeAccountOption | null;
    initialAccountKeyword: string;
    initialForm: IntakeCreateProfileInput;
  }>({
    key: 0,
    initialAccount: null,
    initialAccountKeyword: "",
    initialForm: { ...INTAKE_EMPTY_PROFILE_FORM },
  });
  const [createProfileDialogOpen, setCreateProfileDialogOpen] = useState(false);

  const reload = useCallback(
    async (next: IntakeProfileQuery, account: IntakeAccountOption | null) => {
      const requestId = reloadRequestIdRef.current + 1;
      reloadRequestIdRef.current = requestId;
      setLoading(true);
      try {
        const result = account
          ? await listIntakeAccountProfiles(account, next)
          : await searchIntakeProfiles(next);
        if (reloadRequestIdRef.current !== requestId) return;
        setRows(result.rows);
        setTotal(result.total);
      } catch (error) {
        if (reloadRequestIdRef.current !== requestId) return;
        toast.error(
          error instanceof Error
            ? error.message
            : account
              ? "查询账户档案失败，请重试。"
              : "查询客户档案失败，请重试。",
        );
        setRows([]);
        setTotal(0);
      } finally {
        if (reloadRequestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (!selectedAccount && !hasSearched) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch is async and depends on query state.
    void reload(query, selectedAccount);
  }, [hasSearched, query, reload, selectedAccount]);

  const filteredRows = useMemo(() => {
    const keyword = resultFilter.trim().toLowerCase();
    if (!keyword) return rows;

    return rows.filter((row) => {
      const values =
        row.kind === "profile"
          ? [row.fullName, row.accountName, row.phone, row.email]
          : [row.accountName, row.phone, row.email];

      return values.some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(keyword),
      );
    });
  }, [resultFilter, rows]);

  function clearResults() {
    reloadRequestIdRef.current += 1;
    setRows([]);
    setTotal(0);
    setLoading(false);
  }

  function handleSearch() {
    const keyword = draftQuery.trim();
    setResultFilter("");

    if (!keyword) {
      setSelectedAccount(null);
      setHasSearched(false);
      setQuery((current) => ({ ...current, q: "", page: 1 }));
      clearResults();
      router.replace("/new-intake");
      return;
    }

    setDraftQuery(keyword);
    setSelectedAccount(null);
    setHasSearched(true);
    setQuery((current) => ({ ...current, q: keyword, page: 1 }));
    router.replace(`/new-intake?q=${encodeURIComponent(keyword)}`);
  }

  function handlePageChange(page: number) {
    setQuery((current) => ({ ...current, page }));
  }

  function handlePageSizeChange(pageSize: number) {
    setQuery((current) => ({ ...current, pageSize, page: 1 }));
  }

  function handleCreateCustomer() {
    setCreateDialogState((current) => ({
      key: current.key + 1,
      initialForm: buildCreateAccountInitialForm(draftQuery),
    }));
    setCreateDialogOpen(true);
  }

  function handleCreateProfile() {
    if (!selectedAccount) return;

    setCreateProfileDialogState((current) => ({
      key: current.key + 1,
      ...buildCreateProfileDialogDefaults({
        account: selectedAccount,
        keyword: draftQuery,
      }),
    }));
    setCreateProfileDialogOpen(true);
  }

  function handleSelectAccount(account: IntakeAccountRow) {
    const accountOption: IntakeAccountOption = {
      id: account.id,
      accountName: account.accountName,
      phone: account.phone,
      email: account.email,
    };

    setSelectedAccount(accountOption);
    setResultFilter("");
    setHasSearched(true);
    setRows([]);
    setTotal(0);
    setLoading(true);
    setQuery((current) => ({ ...current, q: "", page: 1 }));
  }

  function handleBackToSearchResults() {
    const keyword = draftQuery.trim();
    setSelectedAccount(null);
    setResultFilter("");

    if (!keyword) {
      setHasSearched(false);
      setQuery((current) => ({ ...current, q: "", page: 1 }));
      clearResults();
      router.replace("/new-intake");
      return;
    }

    setHasSearched(true);
    setRows([]);
    setTotal(0);
    setLoading(true);
    setQuery((current) => ({ ...current, q: keyword, page: 1 }));
    router.replace(`/new-intake?q=${encodeURIComponent(keyword)}`);
  }

  function handleAccountCreated(account: IntakeCreatedAccount) {
    const accountOption: IntakeAccountOption = {
      id: account.accountId,
      accountName: account.accountName,
      phone: account.phone,
      email: account.email,
    };
    setSelectedAccount(accountOption);
    setResultFilter("");
    setHasSearched(true);
    setRows([]);
    setTotal(0);
    setLoading(true);
    setQuery((current) => ({ ...current, q: "", page: 1 }));
    setCreateProfileDialogState((current) => ({
      key: current.key + 1,
      ...buildCreateProfileDialogDefaults({
        account: accountOption,
        keyword: draftQuery,
      }),
    }));
    setCreateProfileDialogOpen(true);
  }

  function handleProfileCreated(profile: IntakeCreatedProfile) {
    // Refresh the list so the new profile appears; stay on the lookup page so
    // the clerk can continue searching/selecting.
    if (selectedAccount) {
      setResultFilter("");
      setQuery((current) => ({ ...current, q: "", page: 1 }));
      return;
    }

    const nextKeyword = profile.phone || profile.email || profile.fullName;
    if (nextKeyword) {
      setDraftQuery(nextKeyword);
      setResultFilter("");
      setHasSearched(true);
      setQuery((current) => ({ ...current, q: nextKeyword, page: 1 }));
      return;
    }

    if (!hasSearched) return;

    void reload(query, null);
  }

  function handleSelect(row: IntakeProfileRow) {
    // Tag the navigation with `from=intake` so the detail page knows the clerk
    // arrived from 客户接待 and renders the reception breadcrumb / back target.
    const params = new URLSearchParams({ from: "intake" });
    const keyword = draftQuery.trim();
    if (keyword) {
      params.set("q", keyword);
    }
    router.push(`${customerDetailPath(row.id)}?${params.toString()}`);
  }

  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));

  return (
    <div className="px-6 py-5">
      <div className="mb-5 flex items-end justify-between gap-5">
        <div>
          <PosBreadcrumb items={[{ label: text("客户接待") }]} />
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">
            {text("查询客户档案")}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {text(NEWINTAKE_PAGE_DESCRIPTION)}
          </p>
        </div>

        <button
          className="flex h-10 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
          type="button"
          onClick={handleCreateCustomer}
        >
          <span className="text-base leading-none">+</span>
          {text("新建客户")}
        </button>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <IntakeCustomerSearch
          draftQuery={draftQuery}
          onDraftQueryChange={setDraftQuery}
          onSearch={handleSearch}
        />

        <IntakeProfileList
          account={selectedAccount}
          filterText={resultFilter}
          hasSearched={hasSearched}
          loading={loading}
          mode={selectedAccount ? "accountProfiles" : "search"}
          page={query.page}
          pageCount={pageCount}
          pageSize={query.pageSize}
          pageSizeOptions={INTAKE_PAGE_SIZE_OPTIONS}
          rows={filteredRows}
          total={total}
          onBackToSearchResults={handleBackToSearchResults}
          onCreateCustomer={handleCreateCustomer}
          onCreateProfile={handleCreateProfile}
          onFilterTextChange={setResultFilter}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          onSelectAccount={handleSelectAccount}
          onSelect={handleSelect}
        />
      </section>

      <IntakeCreateCustomerDialog
        initialForm={createDialogState.initialForm}
        key={`intake-create-customer-${createDialogState.key}`}
        onCreated={handleAccountCreated}
        onOpenChange={setCreateDialogOpen}
        open={createDialogOpen}
      />

      <IntakeCreateProfileDialog
        initialAccount={createProfileDialogState.initialAccount}
        initialAccountKeyword={createProfileDialogState.initialAccountKeyword}
        initialForm={createProfileDialogState.initialForm}
        key={`intake-create-profile-${createProfileDialogState.key}`}
        onCreated={handleProfileCreated}
        onOpenChange={setCreateProfileDialogOpen}
        open={createProfileDialogOpen}
      />
    </div>
  );
}

function buildCreateProfileDialogDefaults({
  account,
  keyword,
}: {
  account: IntakeAccountOption | null;
  keyword: string;
}): {
  initialAccount: IntakeAccountOption | null;
  initialAccountKeyword: string;
  initialForm: IntakeCreateProfileInput;
} {
  const contact = detectContactInput(keyword);
  const initialForm: IntakeCreateProfileInput = {
    ...INTAKE_EMPTY_PROFILE_FORM,
    accountId: account?.id ?? "",
    profilePhone: account?.phone ?? contact.phone ?? "",
    profileEmail: account?.email ?? contact.email ?? "",
  };

  return {
    initialAccount: account,
    initialAccountKeyword: account?.accountName ?? keyword.trim(),
    initialForm,
  };
}

function buildCreateAccountInitialForm(
  keyword: string,
): IntakeCreateAccountInput {
  const value = keyword.trim();
  const initialForm: IntakeCreateAccountInput = {
    ...INTAKE_EMPTY_ACCOUNT_FORM,
  };

  if (!value) return initialForm;

  const contact = detectContactInput(value);

  return {
    ...initialForm,
    accountPhone: contact.phone ?? "",
    accountEmail: contact.email ?? "",
  };
}

function detectContactInput(keyword: string): {
  phone?: string;
  email?: string;
} {
  const value = keyword.trim();
  if (!value) return {};

  if (value.includes("@")) {
    return { email: value };
  }

  const digitCount = value.replace(/\D/g, "").length;
  const phoneSafe = /^[\d\s()+-]+$/.test(value);

  if (digitCount >= 5 && phoneSafe) {
    return { phone: value };
  }

  return {};
}
