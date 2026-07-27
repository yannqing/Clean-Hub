"use client";

import type { PosGlobalSearchItem } from "@cleanhub/api-client";
import { isPosOrderLookupQuery } from "@cleanhub/domain/order-codes";
import { useTranslation } from "@cleanhub/i18n/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Icon, PosBreadcrumb } from "@/components/app-shell";
import { posRoutes } from "@/config";
import { getDesktopBridge } from "@/features/hardware/lib/desktop-bridge";
import { posApi } from "@/lib/api-client";

type ScanStatus = "idle" | "searching" | "not-found" | "error";

const copy = {
  "zh-CN": {
    breadcrumb: "扫描标签",
    title: "扫描工作台",
    field: "标签或订单编号",
    placeholder: "TK-... / OD-...",
    search: "查询",
    waiting: "等待扫描",
    searching: "正在查询",
    notFound: "没有找到匹配记录",
    error: "查询失败，请重试",
    recent: "最近扫描",
  },
  en: {
    breadcrumb: "Scan",
    title: "Scan workspace",
    field: "Label or order code",
    placeholder: "TK-... / OD-...",
    search: "Search",
    waiting: "Ready",
    searching: "Searching",
    notFound: "No matching record",
    error: "Search failed. Try again.",
    recent: "Recent scans",
  },
  fr: {
    breadcrumb: "Scanner",
    title: "Poste de scan",
    field: "Etiquette ou commande",
    placeholder: "TK-... / OD-...",
    search: "Rechercher",
    waiting: "Pret",
    searching: "Recherche",
    notFound: "Aucun resultat",
    error: "Echec de la recherche",
    recent: "Scans recents",
  },
} as const;

function getFallbackHref(query: string): string {
  const encoded = encodeURIComponent(query);
  if (/^TK-/i.test(query)) {
    return `${posRoutes.tickets}?q=${encoded}`;
  }
  if (isPosOrderLookupQuery(query)) {
    return `${posRoutes.orders}?q=${encoded}`;
  }
  return `${posRoutes.customers}?q=${encoded}`;
}

export default function ScanPage() {
  const router = useRouter();
  const { locale } = useTranslation();
  const labels = copy[locale as keyof typeof copy] ?? copy.en;
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [recent, setRecent] = useState<string[]>([]);

  const resolveScan = useCallback(
    async (rawValue: string) => {
      const query = rawValue.trim();
      if (!query || status === "searching") {
        return;
      }

      setValue(query);
      setStatus("searching");
      setRecent((current) =>
        [query, ...current.filter((item) => item !== query)].slice(0, 5),
      );

      try {
        const result = await posApi.pos.search.global({ q: query, limit: 3 });
        const matches: PosGlobalSearchItem[] = [
          ...result.groups.tickets,
          ...result.groups.orders,
          ...result.groups.customers,
        ];
        if (matches.length === 1 && matches[0]?.href) {
          router.push(matches[0].href);
          return;
        }
        if (matches.length > 0) {
          router.push(getFallbackHref(query));
          return;
        }
        setStatus("not-found");
      } catch {
        setStatus("error");
      } finally {
        window.setTimeout(() => inputRef.current?.focus(), 0);
      }
    },
    [router, status],
  );

  useEffect(() => {
    inputRef.current?.focus();
    const bridge = getDesktopBridge();
    return bridge?.hardware.onScan((event) => {
      void resolveScan(event.value);
    });
  }, [resolveScan]);

  const statusLabel =
    status === "searching"
      ? labels.searching
      : status === "not-found"
        ? labels.notFound
        : status === "error"
          ? labels.error
          : labels.waiting;

  return (
    <section className="space-y-5">
      <PosBreadcrumb items={[{ label: labels.breadcrumb }]} />
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold text-slate-950">{labels.title}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form
          className="border-t-4 border-blue-600 bg-white p-6 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            void resolveScan(value);
          }}
        >
          <label
            className="block text-sm font-semibold text-slate-700"
            htmlFor="scan-code"
          >
            {labels.field}
          </label>
          <div className="mt-3 flex gap-2">
            <div className="flex min-w-0 flex-1 items-center border border-slate-300 bg-white px-3 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
              <Icon
                className="mr-3 h-5 w-5 shrink-0 text-slate-400"
                name="scan-line"
              />
              <input
                autoComplete="off"
                className="h-14 min-w-0 flex-1 bg-transparent font-mono text-base font-semibold text-slate-950 outline-none"
                id="scan-code"
                onChange={(event) => {
                  setValue(event.target.value);
                  setStatus("idle");
                }}
                placeholder={labels.placeholder}
                ref={inputRef}
                value={value}
              />
            </div>
            <button
              className="flex h-14 items-center gap-2 bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
              disabled={!value.trim() || status === "searching"}
              type="submit"
            >
              <Icon className="h-4 w-4" name="search" />
              {labels.search}
            </button>
          </div>

          <div
            className={`mt-5 flex min-h-24 items-center justify-center border border-dashed px-4 text-sm font-semibold ${
              status === "error" || status === "not-found"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-slate-300 bg-slate-50 text-slate-500"
            }`}
            role="status"
          >
            {statusLabel}
          </div>
        </form>

        <aside className="border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-950">
            {labels.recent}
          </h2>
          <div className="mt-4 space-y-2">
            {recent.map((item) => (
              <button
                className="flex h-11 w-full items-center justify-between border-b border-slate-100 px-1 text-left font-mono text-sm font-semibold text-slate-700 hover:text-blue-700"
                key={item}
                onClick={() => void resolveScan(item)}
                type="button"
              >
                <span className="truncate">{item}</span>
                <Icon className="h-4 w-4 shrink-0" name="chevron-right" />
              </button>
            ))}
            {recent.length === 0 ? (
              <div className="h-11 border-b border-slate-100" />
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  );
}
