"use client";

import { formatPosOrderCode } from "@cleanhub/domain/order-codes";
import type {
  ServiceSummary,
  TenantOrderDetail,
  TenantOrderItem,
  TenantOrderTimelineResponse,
  TenantUserSummary,
} from "@cleanhub/api-client";
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Icon,
  Input,
  Textarea,
  toast,
} from "@cleanhub/ui";
import {
  Ban,
  Banknote,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  FileText,
  LoaderCircle,
  PackageOpen,
  Pencil,
  Plus,
  Printer,
  ReceiptText,
  RotateCcw,
  Shirt,
  ShoppingBag,
  Smartphone,
  Store,
  Trash2,
  Undo2,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { interpolate, useTenantI18n } from "@/i18n";
import { formatMoney } from "@/lib/format";

import {
  changeTenantOrderStatusAction,
  createTenantOrderPaymentAction,
} from "../actions";

import {
  getOrderPaymentTone,
  getOrderWorkflowTone,
  OrderStatusPill,
} from "./order-status-pill";
import { TenantOrderTimeline } from "./tenant-order-timeline";
import {
  type PaymentAdjustmentTarget,
  TenantOrderItemDeleteDialog,
  TenantOrderItemEditorDialog,
  TenantOrderPaymentAdjustmentDialog,
} from "./tenant-order-operation-dialogs";

function formatOrderMoney(
  value: string,
  currency: string,
  locale: string,
): string {
  const amount = Number(value);
  return formatMoney(Number.isFinite(amount) ? amount : 0, currency, locale);
}

function formatItemQuantity(item: TenantOrderItem, locale: string): string {
  const value = item.pricingUnit === "per_kg" ? item.weight : item.quantity;
  const quantity = Number(value ?? 0);
  const formatted = Number.isFinite(quantity)
    ? quantity.toLocaleString(locale, { maximumFractionDigits: 3 })
    : (value ?? "0");

  if (item.pricingUnit === "per_kg") {
    return `${formatted} kg`;
  }

  return item.unitOfMeasure ? `${formatted} ${item.unitOfMeasure}` : formatted;
}

function ItemVisual({ item }: { item: TenantOrderItem }) {
  return (
    <div className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/60 text-muted-foreground">
      <Icon
        aria-hidden
        icon={item.itemKind === "product" ? PackageOpen : Shirt}
        size={21}
      />
      {item.itemColor ? (
        <span
          aria-hidden
          className="absolute bottom-1 right-1 size-3 rounded-full border-2 border-background shadow-sm"
          style={{ backgroundColor: item.itemColor }}
        />
      ) : null}
    </div>
  );
}

function getPaymentTransactionTone(status: string) {
  if (status === "paid") return "success" as const;
  if (status === "pending") return "warning" as const;
  if (status === "refunded") return "purple" as const;
  return "danger" as const;
}

export function TenantOrderDetailView({
  branchName,
  initialTimeline,
  order,
  services,
  staffMembers,
}: {
  branchName?: string;
  initialTimeline: TenantOrderTimelineResponse;
  order: TenantOrderDetail;
  services: ServiceSummary[];
  staffMembers: TenantUserSummary[];
}) {
  const { formatDateTime, locale, m } = useTenantI18n();
  const router = useRouter();
  const orderCode = formatPosOrderCode(order.id);
  const displayBranchName = branchName ?? order.branchId;
  const balance = Math.max(
    0,
    Number(order.totalAmount) - Number(order.paidAmount),
  ).toFixed(2);
  const itemCount = order.items.length;
  const [statusAction, setStatusAction] = useState<
    "received" | "delivered" | "cancelled" | null
  >(null);
  const [statusNote, setStatusNote] = useState("");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(balance);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [itemEditorOpen, setItemEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TenantOrderItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<TenantOrderItem | null>(
    null,
  );
  const [paymentAdjustment, setPaymentAdjustment] =
    useState<PaymentAdjustmentTarget | null>(null);

  function openPaymentDialog() {
    setPaymentAmount(balance);
    setPaymentDialogOpen(true);
  }

  async function submitStatusAction() {
    if (!statusAction || submittingAction) return;
    const normalizedNote = statusNote.trim();
    if (statusAction === "cancelled" && !normalizedNote) return;

    setSubmittingAction(true);
    try {
      const result = await changeTenantOrderStatusAction(order.id, {
        to: statusAction,
        version: order.version,
        ...(statusAction === "cancelled"
          ? { reason: normalizedNote }
          : normalizedNote
            ? { note: normalizedNote }
            : {}),
      });
      if (!result.ok) {
        toast.error(result.message || m.orders.detail.actions.statusError);
        return;
      }
      toast.success(m.orders.detail.actions.statusSuccess);
      setStatusAction(null);
      setStatusNote("");
      router.refresh();
    } catch {
      toast.error(m.orders.detail.actions.statusError);
    } finally {
      setSubmittingAction(false);
    }
  }

  async function submitPayment() {
    const amount = Number(paymentAmount);
    const balanceAmount = Number(balance);
    if (
      submittingAction ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > balanceAmount
    ) {
      return;
    }

    setSubmittingAction(true);
    try {
      const result = await createTenantOrderPaymentAction(order.id, {
        paymentMethod: "cash",
        amount: amount.toFixed(2),
        idempotencyKey: crypto.randomUUID(),
      });
      if (!result.ok) {
        toast.error(result.message || m.orders.detail.actions.paymentError);
        return;
      }
      toast.success(m.orders.detail.actions.paymentSuccess);
      setPaymentDialogOpen(false);
      router.refresh();
    } catch {
      toast.error(m.orders.detail.actions.paymentError);
    } finally {
      setSubmittingAction(false);
    }
  }

  return (
    <section
      className="mx-auto w-full max-w-[1120px] space-y-5 pb-20 print:max-w-none"
      data-testid="tenant-order-detail-view"
    >
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <nav aria-label={m.orders.detail.breadcrumbLabel}>
            <ol className="flex min-w-0 items-center gap-2 text-sm">
              <li>
                <Link
                  aria-label={m.orders.detail.backToOrders}
                  className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  href={webAdminRoutes.tenant.orders}
                  title={m.orders.title}
                >
                  <Icon aria-hidden icon={ShoppingBag} size={16} />
                </Link>
              </li>
              <li aria-hidden className="text-muted-foreground">
                <Icon aria-hidden icon={ChevronRight} size={14} />
              </li>
              <li className="min-w-0 text-muted-foreground">
                {m.orders.title}
              </li>
            </ol>
          </nav>

          <div className="flex flex-wrap justify-end gap-2 print:hidden">
            {order.capabilities.canRecordPayment ? (
              <Button onClick={openPaymentDialog} size="sm" type="button">
                <Icon aria-hidden icon={CircleDollarSign} size={15} />
                {m.orders.detail.actions.recordPayment}
              </Button>
            ) : null}
            {order.capabilities.allowedNextStatuses.includes("received") ? (
              <Button
                onClick={() => setStatusAction("received")}
                size="sm"
                type="button"
                variant="outline"
              >
                {m.orders.detail.actions.markReceived}
              </Button>
            ) : null}
            {order.capabilities.canMarkDelivered ? (
              <Button
                onClick={() => setStatusAction("delivered")}
                size="sm"
                type="button"
                variant="outline"
              >
                {m.orders.detail.actions.markDelivered}
              </Button>
            ) : null}
            {order.capabilities.canCancel ? (
              <Button
                className="text-destructive hover:text-destructive"
                onClick={() => setStatusAction("cancelled")}
                size="sm"
                type="button"
                variant="outline"
              >
                <Icon aria-hidden icon={Ban} size={15} />
                {m.orders.detail.actions.cancelOrder}
              </Button>
            ) : null}
            <Button
              onClick={() => window.print()}
              size="sm"
              type="button"
              variant="outline"
            >
              <Icon aria-hidden icon={Printer} size={15} />
              {m.orders.detail.printAction}
            </Button>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight">
                {orderCode}
              </h1>
              <OrderStatusPill
                label={m.orders.detail.workflowStatusLabels[order.status]}
                tone={getOrderWorkflowTone(order.status)}
              />
              <OrderStatusPill
                icon={CircleDollarSign}
                label={m.orders.paymentStatusLabels[order.paymentStatus]}
                tone={getOrderPaymentTone(order.paymentStatus)}
              />
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {interpolate(m.orders.detail.createdMeta, {
                branch: displayBranchName,
                date: formatDateTime(order.createdAt),
                type: m.orders.typeLabels[order.orderType],
              })}
            </p>
          </div>
        </div>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main className="grid min-w-0 gap-4">
          <Card className="gap-0 overflow-hidden rounded-xl py-0 shadow-none">
            <CardContent className="p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/25 px-5 py-4">
                <div>
                  <h2 className="text-sm font-semibold">
                    {m.orders.detail.workflowTitle}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {interpolate(m.orders.detail.itemCount, {
                      count: itemCount.toLocaleString(locale),
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {order.capabilities.canEdit ? (
                    <Button
                      onClick={() => {
                        setEditingItem(null);
                        setItemEditorOpen(true);
                      }}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Icon aria-hidden icon={Plus} size={15} />
                      {m.orders.detail.itemEditor.addAction}
                    </Button>
                  ) : null}
                  <OrderStatusPill
                    label={m.orders.detail.workflowStatusLabels[order.status]}
                    tone={getOrderWorkflowTone(order.status)}
                  />
                </div>
              </div>

              <div className="divide-y">
                {order.items.map((item) => {
                  const compactMetadata = [
                    item.variantName,
                    item.sku,
                    item.itemIdentifier,
                  ].filter(Boolean);
                  const operationalDetails = [
                    item.itemColor
                      ? [m.orders.detail.itemColor, item.itemColor]
                      : null,
                    item.itemIdentifier
                      ? [m.orders.detail.itemIdentifier, item.itemIdentifier]
                      : null,
                    item.defectNotes
                      ? [m.orders.detail.defectNotes, item.defectNotes]
                      : null,
                    item.specialRequest
                      ? [m.orders.detail.specialRequest, item.specialRequest]
                      : null,
                  ].filter(
                    (detail): detail is [string, string] => detail !== null,
                  );

                  return (
                    <article className="p-5" key={item.id}>
                      <div className="flex items-start gap-3">
                        <ItemVisual item={item} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-semibold">
                                {item.itemName}
                              </h3>
                              {compactMetadata.length > 0 ? (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {compactMetadata.join(" · ")}
                                </p>
                              ) : null}
                            </div>
                            <div className="shrink-0 text-left sm:text-right">
                              <p className="text-sm font-semibold">
                                {formatOrderMoney(
                                  item.lineAmount,
                                  order.currency,
                                  locale,
                                )}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {formatOrderMoney(
                                  item.chargedUnitAmount,
                                  order.currency,
                                  locale,
                                )}{" "}
                                × {formatItemQuantity(item, locale)}
                              </p>
                              {order.capabilities.canEdit ? (
                                <div className="mt-2 flex gap-1 sm:justify-end">
                                  <Button
                                    aria-label={
                                      m.orders.detail.itemEditor.editAction
                                    }
                                    onClick={() => {
                                      setEditingItem(item);
                                      setItemEditorOpen(true);
                                    }}
                                    size="icon-sm"
                                    title={
                                      m.orders.detail.itemEditor.editAction
                                    }
                                    type="button"
                                    variant="ghost"
                                  >
                                    <Icon aria-hidden icon={Pencil} size={14} />
                                  </Button>
                                  <Button
                                    aria-label={
                                      m.orders.detail.itemEditor.deleteAction
                                    }
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => setDeletingItem(item)}
                                    size="icon-sm"
                                    title={
                                      m.orders.detail.itemEditor.deleteAction
                                    }
                                    type="button"
                                    variant="ghost"
                                  >
                                    <Icon aria-hidden icon={Trash2} size={14} />
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          </div>

                          {operationalDetails.length > 0 ? (
                            <dl className="mt-3 grid gap-2 rounded-lg bg-muted/35 p-3 text-xs sm:grid-cols-2">
                              {operationalDetails.map(([label, value]) => (
                                <div
                                  className="min-w-0"
                                  key={`${label}-${value}`}
                                >
                                  <dt className="text-muted-foreground">
                                    {label}
                                  </dt>
                                  <dd className="mt-0.5 break-words font-medium">
                                    {value}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 overflow-hidden rounded-xl py-0 shadow-none">
            <CardContent className="p-0">
              <div className="flex items-center justify-between gap-3 border-b bg-muted/25 px-5 py-4">
                <h2 className="text-sm font-semibold">
                  {m.orders.detail.paymentTitle}
                </h2>
                <OrderStatusPill
                  icon={ReceiptText}
                  label={m.orders.paymentStatusLabels[order.paymentStatus]}
                  tone={getOrderPaymentTone(order.paymentStatus)}
                />
              </div>

              <div className="p-5">
                <dl className="divide-y rounded-lg border text-sm">
                  <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-3">
                    <dt>{m.orders.detail.subtotal}</dt>
                    <dd className="text-muted-foreground">
                      {interpolate(m.orders.detail.itemCount, {
                        count: itemCount.toLocaleString(locale),
                      })}
                    </dd>
                    <dd>
                      {formatOrderMoney(
                        order.subtotalAmount,
                        order.currency,
                        locale,
                      )}
                    </dd>
                  </div>
                  {order.discountApplications.map((discount) => (
                    <div
                      className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3 text-violet-700 dark:text-violet-300"
                      key={discount.id}
                    >
                      <dt>
                        {discount.title}
                        {discount.code ? ` · ${discount.code}` : ""}
                      </dt>
                      <dd>
                        −
                        {formatOrderMoney(
                          discount.amount,
                          order.currency,
                          locale,
                        )}
                      </dd>
                    </div>
                  ))}
                  {order.discountApplications.length === 0 &&
                  Number(order.discountAmount) > 0 ? (
                    <div className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3">
                      <dt>{m.orders.detail.discount}</dt>
                      <dd>
                        −
                        {formatOrderMoney(
                          order.discountAmount,
                          order.currency,
                          locale,
                        )}
                      </dd>
                    </div>
                  ) : null}
                  <div className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3 font-semibold">
                    <dt>{m.orders.detail.total}</dt>
                    <dd>
                      {formatOrderMoney(
                        order.totalAmount,
                        order.currency,
                        locale,
                      )}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3">
                    <dt>{m.orders.detail.paid}</dt>
                    <dd>
                      {formatOrderMoney(
                        order.paidAmount,
                        order.currency,
                        locale,
                      )}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3 font-semibold">
                    <dt>{m.orders.detail.balance}</dt>
                    <dd>{formatOrderMoney(balance, order.currency, locale)}</dd>
                  </div>
                </dl>

                <div className="mt-6">
                  <h3 className="text-sm font-semibold">
                    {m.orders.detail.paymentTransactionsTitle}
                  </h3>
                  {order.payments.length === 0 ? (
                    <p className="mt-3 rounded-lg border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">
                      {m.orders.detail.paymentTransactionsEmpty}
                    </p>
                  ) : (
                    <ol className="mt-3 divide-y rounded-lg border">
                      {order.payments.map((payment) => {
                        const methodIcon =
                          payment.paymentMethod === "cash"
                            ? Banknote
                            : payment.paymentMethod === "card"
                              ? CreditCard
                              : Smartphone;
                        const methodLabel =
                          m.orders.detail.paymentMethodLabels[
                            payment.paymentMethod
                          ];
                        const providerLabel = payment.provider
                          ? m.orders.detail.paymentProviderLabels[
                              payment.provider
                            ]
                          : null;

                        return (
                          <li
                            className="flex flex-col justify-between gap-3 px-4 py-3 sm:flex-row sm:items-center"
                            key={payment.id}
                          >
                            <div className="flex min-w-0 items-start gap-3">
                              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                <Icon aria-hidden icon={methodIcon} size={17} />
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-medium">
                                  {providerLabel
                                    ? `${methodLabel} · ${providerLabel}`
                                    : methodLabel}
                                </p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {formatDateTime(
                                    payment.paidAt ?? payment.createdAt,
                                  )}
                                </p>
                                {payment.externalReference ? (
                                  <p className="mt-1 truncate text-xs text-muted-foreground">
                                    {m.orders.detail.paymentReference}:{" "}
                                    {payment.externalReference}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-1.5">
                              <p className="text-sm font-semibold">
                                {formatOrderMoney(
                                  payment.amount,
                                  payment.currency,
                                  locale,
                                )}
                              </p>
                              <OrderStatusPill
                                label={
                                  m.orders.detail
                                    .paymentTransactionStatusLabels[
                                    payment.paymentStatus
                                  ]
                                }
                                tone={getPaymentTransactionTone(
                                  payment.paymentStatus,
                                )}
                              />
                              {payment.paymentStatus === "paid" &&
                              (order.capabilities.canRefundPayments ||
                                order.capabilities.canCorrectPayments) ? (
                                <div className="flex flex-wrap justify-end gap-1">
                                  {order.capabilities.canRefundPayments &&
                                  Math.min(
                                    Number(payment.amount) -
                                      order.paymentAdjustments
                                        .filter(
                                          (adjustment) =>
                                            adjustment.adjustmentType ===
                                              "refund" &&
                                            adjustment.direction === "debit" &&
                                            adjustment.originalPaymentId ===
                                              payment.id,
                                        )
                                        .reduce(
                                          (total, adjustment) =>
                                            total + Number(adjustment.amount),
                                          0,
                                        ),
                                    Number(order.paidAmount),
                                  ) > 0 ? (
                                    <Button
                                      onClick={() =>
                                        setPaymentAdjustment({
                                          mode: "refund",
                                          payment,
                                        })
                                      }
                                      size="xs"
                                      type="button"
                                      variant="outline"
                                    >
                                      <Icon
                                        aria-hidden
                                        icon={Undo2}
                                        size={13}
                                      />
                                      {
                                        m.orders.detail.paymentAdjustments
                                          .refundAction
                                      }
                                    </Button>
                                  ) : null}
                                  {order.capabilities.canCorrectPayments ? (
                                    <Button
                                      onClick={() =>
                                        setPaymentAdjustment({
                                          mode: "correction",
                                          payment,
                                        })
                                      }
                                      size="xs"
                                      type="button"
                                      variant="ghost"
                                    >
                                      <Icon
                                        aria-hidden
                                        icon={RotateCcw}
                                        size={13}
                                      />
                                      {
                                        m.orders.detail.paymentAdjustments
                                          .correctionAction
                                      }
                                    </Button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>

                {order.paymentAdjustments.length > 0 ? (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold">
                      {m.orders.detail.paymentAdjustments.historyTitle}
                    </h3>
                    <ol className="mt-3 divide-y rounded-lg border">
                      {order.paymentAdjustments.map((adjustment) => (
                        <li
                          className="flex flex-col justify-between gap-3 px-4 py-3 sm:flex-row sm:items-center"
                          key={adjustment.id}
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <OrderStatusPill
                                label={
                                  m.orders.detail.paymentAdjustments.typeLabels[
                                    adjustment.adjustmentType
                                  ]
                                }
                                tone={
                                  adjustment.adjustmentType === "refund"
                                    ? "purple"
                                    : "warning"
                                }
                              />
                              <span className="text-xs text-muted-foreground">
                                {formatDateTime(adjustment.occurredAt)}
                              </span>
                            </div>
                            <p className="mt-2 break-words text-sm">
                              {adjustment.reason}
                            </p>
                          </div>
                          <p
                            className={
                              adjustment.direction === "debit"
                                ? "shrink-0 text-sm font-semibold text-destructive"
                                : "shrink-0 text-sm font-semibold text-emerald-700 dark:text-emerald-300"
                            }
                          >
                            {adjustment.direction === "debit" ? "−" : "+"}
                            {formatOrderMoney(
                              adjustment.amount,
                              adjustment.currency,
                              locale,
                            )}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <TenantOrderTimeline
            initialTimeline={initialTimeline}
            key={order.version}
            orderId={order.id}
            staffMembers={staffMembers}
          />
        </main>

        <aside className="grid gap-4">
          <Card className="gap-0 rounded-xl py-0 shadow-none">
            <CardContent className="py-5">
              <div className="flex items-center gap-2">
                <Icon aria-hidden icon={UserRound} size={17} />
                <h2 className="text-sm font-semibold">
                  {m.orders.detail.customerTitle}
                </h2>
              </div>
              <p className="mt-4 text-sm font-semibold">
                {order.customerName || m.orders.unknownCustomer}
              </p>
              <p className="mt-1 break-all text-xs text-muted-foreground">
                {order.customerId}
              </p>
            </CardContent>
          </Card>

          <Card className="gap-0 rounded-xl py-0 shadow-none">
            <CardContent className="py-5">
              <div className="flex items-center gap-2">
                <Icon aria-hidden icon={FileText} size={17} />
                <h2 className="text-sm font-semibold">
                  {m.orders.detail.notesTitle}
                </h2>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                {order.notes || m.orders.detail.notProvided}
              </p>
            </CardContent>
          </Card>

          <Card className="gap-0 rounded-xl py-0 shadow-none">
            <CardContent className="py-5">
              <div className="flex items-center gap-2">
                <Icon aria-hidden icon={Store} size={17} />
                <h2 className="text-sm font-semibold">
                  {m.orders.detail.orderDetailsTitle}
                </h2>
              </div>
              <dl className="mt-4 space-y-4 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {m.orders.columns.branch}
                  </dt>
                  <dd className="mt-1 font-medium">{displayBranchName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {m.orders.columns.type}
                  </dt>
                  <dd className="mt-1 font-medium">
                    {m.orders.typeLabels[order.orderType]}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {m.orders.columns.createdAt}
                  </dt>
                  <dd className="mt-1 font-medium">
                    {formatDateTime(order.createdAt)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Dialog
        onOpenChange={(open) => {
          if (!open && !submittingAction) {
            setStatusAction(null);
            setStatusNote("");
          }
        }}
        open={statusAction !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {statusAction
                ? m.orders.detail.actions.dialogTitles[statusAction]
                : ""}
            </DialogTitle>
            <DialogDescription>
              {statusAction
                ? m.orders.detail.actions.dialogDescriptions[statusAction]
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="order-status-note">
              {statusAction === "cancelled"
                ? m.orders.detail.actions.reasonLabel
                : m.orders.detail.actions.noteLabel}
            </label>
            <Textarea
              disabled={submittingAction}
              id="order-status-note"
              maxLength={statusAction === "cancelled" ? 500 : 2000}
              onChange={(event) => setStatusNote(event.target.value)}
              placeholder={m.orders.detail.actions.notePlaceholder}
              value={statusNote}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={submittingAction}
              onClick={() => setStatusAction(null)}
              type="button"
              variant="outline"
            >
              {m.common.cancel}
            </Button>
            <Button
              disabled={
                submittingAction ||
                (statusAction === "cancelled" && !statusNote.trim())
              }
              onClick={submitStatusAction}
              type="button"
              variant={statusAction === "cancelled" ? "destructive" : "default"}
            >
              {submittingAction ? (
                <Icon
                  aria-hidden
                  className="animate-spin"
                  icon={LoaderCircle}
                  size={15}
                />
              ) : null}
              {submittingAction
                ? m.orders.detail.actions.submitting
                : m.orders.detail.actions.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!submittingAction) setPaymentDialogOpen(open);
        }}
        open={paymentDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m.orders.detail.actions.paymentTitle}</DialogTitle>
            <DialogDescription>
              {m.orders.detail.actions.paymentDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="payment-amount">
              {m.orders.detail.actions.amountLabel}
            </label>
            <div className="relative">
              <Input
                disabled={submittingAction}
                id="payment-amount"
                inputMode="decimal"
                max={balance}
                min="0.01"
                onChange={(event) => setPaymentAmount(event.target.value)}
                step="0.01"
                type="number"
                value={paymentAmount}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {order.currency}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {interpolate(m.orders.detail.actions.balanceHint, {
                amount: formatOrderMoney(balance, order.currency, locale),
              })}
            </p>
          </div>
          <DialogFooter>
            <Button
              disabled={submittingAction}
              onClick={() => setPaymentDialogOpen(false)}
              type="button"
              variant="outline"
            >
              {m.common.cancel}
            </Button>
            <Button
              disabled={
                submittingAction ||
                Number(paymentAmount) <= 0 ||
                Number(paymentAmount) > Number(balance)
              }
              onClick={submitPayment}
              type="button"
            >
              {submittingAction ? (
                <Icon
                  aria-hidden
                  className="animate-spin"
                  icon={LoaderCircle}
                  size={15}
                />
              ) : null}
              {submittingAction
                ? m.orders.detail.actions.submitting
                : m.orders.detail.actions.recordPayment}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {itemEditorOpen ? (
        <TenantOrderItemEditorDialog
          item={editingItem}
          onOpenChange={(open) => {
            setItemEditorOpen(open);
            if (!open) setEditingItem(null);
          }}
          open
          order={order}
          services={services}
        />
      ) : null}
      {deletingItem ? (
        <TenantOrderItemDeleteDialog
          item={deletingItem}
          onOpenChange={(open) => {
            if (!open) setDeletingItem(null);
          }}
          orderId={order.id}
        />
      ) : null}
      {paymentAdjustment ? (
        <TenantOrderPaymentAdjustmentDialog
          onOpenChange={(open) => {
            if (!open) setPaymentAdjustment(null);
          }}
          order={order}
          target={paymentAdjustment}
        />
      ) : null}
    </section>
  );
}
