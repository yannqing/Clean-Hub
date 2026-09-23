"use client";

import type {
  PosBranchSummary,
  PosCurrentShiftReconciliation,
  PosRegisterState,
  PosZReport,
  ShiftRecord,
} from "@cleanhub/api-client";
import { useTranslation } from "@cleanhub/i18n/react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cleanhub/ui";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { PosBreadcrumb, PosPageHeader } from "@/components/app-shell";
import { DEFAULT_POS_CURRENCY } from "@/lib/money";
import { posToast as toast } from "@/lib/pos-toast";
import type { PosSessionUser } from "@/lib/session";

import {
  clockShiftAction,
  closeRegisterAction,
  openRegisterAction,
} from "../actions";
import type { ShiftHandoverSummary } from "../types";
import { CashMovementPanel } from "./cash-movement-panel";

type Props = {
  branch: PosBranchSummary | null;
  currentShift: ShiftRecord | null;
  recentReports: PosZReport[];
  reconciliation: PosCurrentShiftReconciliation | null;
  register: PosRegisterState;
  summary: ShiftHandoverSummary;
  user: PosSessionUser | null;
};

type Locale = "zh-CN" | "en" | "fr";

const COPY = {
  "zh-CN": {
    breadcrumb: "班次与收银",
    title: "班次与收银",
    description: "员工出勤和收银责任相互独立；只有使用现金时才需要钱箱核对。",
    workShift: "员工班次",
    workShiftDescription: "记录上班、休息和下班，不绑定某一台 POS 或钱箱。",
    clockedOut: "未上班",
    working: "上班中",
    break: "休息中",
    clockIn: "上班",
    clockOut: "下班",
    startBreak: "开始休息",
    endBreak: "结束休息",
    register: "收银台会话",
    registerDescription: "记录本终端的销售窗口；电子支付无需实体钱箱。",
    registerOpen: "已开启",
    registerClosed: "未开启",
    openRegister: "开启收银台",
    openPersonalCash: "开启我的随身现金",
    closeRegister: "关闭并生成 Z Report",
    closePersonalCash: "盘点并关闭我的随身现金",
    finalizeRegister: "关闭收银台并生成 Z Report",
    openingFloat: "开柜备用金",
    countedCash: "实点现金",
    notes: "关账备注（可选）",
    noCash: "本终端不接受现金，无需配置或核对钱箱。",
    untrackedCash: "本终端接受现金，但当前设置不跟踪钱箱金额。",
    sharedDrawer: "共享钱箱",
    cashInHand: "随身现金",
    expectedCash: "系统应有现金",
    netSales: "本收银台净销售额",
    taxableAmount: "应税金额",
    taxAmount: "订单原始税额",
    exportCsv: "下载 CSV",
    taxUnavailable: "旧报表未记录税额",
    unsettled: "待确认支付",
    pendingOrders: "待收款订单",
    readyTickets: "待取件工单",
    recentReports: "最近 Z Report",
    noReports: "暂无关账记录",
    opened: "收银台已开启。",
    personalCashOpened: "随身现金会话已开启。",
    closed: "收银台已关闭，Z Report 已生成。",
    personalCashClosed: "随身现金已盘点并关闭，收银台仍保持开启。",
    confirmCloseTitle: "确认关闭收银台？",
    confirmClosePersonalCashTitle: "确认盘点并关闭随身现金？",
    confirmCloseDescription:
      "关闭后会生成 Z Report 并锁定本次现金会话，此操作无法撤销。",
    confirmClosePersonalCashDescription:
      "关闭后会锁定本次随身现金会话，此操作无法撤销。收银台仍保持开启。",
    confirmCountedCash: "实点现金",
    confirmExpectedCash: "系统应有现金",
    confirmVariance: "差额",
    confirmNotEntered: "未填写",
    confirmCancel: "再检查一下",
    confirmClose: "确认关闭",
    confirmClockOutTitle: "确认下班？",
    confirmClockOutDescription: "下班后需要重新打卡才能继续收银。",
    confirmClockOut: "确认下班",
    closing: "关闭中…",
  },
  en: {
    breadcrumb: "Shifts & register",
    title: "Shifts & register",
    description: "Attendance and register accountability are separate. Cash reconciliation is only required when cash is tracked.",
    workShift: "Work shift",
    workShiftDescription: "Tracks attendance and breaks without owning a POS terminal or drawer.",
    clockedOut: "Off duty",
    working: "Working",
    break: "On break",
    clockIn: "Clock in",
    clockOut: "Clock out",
    startBreak: "Start break",
    endBreak: "End break",
    register: "Register session",
    registerDescription: "Tracks this terminal's sales window. Electronic payments do not require a drawer.",
    registerOpen: "Open",
    registerClosed: "Closed",
    openRegister: "Open register",
    openPersonalCash: "Open my cash in hand",
    closeRegister: "Close and create Z Report",
    closePersonalCash: "Count and close my cash in hand",
    finalizeRegister: "Close register and create Z Report",
    openingFloat: "Opening float",
    countedCash: "Counted cash",
    notes: "Closing notes (optional)",
    noCash: "Cash is disabled on this terminal, so no drawer is required.",
    untrackedCash: "Cash is accepted, but drawer totals are not tracked by the current policy.",
    sharedDrawer: "Shared drawer",
    cashInHand: "Cash in hand",
    expectedCash: "Expected cash",
    netSales: "Register net sales",
    taxableAmount: "Taxable amount",
    taxAmount: "Gross order tax",
    exportCsv: "Download CSV",
    taxUnavailable: "Tax not recorded on older reports",
    unsettled: "Unsettled payments",
    pendingOrders: "Unpaid orders",
    readyTickets: "Ready tickets",
    recentReports: "Recent Z Reports",
    noReports: "No closing reports yet",
    opened: "Register opened.",
    personalCashOpened: "Personal cash session opened.",
    closed: "Register closed and Z Report created.",
    personalCashClosed: "Personal cash counted and closed. The register remains open.",
    confirmCloseTitle: "Close the register?",
    confirmClosePersonalCashTitle: "Count and close your cash in hand?",
    confirmCloseDescription:
      "Closing creates the Z Report and locks this cash session. This cannot be undone.",
    confirmClosePersonalCashDescription:
      "Closing locks this personal cash session and cannot be undone. The register stays open.",
    confirmCountedCash: "Counted cash",
    confirmExpectedCash: "Expected cash",
    confirmVariance: "Variance",
    confirmNotEntered: "Not entered",
    confirmCancel: "Let me check again",
    confirmClose: "Close register",
    confirmClockOutTitle: "Clock out?",
    confirmClockOutDescription: "You will need to clock in again before taking payments.",
    confirmClockOut: "Clock out",
    closing: "Closing...",
  },
  fr: {
    breadcrumb: "Services et caisse",
    title: "Services et caisse",
    description: "La présence et la responsabilité de caisse sont séparées. Le comptage n'est requis que pour les espèces suivies.",
    workShift: "Service employé",
    workShiftDescription: "Suit la présence et les pauses sans attribuer un terminal ou un tiroir.",
    clockedOut: "Hors service",
    working: "En service",
    break: "En pause",
    clockIn: "Prendre le service",
    clockOut: "Terminer le service",
    startBreak: "Commencer la pause",
    endBreak: "Terminer la pause",
    register: "Session de caisse",
    registerDescription: "Suit la période de vente du terminal. Les paiements électroniques n'exigent pas de tiroir.",
    registerOpen: "Ouverte",
    registerClosed: "Fermée",
    openRegister: "Ouvrir la caisse",
    openPersonalCash: "Ouvrir mes espèces en main",
    closeRegister: "Fermer et créer le rapport Z",
    closePersonalCash: "Compter et fermer mes espèces",
    finalizeRegister: "Fermer la caisse et créer le rapport Z",
    openingFloat: "Fonds initial",
    countedCash: "Espèces comptées",
    notes: "Notes de clôture (facultatif)",
    noCash: "Les espèces sont désactivées sur ce terminal ; aucun tiroir n'est requis.",
    untrackedCash: "Les espèces sont acceptées, mais les montants du tiroir ne sont pas suivis.",
    sharedDrawer: "Tiroir partagé",
    cashInHand: "Espèces en main",
    expectedCash: "Espèces attendues",
    netSales: "Ventes nettes de la caisse",
    taxableAmount: "Base imposable",
    taxAmount: "TVA brute des commandes",
    exportCsv: "Télécharger CSV",
    taxUnavailable: "Taxe non enregistrée sur les anciens rapports",
    unsettled: "Paiements à confirmer",
    pendingOrders: "Commandes impayées",
    readyTickets: "Tickets prêts",
    recentReports: "Rapports Z récents",
    noReports: "Aucun rapport de clôture",
    opened: "Caisse ouverte.",
    personalCashOpened: "Session d'espèces personnelle ouverte.",
    closed: "Caisse fermée et rapport Z créé.",
    personalCashClosed: "Espèces personnelles comptées et fermées. La caisse reste ouverte.",
    confirmCloseTitle: "Fermer la caisse ?",
    confirmClosePersonalCashTitle: "Compter et fermer vos espèces en main ?",
    confirmCloseDescription:
      "La fermeture crée le rapport Z et verrouille cette session d'espèces. C'est irréversible.",
    confirmClosePersonalCashDescription:
      "La fermeture verrouille cette session d'espèces personnelle et est irréversible. La caisse reste ouverte.",
    confirmCountedCash: "Espèces comptées",
    confirmExpectedCash: "Espèces attendues",
    confirmVariance: "Écart",
    confirmNotEntered: "Non saisi",
    confirmCancel: "Je vérifie encore",
    confirmClose: "Fermer la caisse",
    confirmClockOutTitle: "Terminer le service ?",
    confirmClockOutDescription:
      "Vous devrez pointer à nouveau avant d'encaisser.",
    confirmClockOut: "Terminer le service",
    closing: "Fermeture...",
  },
} satisfies Record<Locale, Record<string, string>>;

function resolveLocale(locale: string): Locale {
  return locale === "en" || locale === "fr" ? locale : "zh-CN";
}

function money(value: string | number | null | undefined, currency: string, locale: string) {
  return `${currency} ${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(Number(value ?? 0))}`;
}

function dateTime(value: string, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

function downloadZReport(report: PosZReport, labels: typeof COPY[Locale]) {
  const rows: Array<Array<string | number | null>> = [
    ["Z Report", report.id],
    ["Date", report.cutoffAt],
    ["Currency", report.currency],
    ["Orders", report.orderCount],
    [labels.taxableAmount, report.taxableAmount],
    [labels.taxAmount, report.taxAmount],
    [labels.netSales, report.netSales],
    [labels.expectedCash, report.expectedCash],
    [labels.confirmVariance, report.variance],
    ...report.paymentBreakdown.map((payment) => [
      `${payment.method}${payment.provider ? ` / ${payment.provider}` : ""}`,
      payment.netAmount,
    ]),
  ];
  const escapeCell = (value: string | number | null) => {
    const text = value === null ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const csv = `\uFEFF${rows.map((row) => row.map(escapeCell).join(",")).join("\r\n")}\r\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `z-report-${report.cutoffAt.slice(0, 10)}-${report.id}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${active ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
      <span className={`size-2 rounded-full ${active ? "bg-emerald-500" : "bg-muted-foreground/60"}`} />
      {label}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:px-4 sm:last:border-r-0">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function PosOperationsView({
  branch,
  currentShift,
  recentReports,
  reconciliation,
  register,
  summary,
  user,
}: Props) {
  const router = useRouter();
  const { locale } = useTranslation();
  const copy = COPY[resolveLocale(locale)];
  const currency = register.registerSession?.currency ?? branch?.defaultCurrency ?? DEFAULT_POS_CURRENCY;
  const timeZone = user?.timezone ?? "UTC";
  const [openingFloat, setOpeningFloat] = useState("0");
  const [countedCash, setCountedCash] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  /**
   * Which irreversible action is waiting on confirmation.
   *
   * One slot rather than a flag per action: closing the register and clocking
   * out can never both be pending, and a single value makes that impossible to
   * get wrong.
   */
  const [pendingAction, setPendingAction] = useState<
    "close_register" | "clock_out" | null
  >(null);
  const trackedCash = ["shared_drawer", "cash_in_hand"].includes(register.cashHandlingMode);
  const personalCash = register.cashHandlingMode === "cash_in_hand";
  const needsPersonalCashSession = Boolean(
    personalCash && register.registerSession && !register.cashSession,
  );
  const canFinalizeRegister = user?.role === "owner" || user?.role === "manager";
  const modeLabel = useMemo(() => {
    if (register.cashHandlingMode === "shared_drawer") return copy.sharedDrawer;
    if (register.cashHandlingMode === "cash_in_hand") return copy.cashInHand;
    return null;
  }, [copy, register.cashHandlingMode]);

  async function clock(action: "clock_in" | "clock_out" | "break_start" | "break_end") {
    setBusy(true);
    const result = await clockShiftAction({ action });
    setBusy(false);
    if (!result.ok) return toast.error(result.message);
    router.refresh();
  }

  /**
   * Clocking out ends the shift and forces a fresh clock-in before the next
   * sale, so it asks first. The other three transitions are cheap to undo and
   * go straight through.
   */
  function requestClock(
    action: "clock_in" | "clock_out" | "break_start" | "break_end",
  ) {
    if (action === "clock_out") {
      setPendingAction("clock_out");
      return;
    }
    void clock(action);
  }

  async function openRegister() {
    setBusy(true);
    const result = await openRegisterAction({
      openingFloat: trackedCash ? openingFloat : undefined,
    });
    setBusy(false);
    if (!result.ok) return toast.error(result.message);
    toast.success(needsPersonalCashSession ? copy.personalCashOpened : copy.opened);
    router.refresh();
  }

  /**
   * Validate before asking, not after.
   *
   * A missing cash count is the cashier's to fix, so it surfaces while the
   * numbers are still on screen. Confirming first and only then being told the
   * count is blank would make the dialog feel like it did nothing.
   */
  function requestCloseRegister() {
    if (
      register.cashSession &&
      register.requireClosingCount &&
      countedCash.trim() === ""
    ) {
      toast.warning(copy.countedCash);
      return;
    }
    setPendingAction("close_register");
  }

  async function closeRegister() {
    setBusy(true);
    const result = await closeRegisterAction({
      countedCash: register.cashSession ? countedCash : undefined,
      notes: notes.trim() || undefined,
    });
    setBusy(false);
    setPendingAction(null);
    if (!result.ok) return toast.error(result.message);
    toast.success(result.data.registerClosed ? copy.closed : copy.personalCashClosed);
    setCountedCash("");
    setNotes("");
    router.refresh();
  }

  return (
    <section className="space-y-6 pb-8">
      <PosBreadcrumb items={[{ label: copy.breadcrumb }]} />
      <PosPageHeader description={copy.description} icon="replace" title={copy.title} />

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="border-y bg-background py-5 sm:rounded-lg sm:border sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">{copy.workShift}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy.workShiftDescription}</p>
            </div>
            <StatusPill active={Boolean(currentShift)} label={currentShift?.status === "on_break" ? copy.break : currentShift ? copy.working : copy.clockedOut} />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {!currentShift ? (
              <button className="col-span-2 h-11 rounded-md bg-foreground text-sm font-semibold text-background disabled:opacity-50" disabled={busy} onClick={() => void clock("clock_in")} type="button">{copy.clockIn}</button>
            ) : currentShift.status === "on_break" ? (
              <button className="col-span-2 h-11 rounded-md bg-foreground text-sm font-semibold text-background disabled:opacity-50" disabled={busy} onClick={() => void clock("break_end")} type="button">{copy.endBreak}</button>
            ) : (
              <>
                <button className="h-11 rounded-md border text-sm font-semibold disabled:opacity-50" disabled={busy} onClick={() => void clock("break_start")} type="button">{copy.startBreak}</button>
                <button className="h-11 rounded-md border border-destructive/30 text-sm font-semibold text-destructive disabled:opacity-50" disabled={busy} onClick={() => requestClock("clock_out")} type="button">{copy.clockOut}</button>
              </>
            )}
          </div>
        </section>

        <section className="border-y bg-background py-5 sm:rounded-lg sm:border sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">{copy.register}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy.registerDescription}</p>
            </div>
            <StatusPill active={Boolean(register.registerSession)} label={register.registerSession ? copy.registerOpen : copy.registerClosed} />
          </div>

          <div className="mt-4 rounded-md bg-muted/45 px-3 py-2.5 text-sm text-muted-foreground">
            {register.cashHandlingMode === "none" ? copy.noCash : register.cashHandlingMode === "untracked" ? copy.untrackedCash : modeLabel}
          </div>

          {!register.registerSession || needsPersonalCashSession ? (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              {trackedCash ? (
                <label className="flex-1">
                  <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{copy.openingFloat}</span>
                  <input className="h-11 w-full rounded-md border bg-background px-3 text-sm" inputMode="decimal" onChange={(event) => setOpeningFloat(event.target.value)} value={openingFloat} />
                </label>
              ) : null}
              <button className="h-11 rounded-md bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50" disabled={busy} onClick={() => void openRegister()} type="button">{needsPersonalCashSession ? copy.openPersonalCash : copy.openRegister}</button>
              {needsPersonalCashSession && canFinalizeRegister ? (
                <button className="h-11 rounded-md border border-destructive/30 px-4 text-sm font-semibold text-destructive disabled:opacity-50" disabled={busy} onClick={requestCloseRegister} type="button">{copy.finalizeRegister}</button>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {trackedCash ? (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{copy.countedCash}{register.requireClosingCount ? " *" : ""}</span>
                  <input className="h-11 w-full rounded-md border bg-background px-3 text-sm" inputMode="decimal" onChange={(event) => setCountedCash(event.target.value)} value={countedCash} />
                </label>
              ) : null}
              <input className="h-11 w-full rounded-md border bg-background px-3 text-sm" maxLength={2000} onChange={(event) => setNotes(event.target.value)} placeholder={copy.notes} value={notes} />
              <button className="h-11 w-full rounded-md border border-destructive/30 text-sm font-semibold text-destructive disabled:opacity-50" disabled={busy} onClick={requestCloseRegister} type="button">{personalCash ? copy.closePersonalCash : copy.closeRegister}</button>
            </div>
          )}
        </section>
      </div>

      <section className="grid border-y bg-background px-4 sm:grid-cols-4 sm:rounded-lg sm:border sm:px-0">
        <Metric label={copy.expectedCash} value={money(reconciliation?.expectedCash, currency, locale)} />
        <Metric label={copy.netSales} value={money(reconciliation?.netSales, currency, locale)} />
        <Metric label={copy.unsettled} value={String((reconciliation?.unsettledPaymentCount ?? 0) + (reconciliation?.unsettledRefundCount ?? 0))} />
        <Metric label={copy.pendingOrders} value={String((summary.orders?.unpaidCount ?? 0) + (summary.orders?.partialCount ?? 0))} />
      </section>

      {register.cashSession ? (
        <CashMovementPanel canManage={user?.role === "owner" || user?.role === "manager"} register={register} />
      ) : null}

      <section className="border-y bg-background py-5 sm:rounded-lg sm:border sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">{copy.recentReports}</h2>
          <span className="text-xs text-muted-foreground">{copy.readyTickets}: {summary.tickets?.byStatus.ready_to_pick ?? 0}</span>
        </div>
        {recentReports.length ? (
          <div className="mt-3 divide-y">
            {recentReports.map((report) => (
              <div className="flex items-center justify-between gap-3 py-3 text-sm" key={report.id}>
                <div>
                  <p className="font-medium">{dateTime(report.cutoffAt, locale, timeZone)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{report.orderCount} orders · {report.paymentBreakdown.length} methods</p>
                  <p className="mt-1 text-xs text-muted-foreground">{report.taxAmount === null ? copy.taxUnavailable : `${copy.taxableAmount}: ${money(report.taxableAmount, report.currency, locale)} · ${copy.taxAmount}: ${money(report.taxAmount, report.currency, locale)}`}</p>
                  <Button className="mt-2" onClick={() => downloadZReport(report, copy)} size="sm" type="button" variant="outline">{copy.exportCsv}</Button>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{money(report.netSales, report.currency, locale)}</p>
                  <p className={`mt-1 text-xs ${Number(report.variance) === 0 ? "text-muted-foreground" : "text-destructive"}`}>Δ {money(report.variance, report.currency, locale)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 border-t pt-4 text-sm text-muted-foreground">{copy.noReports}</p>
        )}
      </section>

      <Dialog
        onOpenChange={(open) => {
          if (!open && !busy) setPendingAction(null);
        }}
        open={pendingAction === "close_register"}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {personalCash
                ? copy.confirmClosePersonalCashTitle
                : copy.confirmCloseTitle}
            </DialogTitle>
            <DialogDescription>
              {personalCash
                ? copy.confirmClosePersonalCashDescription
                : copy.confirmCloseDescription}
            </DialogDescription>
          </DialogHeader>
          {trackedCash ? (
            <dl className="grid gap-2 rounded-md bg-muted/45 px-3 py-2.5 text-sm">
              {/*
                Expected cash and the variance are only shown when the shift
                reconciliation actually loaded. Treating a missing one as zero
                would print a variance equal to the whole drawer, in red, on
                the screen where the cashier decides whether the till
                balances -- a discrepancy invented by the UI.
              */}
              {reconciliation ? (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">
                    {copy.confirmExpectedCash}
                  </dt>
                  <dd className="font-medium">
                    {money(reconciliation.expectedCash, currency, locale)}
                  </dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">
                  {copy.confirmCountedCash}
                </dt>
                <dd className="font-medium">
                  {countedCash.trim()
                    ? money(countedCash, currency, locale)
                    : copy.confirmNotEntered}
                </dd>
              </div>
              {reconciliation && countedCash.trim() ? (
                <div className="flex items-center justify-between gap-3 border-t pt-2">
                  <dt className="text-muted-foreground">
                    {copy.confirmVariance}
                  </dt>
                  <dd
                    className={
                      Number(countedCash) - Number(reconciliation.expectedCash) ===
                      0
                        ? "font-semibold"
                        : "font-semibold text-destructive"
                    }
                  >
                    {money(
                      Number(countedCash) - Number(reconciliation.expectedCash),
                      currency,
                      locale,
                    )}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          <DialogFooter>
            <Button
              disabled={busy}
              onClick={() => setPendingAction(null)}
              type="button"
              variant="outline"
            >
              {copy.confirmCancel}
            </Button>
            <Button
              disabled={busy}
              onClick={() => void closeRegister()}
              type="button"
              variant="destructive"
            >
              {busy ? copy.closing : copy.confirmClose}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open && !busy) setPendingAction(null);
        }}
        open={pendingAction === "clock_out"}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{copy.confirmClockOutTitle}</DialogTitle>
            <DialogDescription>
              {copy.confirmClockOutDescription}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={busy}
              onClick={() => setPendingAction(null)}
              type="button"
              variant="outline"
            >
              {copy.confirmCancel}
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                setPendingAction(null);
                void clock("clock_out");
              }}
              type="button"
              variant="destructive"
            >
              {copy.confirmClockOut}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
