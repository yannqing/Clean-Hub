"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import type {
  PosBranchSummary,
  PosOrderSummary,
  PosStaffSummary,
  PosZReport,
  ServiceTicketSummary,
  ShiftRecord,
} from "@cleanhub/api-client";
import { useTranslation } from "@cleanhub/i18n/react";

import {
  Icon,
  PosBreadcrumb,
  PosPageHeader,
  type PosIconName,
} from "@/components/app-shell";
import { posRoutes } from "@/config/routes";
import { DEFAULT_POS_CURRENCY } from "@/lib/money";
import type { PosSessionUser } from "@/lib/session";
import { posToast as toast } from "@/lib/pos-toast";

import { clockShiftAction, createShiftHandoverAction } from "../actions";
import type { ShiftHandoverSummary } from "../types";

const DRAFT_STORAGE_KEY = "cleanhub.pos-web.shift-handover-draft";

type ShiftHandoverDraft = {
  countedCash: string;
  incomingStaffId: string;
  notes: string;
  checks: boolean[];
};

type ShiftHandoverViewProps = {
  branch: PosBranchSummary | null;
  currentShift: ShiftRecord | null;
  recentReports: PosZReport[];
  staff: PosStaffSummary[];
  summary: ShiftHandoverSummary;
  user: PosSessionUser | null;
};

type Copy = {
  breadcrumb: string;
  title: string;
  description: string;
  currentShift: string;
  active: string;
  onBreak: string;
  noOpenShift: string;
  openingFloat: string;
  clockIn: string;
  clockOut: string;
  breakStart: string;
  breakEnd: string;
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
  noAvailableStaff: string;
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
  cutoff: string;
  grossSales: string;
  discounts: string;
  refunds: string;
  corrections: string;
  netSales: string;
};

const COPY: Record<"zh-CN" | "en" | "fr", Copy> = {
  "zh-CN": {
    breadcrumb: "交接班",
    title: "交接班",
    description: "核对现金、待收款订单、异常工单和待取件任务。",
    currentShift: "当前班次",
    active: "进行中",
    onBreak: "休息中",
    noOpenShift: "未上班",
    openingFloat: "开班备用金",
    clockIn: "上班",
    clockOut: "下班",
    breakStart: "开始休息",
    breakEnd: "结束休息",
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
    incomingStaffPlaceholder: "选择接班店员",
    noAvailableStaff: "暂无可接班店员",
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
    completeDisabled: "请先开班，并填写实点现金、选择接班人和完成确认项",
    print: "打印摘要",
    copy: "复制摘要",
    saved: "交接完成，Z Report 已生成。",
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
    recentRecords: "最近 Z Report",
    noRecentRecords: "暂无 Z Report",
    viewOrders: "处理订单",
    viewTickets: "查看工单",
    items: "件",
    total: "合计",
    cutoff: "截止时间",
    grossSales: "销售总额",
    discounts: "折扣",
    refunds: "退款",
    corrections: "冲正",
    netSales: "净销售额",
  },
  en: {
    breadcrumb: "Shift handover",
    title: "Shift handover",
    description:
      "Reconcile cash, unpaid orders, exception tickets, and pickup tasks.",
    currentShift: "Current shift",
    active: "Open",
    onBreak: "On break",
    noOpenShift: "Not clocked in",
    openingFloat: "Opening float",
    clockIn: "Clock in",
    clockOut: "Clock out",
    breakStart: "Start break",
    breakEnd: "End break",
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
    incomingStaffPlaceholder: "Select incoming staff",
    noAvailableStaff: "No staff available for handover",
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
    completeDisabled:
      "Open a shift, enter counted cash, choose incoming staff, and complete all confirmations",
    print: "Print summary",
    copy: "Copy summary",
    saved: "Handover completed and Z Report generated.",
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
    recentRecords: "Recent Z Reports",
    noRecentRecords: "No Z Reports",
    viewOrders: "Process orders",
    viewTickets: "View tickets",
    items: "items",
    total: "Total",
    cutoff: "Cutoff",
    grossSales: "Gross sales",
    discounts: "Discounts",
    refunds: "Refunds",
    corrections: "Corrections",
    netSales: "Net sales",
  },
  fr: {
    breadcrumb: "Passation",
    title: "Passation",
    description:
      "Rapprochez les espèces, les commandes non payées, les tickets en exception et les retraits.",
    currentShift: "Service actuel",
    active: "Ouvert",
    onBreak: "En pause",
    noOpenShift: "Service non ouvert",
    openingFloat: "Fonds de caisse initial",
    clockIn: "Prendre le service",
    clockOut: "Terminer le service",
    breakStart: "Commencer la pause",
    breakEnd: "Terminer la pause",
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
    incomingStaffPlaceholder: "Sélectionner l'employé entrant",
    noAvailableStaff: "Aucun employé disponible pour la passation",
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
    completeDisabled:
      "Ouvrez un service, saisissez les espèces, choisissez l'employé entrant et validez les contrôles",
    print: "Imprimer le résumé",
    copy: "Copier le résumé",
    saved: "Passation terminée et rapport Z généré.",
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
    recentRecords: "Rapports Z récents",
    noRecentRecords: "Aucun rapport Z",
    viewOrders: "Traiter les commandes",
    viewTickets: "Voir les tickets",
    items: "articles",
    total: "Total",
    cutoff: "Clôture",
    grossSales: "Ventes brutes",
    discounts: "Remises",
    refunds: "Remboursements",
    corrections: "Corrections",
    netSales: "Ventes nettes",
  },
};

const PAYMENT_METHOD_LABELS: Record<
  string,
  Record<"zh-CN" | "en" | "fr", string>
> = {
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
  orange_money: {
    "zh-CN": "Orange Money",
    en: "Orange Money",
    fr: "Orange Money",
  },
  wave: {
    "zh-CN": "Wave",
    en: "Wave",
    fr: "Wave",
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

function readDraft(): ShiftHandoverDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<ShiftHandoverDraft>;
    if (
      typeof parsed.countedCash !== "string" ||
      typeof parsed.incomingStaffId !== "string" ||
      typeof parsed.notes !== "string" ||
      !Array.isArray(parsed.checks) ||
      !parsed.checks.every((item) => typeof item === "boolean")
    ) {
      return null;
    }
    return {
      countedCash: parsed.countedCash,
      incomingStaffId: parsed.incomingStaffId,
      notes: parsed.notes,
      checks: parsed.checks,
    };
  } catch {
    return null;
  }
}

function writeDraft(draft: ShiftHandoverDraft) {
  window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: PosIconName;
  label: string;
  value: string;
}) {
  return (
    <article className="flex min-h-20 items-center gap-3 rounded-md border bg-background px-3 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" name={icon} />
      </span>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground">
            {label}
          </p>
          <p className="mt-0.5 truncate text-lg font-semibold text-foreground">
            {value}
          </p>
        </div>
      </div>
    </article>
  );
}

function EmptyList({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed bg-muted/20 px-4 py-6 text-center text-sm font-medium text-muted-foreground">
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
      className="block border-b px-1 py-3 transition-colors hover:bg-accent"
      href={posRoutes.orderDetail(order.id)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold text-foreground">
            {displayOrderCode(order.id)}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">
            {order.customerName}
          </p>
        </div>
        <p className="shrink-0 text-right text-sm font-bold text-foreground">
          {formatMoney(toNumber(order.totalAmount), currency, locale)}
        </p>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{formatDateTime(order.createdAt, locale)}</span>
        <span>{formatMoney(toNumber(order.paidAmount), currency, locale)}</span>
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
      className="block border-b px-1 py-3 transition-colors hover:bg-accent"
      href={posRoutes.ticketDetail(ticket.id)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold text-foreground">
            {displayTicketCode(ticket)}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">
            {ticket.customerName}
          </p>
        </div>
        <p className="shrink-0 text-right text-sm font-bold text-foreground">
          {formatMoney(toNumber(ticket.totalAmount), currency, locale)}
        </p>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
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
  currentShift,
  recentReports,
  staff,
  summary,
  user,
}: ShiftHandoverViewProps) {
  const router = useRouter();
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
    return toNumber(currentShift?.openingFloat) + toNumber(cash?.amount);
  }, [currentShift?.openingFloat, summary.orders]);
  const paidToday = toNumber(summary.orders?.paidAmount);
  const orderCount = summary.orders?.orderCount ?? 0;
  const pendingOrderCount =
    (summary.orders?.unpaidCount ?? 0) + (summary.orders?.partialCount ?? 0);
  const readyTicketCount = summary.tickets?.byStatus.ready_to_pick ?? 0;
  const overdueTicketCount = summary.tickets?.overdueCount ?? 0;
  const exceptionTicketCount = summary.tickets?.byStatus.exception ?? 0;
  const availableStaff = staff.filter(
    (item) => item.id !== user?.userId && item.status === "off_duty",
  );
  const [countedCash, setCountedCash] = useState("");
  const [incomingStaffId, setIncomingStaffId] = useState("");
  const [notes, setNotes] = useState("");
  const [openingFloat, setOpeningFloat] = useState("0");
  const [checks, setChecks] = useState<boolean[]>(() =>
    copy.checklist.map(() => false),
  );
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const countedCashValue = toNumber(countedCash);
  const variance = countedCashValue - expectedCash;
  const allChecked = checks.every(Boolean);
  const canComplete =
    currentShift !== null &&
    countedCash.trim().length > 0 &&
    incomingStaffId.length > 0 &&
    allChecked &&
    !isSubmitting;
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
      if (!currentShift) {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
        setDraftHydrated(false);
        return;
      }
      const draft = readDraft();
      if (draft) {
        setCountedCash(draft.countedCash);
        setIncomingStaffId(draft.incomingStaffId);
        setNotes(draft.notes);
        setChecks(
          copy.checklist.map((_, index) => draft.checks[index] ?? false),
        );
      }
      setDraftHydrated(true);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copy.checklist, currentShift?.id, currentShift]);

  useEffect(() => {
    if (!draftHydrated || !currentShift) return;
    writeDraft({ countedCash, incomingStaffId, notes, checks });
  }, [
    checks,
    countedCash,
    currentShift,
    draftHydrated,
    incomingStaffId,
    notes,
  ]);

  function updateCheck(index: number, checked: boolean) {
    setChecks((current) =>
      current.map((value, itemIndex) =>
        itemIndex === index ? checked : value,
      ),
    );
  }

  async function completeHandover() {
    if (!canComplete) {
      toast.warning(copy.completeDisabled);
      return;
    }
    setIsSubmitting(true);
    const result = await createShiftHandoverAction({
      incomingStaffId,
      countedCash,
      notes: notes.trim() || undefined,
    });
    if (!result.ok) {
      toast.error(result.message);
      setIsSubmitting(false);
      return;
    }

    setDraftHydrated(false);
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    setCountedCash("");
    setIncomingStaffId("");
    setNotes("");
    setChecks(copy.checklist.map(() => false));
    setIsSubmitting(false);
    toast.success(copy.saved);
    router.refresh();
  }

  async function performClockAction(
    action: "clock_in" | "clock_out" | "break_start" | "break_end",
  ) {
    if (action === "clock_out" && countedCash.trim().length === 0) {
      toast.warning(copy.completeDisabled);
      return;
    }
    setIsSubmitting(true);
    const result = await clockShiftAction({
      action,
      openingFloat: action === "clock_in" ? openingFloat : undefined,
      closingFloat: action === "clock_out" ? countedCash : undefined,
    });
    if (!result.ok) {
      toast.error(result.message);
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(false);
    router.refresh();
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
      ? "text-foreground"
      : variance > 0
        ? "text-emerald-700"
        : "text-destructive";

  return (
    <section className="space-y-7 pb-8">
      <PosBreadcrumb items={[{ label: copy.breadcrumb }]} />

      <PosPageHeader
        actions={
          <span
            className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${
              currentShift?.status === "open"
                ? "bg-emerald-50 text-emerald-700"
                : currentShift?.status === "on_break"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                currentShift?.status === "open"
                  ? "bg-emerald-500"
                  : currentShift?.status === "on_break"
                    ? "bg-amber-500"
                    : "bg-muted-foreground"
              }`}
            />
            {currentShift?.status === "open"
              ? copy.active
              : currentShift?.status === "on_break"
                ? copy.onBreak
                : copy.noOpenShift}
          </span>
        }
        description={copy.description}
        icon="replace"
        title={copy.title}
      />

      <div className="border-y bg-background py-4">
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-md bg-muted/40 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              {copy.cashier}
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-foreground">
              {cashierName}
            </p>
          </div>
          <div className="rounded-md bg-muted/40 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              {copy.branch}
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-foreground">
              {branchName}
            </p>
          </div>
          <div className="rounded-md bg-muted/40 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              {copy.generatedAt}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {formatDateTime(summary.generatedAt, locale)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3 border-t pt-4">
          {!currentShift ? (
            <label className="block min-w-52">
              <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                {copy.openingFloat}
              </span>
              <input
                className="h-11 w-full rounded-md border bg-background px-3 text-sm font-semibold text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                inputMode="decimal"
                onChange={(event) =>
                  setOpeningFloat(normalizeMoneyInput(event.target.value))
                }
                placeholder="0"
                value={openingFloat}
              />
            </label>
          ) : null}
          {!currentShift ? (
            <button
              className="inline-flex h-11 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
              disabled={isSubmitting || openingFloat.trim().length === 0}
              onClick={() => void performClockAction("clock_in")}
              type="button"
            >
              <Icon className="h-4 w-4" name="clock" />
              {copy.clockIn}
            </button>
          ) : currentShift.status === "on_break" ? (
            <button
              className="inline-flex h-11 items-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
              disabled={isSubmitting}
              onClick={() => void performClockAction("break_end")}
              type="button"
            >
              <Icon className="h-4 w-4" name="clock" />
              {copy.breakEnd}
            </button>
          ) : (
            <>
              <button
                className="inline-flex h-11 items-center gap-2 rounded-md border bg-background px-4 text-sm font-semibold text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:text-muted-foreground"
                disabled={isSubmitting}
                onClick={() => void performClockAction("break_start")}
                type="button"
              >
                <Icon className="h-4 w-4" name="clock" />
                {copy.breakStart}
              </button>
              <button
                className="inline-flex h-11 items-center gap-2 rounded-md border border-destructive/30 bg-background px-4 text-sm font-semibold text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:text-muted-foreground"
                disabled={isSubmitting || countedCash.trim().length === 0}
                onClick={() => void performClockAction("clock_out")}
                type="button"
              >
                <Icon className="h-4 w-4" name="replace" />
                {copy.clockOut}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon="wallet-cards"
          label={copy.expectedCash}
          value={formatMoney(expectedCash, currency, locale)}
        />
        <MetricCard
          icon="receipt"
          label={copy.paidToday}
          value={formatMoney(paidToday, currency, locale)}
        />
        <MetricCard
          icon="clock"
          label={copy.pendingPayment}
          value={formatNumber(pendingOrderCount, locale)}
        />
        <MetricCard
          icon="package-check"
          label={copy.readyPickup}
          value={formatNumber(readyTicketCount, locale)}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <section className="border-y bg-background p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {copy.cashCardTitle}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {copy.cashCardDescription}
              </p>
            </div>
            <div className={`text-right text-2xl font-bold ${varianceTone}`}>
              {formatMoney(variance, currency, locale)}
              <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                {copy.variance}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                {copy.cashInputLabel}
              </span>
              <input
                className="h-11 w-full rounded-md border bg-background px-3 text-sm font-semibold text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                disabled={!currentShift}
                inputMode="decimal"
                onChange={(event) =>
                  setCountedCash(normalizeMoneyInput(event.target.value))
                }
                placeholder="0"
                value={countedCash}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                {copy.incomingStaffLabel}
              </span>
              <select
                className="h-11 w-full rounded-md border bg-background px-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                disabled={!currentShift || availableStaff.length === 0}
                onChange={(event) => setIncomingStaffId(event.target.value)}
                value={incomingStaffId}
              >
                <option value="">
                  {availableStaff.length > 0
                    ? copy.incomingStaffPlaceholder
                    : copy.noAvailableStaff}
                </option>
                {availableStaff.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.displayName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              {copy.notesLabel}
            </span>
            <textarea
              className="min-h-24 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              disabled={!currentShift}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={copy.notesPlaceholder}
              value={notes}
            />
          </label>

          <div className="mt-5 rounded-md border bg-muted/30 p-4">
            <h3 className="text-xs font-semibold text-foreground">
              {copy.checklistTitle}
            </h3>
            <div className="mt-3 grid gap-2">
              {copy.checklist.map((item, index) => (
                <label
                  className="flex min-h-11 items-center gap-3 rounded-md bg-background px-3 py-2 text-sm font-medium text-foreground"
                  key={item}
                >
                  <input
                    checked={checks[index] ?? false}
                    className="h-4 w-4 rounded border-border text-foreground"
                    disabled={!currentShift}
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
              className="inline-flex h-11 items-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
              disabled={!canComplete}
              onClick={() => void completeHandover()}
              type="button"
            >
              <Icon className="h-4 w-4" name="save" />
              {copy.complete}
            </button>
            <button
              className="inline-flex h-11 items-center gap-2 rounded-md border bg-background px-4 text-sm font-semibold text-foreground transition hover:bg-accent"
              onClick={() => window.print()}
              type="button"
            >
              <Icon className="h-4 w-4" name="printer" />
              {copy.print}
            </button>
            <button
              className="inline-flex h-11 items-center gap-2 rounded-md border bg-background px-4 text-sm font-semibold text-foreground transition hover:bg-accent"
              onClick={() => void copySummary()}
              type="button"
            >
              <Icon className="h-4 w-4" name="clipboard-list" />
              {copy.copy}
            </button>
          </div>
          {!canComplete ? (
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              {copy.completeDisabled}
            </p>
          ) : null}
        </section>

        <aside className="space-y-5">
          <section className="border-y bg-background p-5">
            <h2 className="text-sm font-semibold text-foreground">
              {copy.paymentBreakdown}
            </h2>
            <div className="mt-4 space-y-3">
              {summary.orders?.paymentMethods.length ? (
                summary.orders.paymentMethods.map((item) => (
                  <div
                    className="flex items-center justify-between gap-3 text-sm"
                    key={`${item.method}:${item.provider ?? "default"}`}
                  >
                    <span className="font-medium text-muted-foreground">
                      {PAYMENT_METHOD_LABELS[item.provider ?? item.method]?.[
                        resolvedLocale
                      ] ??
                        item.provider ??
                        item.method}
                    </span>
                    <span className="font-semibold text-foreground">
                      {formatMoney(toNumber(item.amount), currency, locale)}
                    </span>
                  </div>
                ))
              ) : (
                <EmptyList label={copy.noPayments} />
              )}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm font-semibold">
              <span className="text-muted-foreground">{copy.orderCount}</span>
              <span className="text-foreground">
                {formatNumber(orderCount, locale)}
              </span>
            </div>
          </section>

          <section className="border-y bg-background p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-foreground">
                {copy.recentRecords}
              </h2>
            </div>
            <div className="mt-4 space-y-3">
              {recentReports.length > 0 ? (
                recentReports.map((report) => (
                  <div className="border-b py-3" key={report.id}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-xs font-semibold text-foreground">
                        Z-{report.id.slice(-8).toUpperCase()}
                      </p>
                      <span className="text-xs font-medium text-muted-foreground">
                        {formatDateTime(report.cutoffAt, locale)}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      <span className="text-muted-foreground">
                        {copy.grossSales}
                      </span>
                      <span className="text-right font-semibold text-foreground">
                        {formatMoney(
                          toNumber(report.grossSales),
                          report.currency,
                          locale,
                        )}
                      </span>
                      <span className="text-muted-foreground">
                        {copy.discounts}
                      </span>
                      <span className="text-right font-semibold text-foreground">
                        {formatMoney(
                          toNumber(report.discountAmount),
                          report.currency,
                          locale,
                        )}
                      </span>
                      <span className="text-muted-foreground">
                        {copy.refunds}
                      </span>
                      <span className="text-right font-semibold text-destructive">
                        {formatMoney(
                          toNumber(report.refundAmount),
                          report.currency,
                          locale,
                        )}
                      </span>
                      <span className="text-muted-foreground">
                        {copy.corrections}
                      </span>
                      <span className="text-right font-semibold text-foreground">
                        {formatMoney(
                          toNumber(report.correctionAmount),
                          report.currency,
                          locale,
                        )}
                      </span>
                      <span className="text-muted-foreground">
                        {copy.netSales}
                      </span>
                      <span className="text-right font-semibold text-foreground">
                        {formatMoney(
                          toNumber(report.netSales),
                          report.currency,
                          locale,
                        )}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-center text-xs">
                      <div>
                        <p className="text-muted-foreground">
                          {copy.expectedCash}
                        </p>
                        <p className="mt-1 font-semibold text-foreground">
                          {formatMoney(
                            toNumber(report.expectedCash),
                            report.currency,
                            locale,
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          {copy.cashCounted}
                        </p>
                        <p className="mt-1 font-semibold text-foreground">
                          {formatMoney(
                            toNumber(report.countedCash),
                            report.currency,
                            locale,
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{copy.variance}</p>
                        <p className="mt-1 font-semibold text-foreground">
                          {formatMoney(
                            toNumber(report.variance),
                            report.currency,
                            locale,
                          )}
                        </p>
                      </div>
                    </div>
                    {report.paymentBreakdown.length > 0 ? (
                      <div className="mt-3 space-y-1.5 border-t pt-3 text-xs">
                        {report.paymentBreakdown.map((payment) => (
                          <div
                            className="flex items-center justify-between gap-3"
                            key={`${payment.method}:${payment.provider ?? "default"}`}
                          >
                            <span className="truncate text-muted-foreground">
                              {PAYMENT_METHOD_LABELS[
                                payment.provider ?? payment.method
                              ]?.[resolvedLocale] ??
                                payment.provider ??
                                payment.method}
                            </span>
                            <span className="font-semibold text-foreground">
                              {formatMoney(
                                toNumber(payment.netAmount),
                                report.currency,
                                locale,
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
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
        <section className="border-y bg-background p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">
              {copy.pendingOrders}
            </h2>
            <Link
              className="text-xs font-semibold text-foreground underline-offset-4 hover:underline"
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

        <section className="border-y bg-background p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">
              {copy.readyTickets}
            </h2>
            <Link
              className="text-xs font-semibold text-foreground underline-offset-4 hover:underline"
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

        <section className="border-y bg-background p-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md bg-amber-50 p-4 dark:bg-amber-950/35">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                {copy.overdueTickets}
              </p>
              <p className="mt-2 text-2xl font-bold text-amber-900 dark:text-amber-100">
                {formatNumber(overdueTicketCount, locale)}
              </p>
            </div>
            <div className="rounded-md bg-destructive/10 p-4">
              <p className="text-xs font-medium text-destructive">
                {copy.exceptionTickets}
              </p>
              <p className="mt-2 text-2xl font-bold text-destructive">
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
