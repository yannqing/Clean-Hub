"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type {
  PosBranchSummary,
  PosOrderSummary,
  ServiceTicketSummary,
} from "@cleanhub/api-client";
import { useTranslation } from "@cleanhub/i18n/react";

import { Icon, PosBreadcrumb, type PosIconName } from "@/components/app-shell";
import { posRoutes } from "@/config/routes";
import { DEFAULT_POS_CURRENCY } from "@/lib/money";
import type { PosSessionUser } from "@/lib/session";
import { posToast as toast } from "@/lib/pos-toast";

import type {
  LocalShiftHandoverRecord,
  ShiftHandoverSummary,
} from "../types";

const STORAGE_KEY = "cleanhub.pos-web.shift-handovers";
const MAX_LOCAL_RECORDS = 5;

type ShiftHandoverViewProps = {
  branch: PosBranchSummary | null;
  summary: ShiftHandoverSummary;
  user: PosSessionUser | null;
};

type Copy = {
  breadcrumb: string;
  title: string;
  description: string;
  currentShift: string;
  active: string;
  cashier: string;
  branch: string;
  generatedAt: string;
  expectedCash: string;
  cashCounted: string;
  variance: string;
  paidToday: string;
  orderCount: string;
  pendingPayment: string;
  readyPickup: string;
  cashCardTitle: string;
  cashCardDescription: string;
  cashInputLabel: string;
  incomingStaffLabel: string;
  incomingStaffPlaceholder: string;
  notesLabel: string;
  notesPlaceholder: string;
  checklistTitle: string;
  checklist: string[];
  complete: string;
  completeDisabled: string;
  print: string;
  copy: string;
  saved: string;
  copied: string;
  copyFailed: string;
  paymentBreakdown: string;
  noPayments: string;
  pendingOrders: string;
  readyTickets: string;
  overdueTickets: string;
  exceptionTickets: string;
  emptyOrders: string;
  emptyTickets: string;
  recentRecords: string;
  noRecentRecords: string;
  viewOrders: string;
  viewTickets: string;
  items: string;
  total: string;
};

const COPY: Record<"zh-CN" | "en" | "fr", Copy> = {
  "zh-CN": {
    breadcrumb: "交接班",
    title: "交接班",
    description: "核对现金、待收款订单、异常工单和待取件任务。",
    currentShift: "当前班次",
    active: "进行中",
    cashier: "当前店员",
    branch: "门店",
    generatedAt: "统计时间",
    expectedCash: "系统现金",
    cashCounted: "实点现金",
    variance: "现金差异",
    paidToday: "今日已收",
    orderCount: "今日订单",
    pendingPayment: "待收款",
    readyPickup: "待取件",
    cashCardTitle: "现金核对",
    cashCardDescription: "按钱箱实点金额填写，系统会自动计算差异。",
    cashInputLabel: "实点现金金额",
    incomingStaffLabel: "接班店员",
    incomingStaffPlaceholder: "可选，输入接班人姓名",
    notesLabel: "交接备注",
    notesPlaceholder: "记录异常现金、待确认支付、设备情况等",
    checklistTitle: "交接确认",
    checklist: [
      "现金已实点并核对差异",
      "待收款订单已确认",
      "异常和逾期工单已说明",
      "票据、打印机和钱箱状态已确认",
    ],
    complete: "完成交接",
    completeDisabled: "请填写实点现金并完成确认项",
    print: "打印摘要",
    copy: "复制摘要",
    saved: "交接记录已保存在本机。",
    copied: "交接摘要已复制。",
    copyFailed: "复制失败，请手动选择摘要内容。",
    paymentBreakdown: "收款方式",
    noPayments: "暂无收款记录",
    pendingOrders: "待收款订单",
    readyTickets: "待取件工单",
    overdueTickets: "逾期工单",
    exceptionTickets: "异常工单",
    emptyOrders: "暂无待收款订单",
    emptyTickets: "暂无相关工单",
    recentRecords: "本机最近交接",
    noRecentRecords: "暂无本机交接记录",
    viewOrders: "处理订单",
    viewTickets: "查看工单",
    items: "件",
    total: "合计",
  },
  en: {
    breadcrumb: "Shift handover",
    title: "Shift handover",
    description:
      "Reconcile cash, unpaid orders, exception tickets, and pickup tasks.",
    currentShift: "Current shift",
    active: "Open",
    cashier: "Current staff",
    branch: "Store",
    generatedAt: "Snapshot time",
    expectedCash: "System cash",
    cashCounted: "Counted cash",
    variance: "Variance",
    paidToday: "Paid today",
    orderCount: "Orders today",
    pendingPayment: "Pending payment",
    readyPickup: "Ready pickup",
    cashCardTitle: "Cash reconciliation",
    cashCardDescription:
      "Enter the cash counted in the drawer. The variance is calculated automatically.",
    cashInputLabel: "Counted cash amount",
    incomingStaffLabel: "Incoming staff",
    incomingStaffPlaceholder: "Optional, enter incoming staff name",
    notesLabel: "Handover notes",
    notesPlaceholder: "Record cash variance, pending payments, device status",
    checklistTitle: "Handover confirmation",
    checklist: [
      "Cash was counted and variance reviewed",
      "Pending payments were checked",
      "Exception and overdue tickets were explained",
      "Receipts, printer, and cash drawer status were checked",
    ],
    complete: "Complete handover",
    completeDisabled: "Enter counted cash and complete all confirmations",
    print: "Print summary",
    copy: "Copy summary",
    saved: "Handover record saved on this device.",
    copied: "Handover summary copied.",
    copyFailed: "Copy failed. Select the summary manually.",
    paymentBreakdown: "Payment methods",
    noPayments: "No payment records",
    pendingOrders: "Pending-payment orders",
    readyTickets: "Ready pickup tickets",
    overdueTickets: "Overdue tickets",
    exceptionTickets: "Exception tickets",
    emptyOrders: "No pending-payment orders",
    emptyTickets: "No related tickets",
    recentRecords: "Recent device handovers",
    noRecentRecords: "No device handover records",
    viewOrders: "Process orders",
    viewTickets: "View tickets",
    items: "items",
    total: "Total",
  },
  fr: {
    breadcrumb: "Passation",
    title: "Passation",
    description:
      "Rapprochez les espèces, les commandes non payées, les tickets en exception et les retraits.",
    currentShift: "Service actuel",
    active: "Ouvert",
    cashier: "Employé actuel",
    branch: "Magasin",
    generatedAt: "Heure du relevé",
    expectedCash: "Espèces système",
    cashCounted: "Espèces comptées",
    variance: "Écart",
    paidToday: "Payé aujourd'hui",
    orderCount: "Commandes du jour",
    pendingPayment: "Paiement en attente",
    readyPickup: "Prêt au retrait",
    cashCardTitle: "Rapprochement espèces",
    cashCardDescription:
      "Saisissez le montant compté dans le tiroir. L'écart est calculé automatiquement.",
    cashInputLabel: "Montant compté",
    incomingStaffLabel: "Employé entrant",
    incomingStaffPlaceholder: "Optionnel, nom de l'employé entrant",
    notesLabel: "Notes de passation",
    notesPlaceholder:
      "Indiquez les écarts de caisse, paiements en attente, état des appareils",
    checklistTitle: "Confirmation de passation",
    checklist: [
      "Les espèces ont été comptées et l'écart vérifié",
      "Les paiements en attente ont été contrôlés",
      "Les tickets en exception et en retard ont été expliqués",
      "Les reçus, l'imprimante et le tiroir-caisse ont été vérifiés",
    ],
    complete: "Terminer la passation",
    completeDisabled: "Saisissez les espèces et validez tous les contrôles",
    print: "Imprimer le résumé",
    copy: "Copier le résumé",
    saved: "Passation enregistrée sur cet appareil.",
    copied: "Résumé de passation copié.",
    copyFailed: "Échec de copie. Sélectionnez le résumé manuellement.",
    paymentBreakdown: "Moyens de paiement",
    noPayments: "Aucun paiement",
    pendingOrders: "Commandes à encaisser",
    readyTickets: "Tickets prêts au retrait",
    overdueTickets: "Tickets en retard",
    exceptionTickets: "Tickets en exception",
    emptyOrders: "Aucune commande à encaisser",
    emptyTickets: "Aucun ticket concerné",
    recentRecords: "Passations récentes sur l'appareil",
    noRecentRecords: "Aucune passation enregistrée sur l'appareil",
    viewOrders: "Traiter les commandes",
    viewTickets: "Voir les tickets",
    items: "articles",
    total: "Total",
  },
};

const PAYMENT_METHOD_LABELS: Record<string, Record<"zh-CN" | "en" | "fr", string>> = {
  app: {
    "zh-CN": "App",
    en: "App",
    fr: "App",
  },
  card: {
    "zh-CN": "银行卡",
    en: "Card",
    fr: "Carte",
  },
  cash: {
    "zh-CN": "现金",
    en: "Cash",
    fr: "Espèces",
  },
};

function resolveLocale(locale: string): "zh-CN" | "en" | "fr" {
  return locale === "en" || locale === "fr" ? locale : "zh-CN";
}

function toNumber(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeMoneyInput(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [integerPart = "", ...decimalParts] = cleaned.split(".");

  if (decimalParts.length === 0) {
    return integerPart;
  }

  return `${integerPart}.${decimalParts.join("").slice(0, 2)}`;
}

function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMoney(value: number, currency: string, locale: string): string {
  return `${currency} ${formatNumber(value, locale)}`;
}

function formatDateTime(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function displayOrderCode(orderId: string): string {
  return `OD-${orderId.slice(-8).toUpperCase()}`;
}

function displayTicketCode(ticket: ServiceTicketSummary): string {
  return ticket.ticketNo ?? `TK-${ticket.id.slice(-8).toUpperCase()}`;
}

function readLocalRecords(): LocalShiftHandoverRecord[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_LOCAL_RECORDS) : [];
  } catch {
    return [];
  }
}

function writeLocalRecords(records: LocalShiftHandoverRecord[]) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(records.slice(0, MAX_LOCAL_RECORDS)),
  );
}

function MetricCard({
  icon,
  label,
  tone,
  value,
}: {
  icon: PosIconName;
  label: string;
  tone: "blue" | "green" | "orange" | "red";
  value: string;
}) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    orange: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  }[tone];

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold text-slate-950">
            {value}
          </p>
        </div>
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneClass}`}
        >
          <Icon className="h-5 w-5" name={icon} />
        </span>
      </div>
    </article>
  );
}

function EmptyList({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-medium text-slate-400">
      {label}
    </div>
  );
}

function OrderRow({
  currency,
  locale,
  order,
}: {
  currency: string;
  locale: string;
  order: PosOrderSummary;
}) {
  return (
    <Link
      className="block rounded-lg border border-slate-200 bg-white p-3 transition hover:border-blue-200 hover:bg-blue-50/40"
      href={posRoutes.orderDetail(order.id)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold text-blue-700">
            {displayOrderCode(order.id)}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-900">
            {order.customerName}
          </p>
        </div>
        <p className="shrink-0 text-right text-sm font-bold text-slate-950">
          {formatMoney(toNumber(order.totalAmount), currency, locale)}
        </p>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>{formatDateTime(order.createdAt, locale)}</span>
        <span>
          {formatMoney(toNumber(order.paidAmount), currency, locale)}
        </span>
      </div>
    </Link>
  );
}

function TicketRow({
  currency,
  locale,
  ticket,
  unitLabel,
}: {
  currency: string;
  locale: string;
  ticket: ServiceTicketSummary;
  unitLabel: string;
}) {
  return (
    <Link
      className="block rounded-lg border border-slate-200 bg-white p-3 transition hover:border-blue-200 hover:bg-blue-50/40"
      href={posRoutes.ticketDetail(ticket.id)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold text-blue-700">
            {displayTicketCode(ticket)}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-900">
            {ticket.customerName}
          </p>
        </div>
        <p className="shrink-0 text-right text-sm font-bold text-slate-950">
          {formatMoney(toNumber(ticket.totalAmount), currency, locale)}
        </p>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>{formatDateTime(ticket.updatedAt, locale)}</span>
        <span>
          {ticket.itemCount} {unitLabel}
        </span>
      </div>
    </Link>
  );
}

function buildSummaryText({
  branchName,
  cashierName,
  copy,
  countedCash,
  currency,
  expectedCash,
  locale,
  notes,
  pendingOrderCount,
  variance,
}: {
  branchName: string;
  cashierName: string;
  copy: Copy;
  countedCash: number;
  currency: string;
  expectedCash: number;
  locale: string;
  notes: string;
  pendingOrderCount: number;
  variance: number;
}) {
  return [
    `${copy.title} - ${branchName}`,
    `${copy.cashier}: ${cashierName}`,
    `${copy.expectedCash}: ${formatMoney(expectedCash, currency, locale)}`,
    `${copy.cashCounted}: ${formatMoney(countedCash, currency, locale)}`,
    `${copy.variance}: ${formatMoney(variance, currency, locale)}`,
    `${copy.pendingPayment}: ${formatNumber(pendingOrderCount, locale)}`,
    notes ? `${copy.notesLabel}: ${notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function ShiftHandoverView({
  branch,
  summary,
  user,
}: ShiftHandoverViewProps) {
  const { locale } = useTranslation();
  const resolvedLocale = resolveLocale(locale);
  const copy = COPY[resolvedLocale];
  const currency = branch?.defaultCurrency ?? DEFAULT_POS_CURRENCY;
  const cashierName = user?.displayName ?? "-";
  const branchName = branch?.name ?? "-";
  const expectedCash = useMemo(() => {
    const cash = summary.orders?.paymentMethods.find(
      (item) => item.method === "cash",
    );
    return toNumber(cash?.amount);
  }, [summary.orders]);
  const paidToday = toNumber(summary.orders?.paidAmount);
  const orderCount = summary.orders?.orderCount ?? 0;
  const pendingOrderCount =
    (summary.orders?.unpaidCount ?? 0) + (summary.orders?.partialCount ?? 0);
  const readyTicketCount = summary.tickets?.byStatus.ready_to_pick ?? 0;
  const overdueTicketCount = summary.tickets?.overdueCount ?? 0;
  const exceptionTicketCount = summary.tickets?.byStatus.exception ?? 0;
  const [countedCash, setCountedCash] = useState("");
  const [incomingStaffName, setIncomingStaffName] = useState("");
  const [notes, setNotes] = useState("");
  const [checks, setChecks] = useState<boolean[]>(() =>
    copy.checklist.map(() => false),
  );
  const [records, setRecords] = useState<LocalShiftHandoverRecord[]>([]);
  const countedCashValue = toNumber(countedCash);
  const variance = countedCashValue - expectedCash;
  const allChecked = checks.every(Boolean);
  const canComplete = countedCash.trim().length > 0 && allChecked;
  const summaryText = buildSummaryText({
    branchName,
    cashierName,
    copy,
    countedCash: countedCashValue,
    currency,
    expectedCash,
    locale,
    notes,
    pendingOrderCount,
    variance,
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setRecords(readLocalRecords());
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  function updateCheck(index: number, checked: boolean) {
    setChecks((current) =>
      current.map((value, itemIndex) =>
        itemIndex === index ? checked : value,
      ),
    );
  }

  function completeHandover() {
    if (!canComplete) {
      toast.warning(copy.completeDisabled);
      return;
    }

    const record: LocalShiftHandoverRecord = {
      id: `handover-${Date.now()}`,
      createdAt: new Date().toISOString(),
      cashierName,
      branchName,
      expectedCash,
      countedCash: countedCashValue,
      variance,
      pendingOrderCount,
      overdueTicketCount,
      exceptionTicketCount,
      incomingStaffName: incomingStaffName.trim() || null,
      notes: notes.trim() || null,
    };
    const nextRecords = [record, ...records].slice(0, MAX_LOCAL_RECORDS);

    writeLocalRecords(nextRecords);
    setRecords(nextRecords);
    toast.success(copy.saved);
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summaryText);
      toast.success(copy.copied);
    } catch {
      toast.error(copy.copyFailed);
    }
  }

  const varianceTone =
    variance === 0
      ? "text-slate-950"
      : variance > 0
        ? "text-emerald-700"
        : "text-red-700";

  return (
    <section className="space-y-5">
      <PosBreadcrumb items={[{ label: copy.breadcrumb }]} />

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
              <Icon className="h-3.5 w-3.5" name="replace" />
              {copy.currentShift}
            </div>
            <h1 className="mt-3 text-2xl font-bold text-slate-950">
              {copy.title}
            </h1>
            <p className="mt-1 text-sm text-slate-500">{copy.description}</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {copy.active}
          </span>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-500">{copy.cashier}</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-950">
              {cashierName}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-500">{copy.branch}</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-950">
              {branchName}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-500">
              {copy.generatedAt}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-950">
              {formatDateTime(summary.generatedAt, locale)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon="wallet-cards"
          label={copy.expectedCash}
          tone="green"
          value={formatMoney(expectedCash, currency, locale)}
        />
        <MetricCard
          icon="receipt"
          label={copy.paidToday}
          tone="blue"
          value={formatMoney(paidToday, currency, locale)}
        />
        <MetricCard
          icon="clock"
          label={copy.pendingPayment}
          tone={pendingOrderCount > 0 ? "orange" : "green"}
          value={formatNumber(pendingOrderCount, locale)}
        />
        <MetricCard
          icon="package-check"
          label={copy.readyPickup}
          tone="blue"
          value={formatNumber(readyTicketCount, locale)}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">
                {copy.cashCardTitle}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {copy.cashCardDescription}
              </p>
            </div>
            <div className={`text-right text-2xl font-bold ${varianceTone}`}>
              {formatMoney(variance, currency, locale)}
              <p className="mt-0.5 text-xs font-medium text-slate-500">
                {copy.variance}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                {copy.cashInputLabel}
              </span>
              <input
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-300 focus:shadow-[0_0_0_4px_rgba(37,99,235,0.10)]"
                inputMode="decimal"
                onChange={(event) =>
                  setCountedCash(normalizeMoneyInput(event.target.value))
                }
                placeholder="0"
                value={countedCash}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                {copy.incomingStaffLabel}
              </span>
              <input
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:shadow-[0_0_0_4px_rgba(37,99,235,0.10)]"
                onChange={(event) => setIncomingStaffName(event.target.value)}
                placeholder={copy.incomingStaffPlaceholder}
                value={incomingStaffName}
              />
            </label>
          </div>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              {copy.notesLabel}
            </span>
            <textarea
              className="min-h-24 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:shadow-[0_0_0_4px_rgba(37,99,235,0.10)]"
              onChange={(event) => setNotes(event.target.value)}
              placeholder={copy.notesPlaceholder}
              value={notes}
            />
          </label>

          <div className="mt-5 rounded-lg bg-slate-50 p-4">
            <h3 className="text-xs font-semibold text-slate-900">
              {copy.checklistTitle}
            </h3>
            <div className="mt-3 grid gap-2">
              {copy.checklist.map((item, index) => (
                <label
                  className="flex min-h-11 items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700"
                  key={item}
                >
                  <input
                    checked={checks[index] ?? false}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    onChange={(event) =>
                      updateCheck(index, event.target.checked)
                    }
                    type="checkbox"
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={!canComplete}
              onClick={completeHandover}
              type="button"
            >
              <Icon className="h-4 w-4" name="save" />
              {copy.complete}
            </button>
            <button
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={() => window.print()}
              type="button"
            >
              <Icon className="h-4 w-4" name="printer" />
              {copy.print}
            </button>
            <button
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={() => void copySummary()}
              type="button"
            >
              <Icon className="h-4 w-4" name="clipboard-list" />
              {copy.copy}
            </button>
          </div>
          {!canComplete ? (
            <p className="mt-2 text-xs font-medium text-slate-400">
              {copy.completeDisabled}
            </p>
          ) : null}
        </section>

        <aside className="space-y-5">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-950">
              {copy.paymentBreakdown}
            </h2>
            <div className="mt-4 space-y-3">
              {summary.orders?.paymentMethods.length ? (
                summary.orders.paymentMethods.map((item) => (
                  <div
                    className="flex items-center justify-between gap-3 text-sm"
                    key={item.method}
                  >
                    <span className="font-medium text-slate-600">
                      {PAYMENT_METHOD_LABELS[item.method]?.[resolvedLocale] ??
                        item.method}
                    </span>
                    <span className="font-semibold text-slate-950">
                      {formatMoney(toNumber(item.amount), currency, locale)}
                    </span>
                  </div>
                ))
              ) : (
                <EmptyList label={copy.noPayments} />
              )}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold">
              <span className="text-slate-600">{copy.orderCount}</span>
              <span className="text-slate-950">
                {formatNumber(orderCount, locale)}
              </span>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-950">
                {copy.recentRecords}
              </h2>
            </div>
            <div className="mt-4 space-y-3">
              {records.length > 0 ? (
                records.map((record) => (
                  <div
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                    key={record.id}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {record.cashierName}
                      </p>
                      <span className="text-xs font-medium text-slate-500">
                        {formatDateTime(record.createdAt, locale)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                      <span>{copy.variance}</span>
                      <span className="font-semibold text-slate-900">
                        {formatMoney(record.variance, currency, locale)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyList label={copy.noRecentRecords} />
              )}
            </div>
          </section>
        </aside>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-950">
              {copy.pendingOrders}
            </h2>
            <Link
              className="text-xs font-semibold text-blue-700 hover:underline"
              href={`${posRoutes.orders}?paymentStatus=unpaid`}
            >
              {copy.viewOrders}
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {summary.pendingOrders.length > 0 ? (
              summary.pendingOrders.map((order) => (
                <OrderRow
                  currency={currency}
                  key={order.id}
                  locale={locale}
                  order={order}
                />
              ))
            ) : (
              <EmptyList label={copy.emptyOrders} />
            )}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-950">
              {copy.readyTickets}
            </h2>
            <Link
              className="text-xs font-semibold text-blue-700 hover:underline"
              href={`${posRoutes.tickets}?scope=all&status=ready_to_pick`}
            >
              {copy.viewTickets}
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {summary.readyTickets.length > 0 ? (
              summary.readyTickets.map((ticket) => (
                <TicketRow
                  currency={currency}
                  key={ticket.id}
                  locale={locale}
                  ticket={ticket}
                  unitLabel={copy.items}
                />
              ))
            ) : (
              <EmptyList label={copy.emptyTickets} />
            )}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-amber-50 p-4">
              <p className="text-xs font-medium text-amber-700">
                {copy.overdueTickets}
              </p>
              <p className="mt-2 text-2xl font-bold text-amber-900">
                {formatNumber(overdueTicketCount, locale)}
              </p>
            </div>
            <div className="rounded-lg bg-red-50 p-4">
              <p className="text-xs font-medium text-red-700">
                {copy.exceptionTickets}
              </p>
              <p className="mt-2 text-2xl font-bold text-red-900">
                {formatNumber(exceptionTicketCount, locale)}
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {[...summary.exceptionTickets, ...summary.overdueTickets]
              .slice(0, 5)
              .map((ticket) => (
                <TicketRow
                  currency={currency}
                  key={ticket.id}
                  locale={locale}
                  ticket={ticket}
                  unitLabel={copy.items}
                />
              ))}
            {summary.exceptionTickets.length === 0 &&
            summary.overdueTickets.length === 0 ? (
              <EmptyList label={copy.emptyTickets} />
            ) : null}
          </div>
        </section>
      </div>
    </section>
  );
}
