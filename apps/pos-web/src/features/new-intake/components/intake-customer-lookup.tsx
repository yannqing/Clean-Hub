"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { posToast as toast } from "@/lib/pos-toast";

import { customerDetailPath } from "@/config";

import {
  INTAKE_DEFAULT_QUERY,
  INTAKE_PAGE_SIZE_OPTIONS,
  NEWINTAKE_PAGE_DESCRIPTION,
} from "../constants";
import { searchIntakeProfiles } from "../queries";
import type { IntakeProfileQuery, IntakeProfileRow } from "../types";
import { IntakeCreateCustomerDialog } from "./intake-create-customer-dialog";
import { IntakeCreateProfileDialog } from "./intake-create-profile-dialog";
import { IntakeCustomerSearch } from "./intake-customer-search";
import { IntakeProfileList } from "./intake-profile-list";

export function IntakeCustomerLookup() {
  const router = useRouter();

  const [draftQuery, setDraftQuery] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [query, setQuery] = useState<IntakeProfileQuery>({
    ...INTAKE_DEFAULT_QUERY,
  });
  const [rows, setRows] = useState<IntakeProfileRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const reloadRequestIdRef = useRef(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createProfileDialogOpen, setCreateProfileDialogOpen] = useState(false);

  const reload = useCallback(async (next: IntakeProfileQuery) => {
    const requestId = reloadRequestIdRef.current + 1;
    reloadRequestIdRef.current = requestId;
    setLoading(true);
    try {
      const result = await searchIntakeProfiles(next);
      if (reloadRequestIdRef.current !== requestId) return;
      setRows(result.rows);
      setTotal(result.total);
    } catch (error) {
      if (reloadRequestIdRef.current !== requestId) return;
      toast.error(
        error instanceof Error
          ? error.message
          : "查询客户档案失败，请重试。",
      );
      setRows([]);
      setTotal(0);
    } finally {
      if (reloadRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch is async and depends on query state.
    void reload(query);
  }, [query, reload]);

  const filteredRows = useMemo(() => {
    const keyword = resultFilter.trim().toLowerCase();
    if (!keyword) return rows;

    return rows.filter((row) =>
      [row.fullName, row.accountName, row.phone, row.email].some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(keyword),
      ),
    );
  }, [resultFilter, rows]);

  function handleSearch() {
    setResultFilter("");
    setQuery((current) => ({ ...current, q: draftQuery, page: 1 }));
  }

  function handlePageChange(page: number) {
    setQuery((current) => ({ ...current, page }));
  }

  function handlePageSizeChange(pageSize: number) {
    setQuery((current) => ({ ...current, pageSize, page: 1 }));
  }

  function handleCreateCustomer() {
    setCreateDialogOpen(true);
  }

  function handleCreateProfile() {
    setCreateProfileDialogOpen(true);
  }

  function handleCreated() {
    // Refresh the list so the new profile appears; stay on the lookup page so
    // the clerk can continue searching/selecting.
    void reload(query);
  }

  function handleSelect(row: IntakeProfileRow) {
    // Tag the navigation with `from=intake` so the detail page knows the clerk
    // arrived from 客户接待 and renders the reception breadcrumb / back target.
    router.push(`${customerDetailPath(row.id)}?from=intake`);
  }

  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));

  return (
    <div className="px-6 py-5">
      <div className="mb-5 flex items-end justify-between gap-5">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
            <span>POS</span>
            <span>&gt;</span>
            <span className="text-slate-600">客户接待</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">
            查询客户档案
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {NEWINTAKE_PAGE_DESCRIPTION}
          </p>
        </div>

        <button
          className="flex h-10 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
          type="button"
          onClick={handleCreateCustomer}
        >
          <span className="text-base leading-none">+</span>
          新建客户
        </button>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <IntakeCustomerSearch
          draftQuery={draftQuery}
          onDraftQueryChange={setDraftQuery}
          onSearch={handleSearch}
        />

        <IntakeProfileList
          filterText={resultFilter}
          loading={loading}
          page={query.page}
          pageCount={pageCount}
          pageSize={query.pageSize}
          pageSizeOptions={INTAKE_PAGE_SIZE_OPTIONS}
          rows={filteredRows}
          total={total}
          onCreateProfile={handleCreateProfile}
          onFilterTextChange={setResultFilter}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          onSelect={handleSelect}
        />
      </section>

      <IntakeCreateCustomerDialog
        key="intake-create-customer"
        onCreated={handleCreated}
        onOpenChange={setCreateDialogOpen}
        open={createDialogOpen}
      />

      <IntakeCreateProfileDialog
        key="intake-create-profile"
        onCreated={handleCreated}
        onOpenChange={setCreateProfileDialogOpen}
        open={createProfileDialogOpen}
      />
    </div>
  );
}
