"use client";

import { useTranslation } from "@cleanhub/i18n/react";
import type { PosReceiptField } from "@cleanhub/domain/receipt";
import { formatPosOrderQrPayload } from "@cleanhub/domain/order-codes";
import {
  allocateReceiptLineMinor,
  moneyToReceiptMinor,
} from "@cleanhub/domain/currency";
import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
} from "@cleanhub/ui";
import type {
  PosCatalogService,
  PosCatalogProduct,
  PosOrderDetail,
  PosMobileMoneyProvider,
  PosPaymentAdjustment,
  PosPaymentTransaction,
  PosRegisterState,
  ShiftRecord,
} from "@cleanhub/api-client";
import { buildPosReceiptText, type PrintLocale } from "@cleanhub/hardware";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { PosBreadcrumb } from "@/components/app-shell";
import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";
import { customerDetailPath, posRoutes } from "@/config";
import { PrintJobControl } from "@/features/hardware/components";

import {
  MOBILE_MONEY_PROVIDER_LABELS,
  displayOrderCode,
  formatOrderDateTime,
  formatOrderMoney,
  PAYMENT_TRANSACTION_STATUS_TONES,
} from "../constants";
import {
  confirmManualPaymentAction,
  failManualPaymentAction,
  recordCardOutcomeAction,
} from "../actions";
import { posMessage } from "@/lib/pos-message";
import { posToast as toast } from "@/lib/pos-toast";
import { getActionErrorMessage } from "@/lib/action-error-message";
import {
  getOrderTypeLabel,
  getPaymentMethodLabel,
  getPaymentTransactionStatusLabel,
} from "@/lib/order-labels";
import { OrderActionsPanel } from "./order-actions-panel";
import { OrderPaymentStatusBadge, OrderStatusBadge } from "./order-badges";
import { OrderDiscountsCard } from "./order-discounts-card";
import { OrderInfoEditor } from "./order-info-editor";
import { OrderItemsManager } from "./order-items-manager";
import { OrderPaymentAdjustments } from "./order-payment-adjustments";
import { OrderTicketReferencesCard } from "./order-ticket-references-card";
import { ProductReturnDialog } from "./product-return-dialog";
import { ReceiptDeliveryHistory } from "./receipt-delivery-history";
import { getPosReceiptCopy } from "../lib/order-receipt";
import { formatOrderItemMeasurement } from "../lib/order-measurement";

type OrderDetailViewProps = {
  canResolveManualPayments: boolean;
  adjustments: PosPaymentAdjustment[];
  catalog: PosCatalogService[];
  currentShift: ShiftRecord | null;
  register: PosRegisterState;
  products: PosCatalogProduct[];
  order: PosOrderDetail;
  payments: PosPaymentTransaction[];
  source?: {
    from?: string;
    q?: string;
    ticketFrom?: string;
    ticketId?: string;
  };
};

export function OrderDetailView({
  canResolveManualPayments,
  adjustments,
  catalog,
  currentShift,
  register,
  products,
  order,
  payments,
  source,
}: OrderDetailViewProps) {
  const { locale } = useTranslation();
  const runtime = usePosRuntimeConfig();
  const breadcrumbItems = buildOrderBreadcrumbItems(order, source);
  const receiptContent = buildOrderReceiptContent(order, payments, locale, {
    branchName: runtime.receiptName || runtime.branchName,
    fields: runtime.receiptFields,
    merchantName: runtime.merchantName,
    operatorName: runtime.operatorName,
    receiptAddress: runtime.receiptAddress,
    receiptPhone: runtime.receiptPhone,
    receiptThankYouMessage: runtime.receiptThankYouMessage,
    terminalName: runtime.terminalName,
  });
  const receiptQrCode = runtime.receiptFields.includes("order_qr_code")
    ? formatPosOrderQrPayload(order.id)
    : undefined;

  return (
    <section className="mx-auto w-full max-w-[1080px] space-y-4 pb-12">
      <PosBreadcrumb items={breadcrumbItems} />

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b px-5 py-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <OrderStatusBadge status={order.status} />
              <OrderPaymentStatusBadge status={order.paymentStatus} />
            </div>
            <CardTitle className="truncate text-xl">
              {displayOrderCode(order.id)}
            </CardTitle>
            <CardDescription className="mt-1">
              {order.customerName || "散客"} ·{" "}
              {getOrderTypeLabel(order.orderType)}
            </CardDescription>
          </div>
          <CardAction className="col-span-2 col-start-1 row-start-3 flex flex-wrap items-center justify-self-stretch gap-2 sm:col-span-1 sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:justify-self-end">
            {canResolveManualPayments &&
            order.items.some((item) => item.itemKind === "product") ? (
              <ProductReturnDialog order={order} products={products} />
            ) : null}
            <PrintJobControl
              canReprint={canResolveManualPayments}
              content={receiptContent}
              documentType="receipt"
              entityId={order.id}
              initialLabel="打印小票"
              qrCodeContent={receiptQrCode}
              title={`RC-${order.id.slice(-8).toUpperCase()}`}
            />
          </CardAction>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-px bg-border px-0 sm:grid-cols-4">
          <OrderHeaderMetric
            label="订单金额"
            value={formatOrderMoney(order.totalAmount, order.currency, locale)}
          />
          <OrderHeaderMetric
            label="已收金额"
            value={formatOrderMoney(order.paidAmount, order.currency, locale)}
          />
          <OrderHeaderMetric
            label="条目数量"
            value={posMessage("pos.inline.itemCount", {
              count: order.items.length,
            })}
          />
          <OrderHeaderMetric
            label="订单类型"
            value={getOrderTypeLabel(order.orderType)}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-4">
          <OrderInfoEditor order={order} />
          <OrderTicketReferencesCard
            currency={order.currency}
            locale={locale}
            ticketReferences={order.ticketReferences}
          />
          <OrderItemsManager
            canManageSensitiveOperations={canResolveManualPayments}
            catalog={
              order.customerId
                ? catalog.filter(
                    (service) => service.currency === order.currency,
                  )
                : []
            }
            order={order}
            products={products.filter(
              (product) => product.currency === order.currency,
            )}
          />
          <OrderDiscountsCard
            canManageSensitiveOperations={canResolveManualPayments}
            order={order}
            payments={payments}
          />
          <OrderPaymentsCard
            canResolveManualPayments={canResolveManualPayments}
            orderId={order.id}
            payments={payments}
          />
          <ReceiptDeliveryHistory orderId={order.id} />
          <OrderPaymentAdjustments
            adjustments={adjustments}
            canManage={canResolveManualPayments}
            order={order}
            payments={payments}
          />
        </div>
        <OrderActionsPanel
          canManageSensitiveOperations={canResolveManualPayments}
          currentShift={currentShift}
          register={register}
          key={`${order.id}:${order.version}`}
          order={order}
          payments={payments}
        />
      </div>
    </section>
  );
}

function OrderHeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-card px-5 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-foreground">
        {value}
      </div>
    </div>
  );
}

function buildOrderReceiptContent(
  order: PosOrderDetail,
  payments: PosPaymentTransaction[],
  locale: string,
  config: {
    branchName: string;
    fields: PosReceiptField[];
    merchantName: string;
    operatorName: string | null;
    receiptAddress: string | null;
    receiptPhone: string | null;
    receiptThankYouMessage: string | null;
    terminalName: string | null;
  },
): string {
  const copy = getPosReceiptCopy(locale);
  const subtotalMinor = moneyToReceiptMinor(
    order.subtotalAmount,
    order.currency,
  );
  // Allocate the lines against the subtotal instead of rounding each one, so
  // the printed column adds up to the printed total in a zero-decimal
  // currency.
  const lineAmountsMinor = allocateReceiptLineMinor(
    order.items.map((item) => item.lineAmount),
    order.currency,
    subtotalMinor,
  );
  const items = order.items.map((item, itemIndex) => {
    const quantity =
      item.pricingUnit === "per_kg"
        ? Number(item.weight ?? item.quantity)
        : Number(item.quantity);
    const details = [
      `${copy.measurement} ${formatOrderItemMeasurement(item, locale)}`,
      `${copy.chargedPrice} ${formatOrderMoney(item.chargedUnitAmount, order.currency)}`,
      item.standardUnitAmount !== item.chargedUnitAmount
        ? `${copy.standardPrice} ${formatOrderMoney(item.standardUnitAmount, order.currency)}`
        : null,
      item.itemColor ? `${copy.color} ${item.itemColor}` : null,
      item.defectNotes ? `${copy.defect} ${item.defectNotes}` : null,
      item.specialRequest ? `${copy.specialRequest} ${item.specialRequest}` : null,
      item.itemIdentifier ? `${copy.identifier} ${item.itemIdentifier}` : null,
    ].filter((value): value is string => Boolean(value));

    return {
      name: item.itemName,
      quantity: Number.isFinite(quantity) ? quantity : 0,
      unitAmountMinor: moneyToReceiptMinor(
        item.chargedUnitAmount,
        order.currency,
      ),
      totalAmountMinor: lineAmountsMinor[itemIndex] ?? 0,
      sku: item.sku ?? undefined,
      barcode: item.barcode ?? undefined,
      note: details.length > 0 ? details.join("; ") : undefined,
    };
  });
  const discountMinor = moneyToReceiptMinor(
    order.discountAmount,
    order.currency,
  );
  const totalMinor = moneyToReceiptMinor(order.totalAmount, order.currency);
  const paymentMethod = [
    ...new Set(
      payments
        .filter((payment) => payment.paymentStatus === "paid")
        .map((payment) =>
          payment.provider
            ? MOBILE_MONEY_PROVIDER_LABELS[payment.provider]
            : copy.paymentMethods[payment.paymentMethod],
        ),
    ),
  ].join(" / ");
  const paidCash = payments.filter(
    (payment) =>
      payment.paymentMethod === "cash" && payment.paymentStatus === "paid",
  );

  return buildPosReceiptText(
    {
      receiptNo: `RC-${order.id.slice(-8).toUpperCase()}`,
      orderCode: displayOrderCode(order.id),
      issuedAt: order.paidAt ?? order.updatedAt,
      currency: order.currency,
      merchantName: config.merchantName,
      branchName: config.branchName,
      cashierName: config.operatorName ?? undefined,
      terminalName: config.terminalName ?? undefined,
      customerName: order.customerName ?? copy.walkInCustomer,
      fields: config.fields,
      items,
      subtotalMinor,
      discountMinor,
      taxableMinor: moneyToReceiptMinor(order.taxableAmount, order.currency),
      taxMinor: moneyToReceiptMinor(order.taxAmount, order.currency),
      taxRate: order.taxRateSnapshot,
      roundingMinor: moneyToReceiptMinor(
        order.roundingAdjustmentAmount,
        order.currency,
      ),
      taxRegistrationNumber: order.taxRegistrationNumberSnapshot ?? undefined,
      taxExemptionReason: order.taxExemptionReason ?? undefined,
      totalMinor,
      paidMinor: moneyToReceiptMinor(order.paidAmount, order.currency),
      cashTenderedMinor:
        paidCash.length > 0
          ? paidCash.reduce(
              (sum, payment) =>
                sum +
                moneyToReceiptMinor(
                  payment.tenderedAmount ?? payment.amount,
                  payment.currency,
                ),
              0,
            )
          : undefined,
      changeMinor:
        paidCash.length > 0
          ? paidCash.reduce(
              (sum, payment) =>
                sum +
                moneyToReceiptMinor(payment.changeAmount ?? "0", payment.currency),
              0,
            )
          : undefined,
      balanceMinor: Math.max(
        0,
        totalMinor - moneyToReceiptMinor(order.paidAmount, order.currency),
      ),
      paymentMethod: paymentMethod || undefined,
      receiptAddress: config.receiptAddress ?? undefined,
      receiptPhone: config.receiptPhone ?? undefined,
      thankYouMessage: config.receiptThankYouMessage || copy.thankYou,
    },
    { locale: toPrintLocale(locale) },
  );
}

function toPrintLocale(locale: string): PrintLocale {
  if (locale === "zh-CN" || locale === "fr") return locale;
  return "en";
}

function buildOrderBreadcrumbItems(
  order: PosOrderDetail,
  source: OrderDetailViewProps["source"],
) {
  const arrivedFromTicket = source?.from === "ticket";
  const ticketId = arrivedFromTicket
    ? (source.ticketId ?? order.items.find((item) => item.ticketId)?.ticketId)
    : null;

  if (!ticketId) {
    // Reached from the order list (or anywhere else): the trail stays rooted in
    // orders, and the ticket is reachable through the 关联工单 panel instead —
    // a single order may settle several tickets, which a breadcrumb cannot show.
    return [
      { href: posRoutes.orders, label: "订单管理" },
      { label: displayOrderCode(order.id) },
    ];
  }

  const ticketHref = buildTicketDetailHref(ticketId, source);
  if (source?.ticketFrom === "intake") {
    return [
      { href: buildIntakeReturnPath(source.q), label: "客户接待" },
      ...(order.customerId
        ? [
            {
              href: buildCustomerDetailHref(order.customerId, source),
              label: order.customerName || "客户档案",
            },
          ]
        : []),
      { href: ticketHref, label: "工单详情" },
      { label: displayOrderCode(order.id) },
    ];
  }

  if (source?.ticketFrom === "customer") {
    return [
      { href: posRoutes.customers, label: "客户管理" },
      ...(order.customerId
        ? [
            {
              href: buildCustomerDetailHref(order.customerId, source),
              label: order.customerName || "客户档案",
            },
          ]
        : []),
      { href: ticketHref, label: "工单详情" },
      { label: displayOrderCode(order.id) },
    ];
  }

  if (source?.ticketFrom === "handover") {
    return [
      { href: posRoutes.shiftHandover, label: "班次与收银" },
      { href: ticketHref, label: "工单详情" },
      { label: displayOrderCode(order.id) },
    ];
  }

  return [
    { href: posRoutes.tickets, label: "工单管理" },
    { href: ticketHref, label: "工单详情" },
    { label: displayOrderCode(order.id) },
  ];
}

function buildIntakeReturnPath(query: string | undefined): string {
  const keyword = query?.trim();
  if (!keyword) {
    return posRoutes.newIntake;
  }

  return `${posRoutes.newIntake}?q=${encodeURIComponent(keyword)}`;
}

function buildCustomerDetailHref(
  customerId: string,
  source: OrderDetailViewProps["source"],
): string {
  const base = customerDetailPath(customerId);
  if (source?.ticketFrom !== "intake") {
    return base;
  }

  const params = new URLSearchParams({ from: "intake" });
  const keyword = source.q?.trim();
  if (keyword) {
    params.set("q", keyword);
  }

  return `${base}?${params.toString()}`;
}

function buildTicketDetailHref(
  ticketId: string,
  source: OrderDetailViewProps["source"],
): string {
  const base = posRoutes.ticketDetail(ticketId);
  if (
    source?.ticketFrom !== "intake" &&
    source?.ticketFrom !== "customer" &&
    source?.ticketFrom !== "handover"
  ) {
    return base;
  }

  const params = new URLSearchParams({ from: source.ticketFrom });
  const keyword = source.q?.trim();
  if (source.ticketFrom === "intake" && keyword) {
    params.set("q", keyword);
  }

  return `${base}?${params.toString()}`;
}

function OrderPaymentsCard({
  canResolveManualPayments,
  orderId,
  payments,
}: {
  canResolveManualPayments: boolean;
  orderId: string;
  payments: PosPaymentTransaction[];
}) {
  const { locale } = useTranslation();
  const { timeZone } = usePosRuntimeConfig();
  const router = useRouter();
  const [resolution, setResolution] = useState<{
    payment: PosPaymentTransaction;
    action: "confirm" | "fail";
  } | null>(null);
  const [reason, setReason] = useState("");
  const [tpeReference, setTpeReference] = useState("");
  const [authorizationCode, setAuthorizationCode] = useState("");
  const [isPending, startTransition] = useTransition();

  function closeResolutionDialog() {
    if (isPending) return;
    setResolution(null);
    setReason("");
    setTpeReference("");
    setAuthorizationCode("");
  }

  function submitResolution() {
    if (!resolution) return;
    const trimmedReason = reason.trim();
    if (resolution.action === "fail" && trimmedReason.length < 3) {
      toast.error("标记失败时必须填写原因。");
      return;
    }
    if (
      resolution.payment.paymentMethod === "card" &&
      resolution.action === "confirm" &&
      !tpeReference.trim()
    ) {
      toast.error("确认刷卡成功必须填写 TPE 交易流水号。");
      return;
    }

    startTransition(async () => {
      const result =
        resolution.payment.paymentMethod === "card"
          ? await recordCardOutcomeAction(orderId, resolution.payment.id, {
              outcome: resolution.action === "confirm" ? "succeeded" : "failed",
              externalReference:
                resolution.action === "confirm"
                  ? tpeReference.trim()
                  : undefined,
              authorizationCode: authorizationCode.trim() || undefined,
              providerPayload:
                trimmedReason && resolution.action === "confirm"
                  ? { reconciliationNote: trimmedReason }
                  : undefined,
              failureReason:
                resolution.action === "fail" ? trimmedReason : undefined,
            })
          : resolution.action === "confirm"
            ? await confirmManualPaymentAction(orderId, resolution.payment.id, {
                reason: trimmedReason || undefined,
              })
            : await failManualPaymentAction(orderId, resolution.payment.id, {
                reason: trimmedReason,
              });

      if (!result.ok) {
        toast.error(getActionErrorMessage(result, "order"));
        return;
      }

      toast.success(
        resolution.action === "confirm"
          ? resolution.payment.paymentMethod === "card"
            ? "TPE 刷卡已核销成功。"
            : "移动支付已确认到账。"
          : "支付已标记为失败。",
      );
      setResolution(null);
      setReason("");
      setTpeReference("");
      setAuthorizationCode("");
      router.refresh();
    });
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b px-5 py-4">
        <CardTitle>支付流水</CardTitle>
        <CardDescription className="text-xs">
          Wave / Orange Money 需由 Owner 或 Manager 在商户应用核对后确认。
        </CardDescription>
      </CardHeader>
      {payments.length === 0 ? (
        <CardContent className="px-5 py-8 text-sm text-muted-foreground">
          暂无支付流水。
        </CardContent>
      ) : (
        <CardContent className="divide-y px-0">
          {payments.map((payment) => (
            <div
              className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 text-sm"
              key={payment.id}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-semibold text-foreground">
                    {getPaymentDisplayName(
                      payment.paymentMethod,
                      payment.provider,
                    )}
                  </div>
                  <Badge
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PAYMENT_TRANSACTION_STATUS_TONES[payment.paymentStatus]}`}
                    variant="secondary"
                  >
                    {getPaymentTransactionStatusLabel(payment.paymentStatus)}
                  </Badge>
                </div>
                {payment.externalReference ? (
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    流水号：{payment.externalReference}
                  </div>
                ) : null}
                {payment.paymentMethod === "cash" && payment.tenderedAmount ? (
                  <div className="mt-1 text-xs text-muted-foreground">
                    实收{" "}
                    {formatOrderMoney(payment.tenderedAmount, payment.currency)}{" "}
                    · 找零{" "}
                    {formatOrderMoney(
                      payment.changeAmount ?? "0",
                      payment.currency,
                    )}
                  </div>
                ) : null}
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatOrderDateTime(
                    payment.paidAt ?? payment.createdAt,
                    locale,
                    timeZone,
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="font-semibold text-foreground">
                  {formatOrderMoney(payment.amount, payment.currency)}
                </div>
                {payment.paymentStatus === "pending" ? (
                  canResolveManualPayments ? (
                    <div className="flex gap-2">
                      <Button
                        className="bg-emerald-600 text-white hover:bg-emerald-700"
                        onClick={() =>
                          setResolution({ payment, action: "confirm" })
                        }
                        size="sm"
                        type="button"
                      >
                        {payment.paymentMethod === "card"
                          ? "核销成功"
                          : "确认到账"}
                      </Button>
                      <Button
                        onClick={() =>
                          setResolution({ payment, action: "fail" })
                        }
                        size="sm"
                        type="button"
                        variant="destructive"
                      >
                        标记失败
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-amber-700">
                      等待 Manager 确认
                    </span>
                  )
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
      )}
      <Dialog
        onOpenChange={(open) => {
          if (!open) closeResolutionDialog();
        }}
        open={resolution !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {resolution?.action === "confirm"
                ? resolution.payment.paymentMethod === "card"
                  ? "核销 TPE 刷卡结果"
                  : "确认移动支付到账"
                : "标记支付失败"}
            </DialogTitle>
            <DialogDescription>
              请先在对应 TPE
              或商户应用中核对金额与交易流水号。本操作会记录操作者和时间。
            </DialogDescription>
          </DialogHeader>
          {resolution ? (
            <div className="grid gap-4">
              <div className="rounded-md bg-muted/50 p-4 text-sm">
                <div className="font-semibold text-foreground">
                  {getPaymentDisplayName(
                    resolution.payment.paymentMethod,
                    resolution.payment.provider,
                  )}{" "}
                  ·{" "}
                  {formatOrderMoney(
                    resolution.payment.amount,
                    resolution.payment.currency,
                  )}
                </div>
                <div className="mt-1 text-muted-foreground">
                  流水号：{resolution.payment.externalReference ?? "—"}
                </div>
              </div>
              {resolution.payment.paymentMethod === "card" &&
              resolution.action === "confirm" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium">
                    TPE 交易流水号
                    <Input
                      className="h-11"
                      maxLength={120}
                      onChange={(event) => setTpeReference(event.target.value)}
                      value={tpeReference}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    授权码（可选）
                    <Input
                      className="h-11"
                      maxLength={120}
                      onChange={(event) =>
                        setAuthorizationCode(event.target.value)
                      }
                      value={authorizationCode}
                    />
                  </label>
                </div>
              ) : null}
              <label className="grid gap-2 text-sm font-medium text-foreground">
                {resolution.action === "fail" ? "失败原因" : "确认备注（可选）"}
                <Textarea
                  className="min-h-24"
                  disabled={isPending}
                  maxLength={500}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={
                    resolution.action === "fail"
                      ? "例如：商户应用中未找到该笔交易"
                      : "例如：已在 Wave 商户应用核对到账"
                  }
                  value={reason}
                />
              </label>
              <DialogFooter>
                <Button
                  className="h-11"
                  disabled={isPending}
                  onClick={closeResolutionDialog}
                  type="button"
                  variant="outline"
                >
                  取消
                </Button>
                <Button
                  className={`h-11 ${
                    resolution.action === "confirm"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : ""
                  }`}
                  disabled={isPending}
                  onClick={submitResolution}
                  type="button"
                  variant={
                    resolution.action === "confirm" ? "default" : "destructive"
                  }
                >
                  {isPending
                    ? "处理中…"
                    : resolution.action === "confirm"
                      ? "确认已到账"
                      : "确认标记失败"}
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function getPaymentDisplayName(
  paymentMethod: PosPaymentTransaction["paymentMethod"],
  provider: PosMobileMoneyProvider | null,
): string {
  return provider
    ? MOBILE_MONEY_PROVIDER_LABELS[provider]
    : getPaymentMethodLabel(paymentMethod);
}
