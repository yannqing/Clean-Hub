"use client";

import type { TranslationKey } from "@cleanhub/i18n";
import { useTranslation } from "@cleanhub/i18n/react";
import {
  Badge,
  Button,
  Label,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Textarea,
} from "@cleanhub/ui";
import {
  AlertTriangle,
  Camera,
  Clock3,
  FileText,
  Loader2,
  MapPin,
  Navigation,
  PackageCheck,
  PenLine,
  Phone,
  Printer,
  ReceiptText,
  RefreshCw,
} from "lucide-react";

import { formatTenantMoney } from "@/lib/currency";

import type {
  DeliveryPrintDocument,
  DeliveryPrinterState,
} from "../lib/printing";
import type {
  DeliveryProofType,
  DeliveryTaskDetail,
  DeliveryTaskStatus,
} from "../types";

export type DeliveryPrimaryTaskAction =
  | {
      kind: "status";
      status: DeliveryTaskStatus;
      labelKey: TranslationKey;
    }
  | {
      kind: "signature";
      labelKey: TranslationKey;
    };

type DeliveryTaskDetailSheetProps = {
  activeAction: string | null;
  intlLocale: string;
  notScheduledLabel: string;
  open: boolean;
  primaryTaskAction: DeliveryPrimaryTaskAction | null;
  printer: DeliveryPrinterState;
  printerConnectionRequired: boolean;
  proofTypeLabelKeys: Record<DeliveryProofType, TranslationKey>;
  selectedTask: DeliveryTaskDetail | null;
  selectedTaskCanReportException: boolean;
  selectedTaskCanUploadProof: boolean;
  selectedTaskCanUsePrinter: boolean;
  selectedTaskPendingCount: number;
  selectedTaskProofImages: DeliveryTaskDetail["proofs"];
  selectedTaskSecondaryActionCount: number;
  selectedTaskTerminalMessageKey: TranslationKey | null;
  statusLabelKeys: Record<DeliveryTaskStatus, TranslationKey>;
  statusNote: string;
  statusTone: Record<DeliveryTaskStatus, string>;
  tenantCurrency: string;
  onConnectPrinter: () => void;
  onOpenChange: (open: boolean) => void;
  onOpenExceptionSheet: () => void;
  onOpenProofSheet: (task: DeliveryTaskDetail) => void;
  onPrintDocument: (document: DeliveryPrintDocument) => void;
  onPrimaryStatusUpdate: (status: DeliveryTaskStatus) => void;
  onRequestSignature: () => void;
  onStatusNoteChange: (value: string) => void;
};

function formatDateTime(
  value: string | null,
  locale: string,
  emptyLabel: string,
): string {
  if (!value) {
    return emptyLabel;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function DeliveryTaskDetailSheet({
  activeAction,
  intlLocale,
  notScheduledLabel,
  open,
  primaryTaskAction,
  printer,
  printerConnectionRequired,
  proofTypeLabelKeys,
  selectedTask,
  selectedTaskCanReportException,
  selectedTaskCanUploadProof,
  selectedTaskCanUsePrinter,
  selectedTaskPendingCount,
  selectedTaskProofImages,
  selectedTaskSecondaryActionCount,
  selectedTaskTerminalMessageKey,
  statusLabelKeys,
  statusNote,
  statusTone,
  tenantCurrency,
  onConnectPrinter,
  onOpenChange,
  onOpenExceptionSheet,
  onOpenProofSheet,
  onPrintDocument,
  onPrimaryStatusUpdate,
  onRequestSignature,
  onStatusNoteChange,
}: DeliveryTaskDetailSheetProps) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="h-[92dvh] rounded-t-md p-0">
        {selectedTask ? (
          <div className="flex h-full flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-4 pt-2">
              <SheetHeader className="pr-8 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusTone[selectedTask.status]}`}
                  >
                    {t(statusLabelKeys[selectedTask.status])}
                  </span>
                  {selectedTaskPendingCount > 0 ? (
                    <Badge className="bg-amber-100 text-amber-900" variant="secondary">
                      {t("delivery.pendingSync", { count: selectedTaskPendingCount })}
                    </Badge>
                  ) : null}
                </div>
                <SheetTitle>{selectedTask.customerName}</SheetTitle>
                <SheetDescription>
                  {formatDateTime(
                    selectedTask.expectedAt,
                    intlLocale,
                    notScheduledLabel,
                  )}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <Clock3 className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />
                  <span className="text-slate-700">
                    {formatDateTime(
                      selectedTask.expectedAt,
                      intlLocale,
                      notScheduledLabel,
                    )}
                  </span>
                </div>
                <div className="flex gap-3">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />
                  <span className="text-slate-700">{selectedTask.address}</span>
                </div>
                {selectedTask.customerPhone ? (
                  <a
                    className="flex gap-3 text-sm text-blue-700"
                    href={`tel:${selectedTask.customerPhone}`}
                  >
                    <Phone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>{selectedTask.customerPhone}</span>
                  </a>
                ) : null}
                {selectedTask.notes ? (
                  <div className="flex gap-3">
                    <FileText className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />
                    <span className="text-slate-700">{selectedTask.notes}</span>
                  </div>
                ) : null}
              </div>

              <dl className="grid grid-cols-2 gap-3">
                <div className="rounded-md bg-slate-50 p-3">
                  <dt className="text-xs font-medium text-slate-500">
                    {t("delivery.order")}
                  </dt>
                  <dd className="mt-1 truncate text-sm font-semibold text-slate-950">
                    {selectedTask.order?.id ?? selectedTask.orderId ?? "-"}
                  </dd>
                  {selectedTask.order ? (
                    <p className="mt-1 text-xs text-slate-600">
                      {selectedTask.order.status}
                      {" \u00b7 "}
                      {formatTenantMoney(
                        selectedTask.order.totalAmount,
                        intlLocale,
                        tenantCurrency,
                      )}
                    </p>
                  ) : null}
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <dt className="text-xs font-medium text-slate-500">
                    {t("delivery.ticket")}
                  </dt>
                  <dd className="mt-1 truncate text-sm font-semibold text-slate-950">
                    {selectedTask.ticket?.ticketNo ?? selectedTask.ticketId ?? "-"}
                  </dd>
                  {selectedTask.ticket ? (
                    <p className="mt-1 text-xs text-slate-600">
                      {selectedTask.ticket.ticketStatus}
                    </p>
                  ) : null}
                </div>
              </dl>

              {selectedTaskProofImages.length > 0 ? (
                <section className="space-y-3 rounded-md border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-950">
                      {t("delivery.proof.savedTitle")}
                    </h3>
                    <span className="text-xs text-slate-500">
                      {t("delivery.proof.savedCount", {
                        count: selectedTaskProofImages.length,
                      })}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedTaskProofImages.map((proof) => (
                      <a
                        className="group overflow-hidden rounded-md border border-slate-200 bg-slate-50"
                        href={proof.mediaUrl}
                        key={proof.id}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- Proof URLs are short-lived private media links. */}
                        <img
                          alt={t(proofTypeLabelKeys[proof.type])}
                          className="aspect-[4/3] w-full object-cover transition group-active:scale-[0.98]"
                          src={proof.mediaUrl}
                        />
                        <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs text-slate-600">
                          <span>{t(proofTypeLabelKeys[proof.type])}</span>
                          <span>
                            {formatDateTime(
                              proof.capturedAt ?? proof.createdAt,
                              intlLocale,
                              notScheduledLabel,
                            )}
                          </span>
                        </div>
                      </a>
                    ))}
                  </div>
                </section>
              ) : null}

              {selectedTaskCanUsePrinter ? (
                <section className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white text-blue-700">
                        <Printer className="size-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-950">
                          {t("delivery.printer.title")}
                        </p>
                        <p className="truncate text-xs text-slate-600">
                          {printer.device?.name ??
                            printer.device?.id ??
                            (printer.status === "unavailable"
                              ? t("delivery.printer.unavailable")
                              : t("delivery.printer.notConnected"))}
                        </p>
                      </div>
                    </div>
                    <Button
                      aria-label={t("delivery.printer.connect")}
                      className="size-10 shrink-0 p-0"
                      disabled={Boolean(activeAction)}
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={onConnectPrinter}
                    >
                      {activeAction === "printer-connect" ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <RefreshCw className="size-4" aria-hidden="true" />
                      )}
                    </Button>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      className="h-11"
                      disabled={
                        Boolean(activeAction) ||
                        (printerConnectionRequired && !printer.device)
                      }
                      type="button"
                      variant="secondary"
                      onClick={() => onPrintDocument("receipt")}
                    >
                      {activeAction === "print-receipt" ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <ReceiptText className="size-4" aria-hidden="true" />
                      )}
                      {t("delivery.printer.receipt")}
                    </Button>
                    <Button
                      className="h-11"
                      disabled={
                        Boolean(activeAction) ||
                        (printerConnectionRequired && !printer.device)
                      }
                      type="button"
                      variant="secondary"
                      onClick={() => onPrintDocument("label")}
                    >
                      {activeAction === "print-label" ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <PackageCheck className="size-4" aria-hidden="true" />
                      )}
                      {t("delivery.printer.label")}
                    </Button>
                  </div>
                </section>
              ) : null}

              <div
                className={`grid gap-2 ${
                  selectedTaskSecondaryActionCount > 1 ? "grid-cols-2" : "grid-cols-1"
                }`}
              >
                {selectedTaskCanUploadProof ? (
                  <Button
                    className="h-12"
                    type="button"
                    variant="outline"
                    onClick={() => onOpenProofSheet(selectedTask)}
                  >
                    <Camera className="size-4" aria-hidden="true" />
                    {t("delivery.proof.title")}
                  </Button>
                ) : null}
                {selectedTaskCanReportException ? (
                  <Button
                    className="h-12"
                    type="button"
                    variant="outline"
                    onClick={onOpenExceptionSheet}
                  >
                    <AlertTriangle className="size-4" aria-hidden="true" />
                    {t("delivery.exception.title")}
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="sticky bottom-0 mt-auto space-y-3 border-t border-slate-200 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                  <Navigation className="size-4" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    {t("delivery.workflow.title")}
                  </p>
                  <p className="text-xs text-slate-600">
                    {t(statusLabelKeys[selectedTask.status])}
                  </p>
                </div>
              </div>

              {selectedTaskTerminalMessageKey ? (
                <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                  {t(selectedTaskTerminalMessageKey)}
                </p>
              ) : null}

              {primaryTaskAction?.kind === "status" ? (
                <div className="space-y-2">
                  <Label htmlFor="status-note">{t("common.note")}</Label>
                  <Textarea
                    className="min-h-16 text-base"
                    id="status-note"
                    placeholder={t("common.optional")}
                    value={statusNote}
                    onChange={(event) => onStatusNoteChange(event.target.value)}
                  />
                </div>
              ) : null}

              {primaryTaskAction ? (
                <div>
                  <Button
                    className="h-12 w-full"
                    disabled={Boolean(activeAction)}
                    type="button"
                    onClick={() => {
                      if (primaryTaskAction.kind === "signature") {
                        onRequestSignature();
                        return;
                      }

                      onPrimaryStatusUpdate(primaryTaskAction.status);
                    }}
                  >
                    {primaryTaskAction.kind === "status" &&
                    activeAction === `status-${primaryTaskAction.status}` ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : primaryTaskAction.kind === "signature" ? (
                      <PenLine className="size-4" aria-hidden="true" />
                    ) : (
                      <MapPin className="size-4" aria-hidden="true" />
                    )}
                    {t(primaryTaskAction.labelKey)}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex min-h-[50dvh] items-center justify-center px-5 text-sm text-slate-600">
            <Loader2 className="mr-2 size-4 animate-spin text-blue-600" aria-hidden="true" />
            {t("delivery.detailLoading")}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
