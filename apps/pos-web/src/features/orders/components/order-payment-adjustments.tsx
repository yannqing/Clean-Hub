"use client";

import type {
  PosOrderDetail,
  PosPaymentAdjustment,
  PosPaymentAdjustmentDirection,
  PosPaymentTransaction,
} from "@cleanhub/api-client";
import { createId } from "@cleanhub/id";
import { useTranslation } from "@cleanhub/i18n/react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@cleanhub/ui";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

import { Icon } from "@/components/app-shell";
import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";
import { posToast as toast } from "@/lib/pos-toast";
import { getActionErrorMessage } from "@/lib/action-error-message";

import {
  createPaymentCorrectionAction,
  createRefundAction,
  resolveRefundAction,
} from "../actions";
import { formatOrderDateTime, formatOrderMoney } from "../constants";

type AdjustmentMode = "refund" | "correction";

export function OrderPaymentAdjustments({
  adjustments,
  canManage,
  order,
  payments,
}: {
  adjustments: PosPaymentAdjustment[];
  canManage: boolean;
  order: PosOrderDetail;
  payments: PosPaymentTransaction[];
}) {
  const { locale } = useTranslation();
  const { timeZone } = usePosRuntimeConfig();
  const router = useRouter();
  const idempotencyKeyRef = useRef<string | null>(null);
  const [mode, setMode] = useState<AdjustmentMode | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState("");
  const [direction, setDirection] =
    useState<PosPaymentAdjustmentDirection>("debit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [resolutionAdjustment, setResolutionAdjustment] =
    useState<PosPaymentAdjustment | null>(null);
  const [resolutionOutcome, setResolutionOutcome] = useState<
    "succeeded" | "failed"
  >("succeeded");
  const [settlementReference, setSettlementReference] = useState("");
  const [resolutionReason, setResolutionReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const refundablePayments = useMemo(() => {
    return payments
      .filter((payment) => payment.paymentStatus === "paid")
      .map((payment) => {
        const refunded = adjustments
          .filter(
            (adjustment) =>
              adjustment.adjustmentType === "refund" &&
              adjustment.originalPaymentId === payment.id &&
              adjustment.status !== "failed",
          )
          .reduce((sum, adjustment) => sum + Number(adjustment.amount), 0);
        return {
          payment,
          remaining: Math.max(0, Number(payment.amount) - refunded),
        };
      })
      .filter(({ remaining }) => remaining > 0);
  }, [adjustments, payments]);
  const paidPayments = useMemo(
    () => payments.filter((payment) => payment.paymentStatus === "paid"),
    [payments],
  );

  const selectedRefund = refundablePayments.find(
    ({ payment }) => payment.id === selectedPaymentId,
  );

  function resetIntent(): void {
    idempotencyKeyRef.current = null;
  }

  function open(nextMode: AdjustmentMode): void {
    resetIntent();
    setMode(nextMode);
    setDirection("debit");
    setReason("");
    if (nextMode === "refund") {
      const first = refundablePayments[0];
      setSelectedPaymentId(first?.payment.id ?? "");
      setAmount(first ? first.remaining.toFixed(2) : "");
    } else {
      setSelectedPaymentId(paidPayments[0]?.id ?? "");
      setAmount("");
    }
  }

  function close(): void {
    if (isPending) return;
    setMode(null);
    setAmount("");
    setReason("");
    resetIntent();
  }

  function submit(): void {
    const normalizedAmount = Number(amount);
    const normalizedReason = reason.trim();
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      toast.error("请输入有效的调整金额。");
      return;
    }
    if (!normalizedReason) {
      toast.error("请填写操作原因。");
      return;
    }
    if (mode === "refund" && !selectedRefund) {
      toast.error("请选择仍有可退余额的支付流水。");
      return;
    }
    if (mode === "correction" && !selectedPaymentId) {
      toast.error("请选择要修正的原始支付流水。");
      return;
    }
    if (mode === "refund" && normalizedAmount > selectedRefund!.remaining) {
      toast.error("退款金额不能超过该支付流水的可退余额。");
      return;
    }

    const idempotencyKey =
      idempotencyKeyRef.current ?? (idempotencyKeyRef.current = createId());

    startTransition(async () => {
      const result =
        mode === "refund"
          ? await createRefundAction({
              orderId: order.id,
              originalPaymentId: selectedRefund!.payment.id,
              amount: normalizedAmount.toFixed(2),
              idempotencyKey,
              reason: normalizedReason,
            })
          : await createPaymentCorrectionAction({
              orderId: order.id,
              originalPaymentId: selectedPaymentId,
              direction,
              amount: normalizedAmount.toFixed(2),
              idempotencyKey,
              reason: normalizedReason,
            });

      if (!result.ok) {
        toast.error(getActionErrorMessage(result, "order"));
        return;
      }

      if (mode === "refund" && result.data?.adjustment.status === "pending") {
        toast.warning(
          "退款申请已记录，订单实收暂未扣减；请等待渠道退款后再核销。",
        );
      } else {
        toast.success(mode === "refund" ? "退款已完成。" : "支付修正已记录。");
      }
      setMode(null);
      setAmount("");
      setReason("");
      resetIntent();
      router.refresh();
    });
  }

  function submitRefundResolution(): void {
    if (!resolutionAdjustment || resolutionReason.trim().length < 3) {
      toast.error("请填写至少 3 个字符的核销原因。");
      return;
    }
    const originalPayment = payments.find(
      (payment) => payment.id === resolutionAdjustment.originalPaymentId,
    );
    if (
      resolutionOutcome === "succeeded" &&
      originalPayment?.paymentMethod !== "cash" &&
      !settlementReference.trim()
    ) {
      toast.error("非现金退款核销必须填写渠道退款流水号。");
      return;
    }
    startTransition(async () => {
      const result = await resolveRefundAction(
        resolutionAdjustment.id,
        order.id,
        {
          outcome: resolutionOutcome,
          settlementReference:
            resolutionOutcome === "succeeded"
              ? settlementReference.trim() || undefined
              : undefined,
          reason: resolutionReason.trim(),
        },
      );
      if (!result.ok) {
        toast.error(getActionErrorMessage(result, "order"));
        return;
      }
      toast.success(
        resolutionOutcome === "succeeded"
          ? "渠道退款已核销，订单实收已更新。"
          : "渠道退款失败已记录，可在确认资金退回后重新核销。",
      );
      setResolutionAdjustment(null);
      setSettlementReference("");
      setResolutionReason("");
      router.refresh();
    });
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b px-5 py-4">
        <div>
          <CardTitle>退款与支付修正</CardTitle>
          <CardDescription className="mt-1 text-xs">
            不可变支付调整记录
          </CardDescription>
        </div>
        {canManage ? (
          <CardAction className="flex gap-2">
            <Button
              disabled={refundablePayments.length === 0}
              onClick={() => open("refund")}
              size="sm"
              type="button"
              variant="outline"
            >
              <Icon className="h-4 w-4" name="rotate-ccw" />
              退款
            </Button>
            <Button
              disabled={paidPayments.length === 0}
              onClick={() => open("correction")}
              size="sm"
              type="button"
            >
              <Icon className="h-4 w-4" name="replace" />
              支付修正
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>

      {adjustments.length === 0 ? (
        <CardContent className="px-5 py-8 text-sm text-muted-foreground">
          暂无调整记录。
        </CardContent>
      ) : (
        <CardContent className="divide-y px-0">
          {adjustments.map((adjustment) => (
            <div
              className="flex flex-wrap items-start justify-between gap-4 px-5 py-4 text-sm"
              key={adjustment.id}
            >
              <div className="min-w-0">
                <div className="font-semibold text-foreground">
                  {adjustment.adjustmentType === "refund"
                    ? "退款"
                    : adjustment.direction === "debit"
                      ? "减少实收"
                      : "增加实收"}
                </div>
                <div className="mt-1 break-words text-xs text-muted-foreground">
                  {adjustment.reason}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatOrderDateTime(adjustment.occurredAt, locale, timeZone)}
                </div>
                {adjustment.adjustmentType === "refund" ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <Badge
                      className={
                        adjustment.status === "succeeded"
                          ? "border-0 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300"
                          : adjustment.status === "failed"
                            ? ""
                            : "border-0 bg-amber-50 text-amber-700 dark:bg-amber-950/35 dark:text-amber-300"
                      }
                      variant={
                        adjustment.status === "failed"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {adjustment.status === "succeeded"
                        ? "资金已退回"
                        : adjustment.status === "failed"
                          ? "退款失败"
                          : "等待渠道确认"}
                    </Badge>
                    {adjustment.settlementReference ? (
                      <span className="text-muted-foreground">
                        渠道流水 {adjustment.settlementReference}
                      </span>
                    ) : null}
                    {canManage && adjustment.status !== "succeeded" ? (
                      <Button
                        className="h-auto px-0 text-xs"
                        onClick={() => {
                          setResolutionAdjustment(adjustment);
                          setResolutionOutcome("succeeded");
                          setSettlementReference("");
                          setResolutionReason("");
                        }}
                        type="button"
                        variant="link"
                      >
                        核销退款结果
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div
                className={`font-semibold ${
                  adjustment.direction === "debit"
                    ? "text-red-600"
                    : "text-emerald-700"
                }`}
              >
                {adjustment.direction === "debit" ? "-" : "+"}
                {formatOrderMoney(adjustment.amount, adjustment.currency)}
              </div>
            </div>
          ))}
        </CardContent>
      )}

      <Dialog
        onOpenChange={(openState) => {
          if (!openState) close();
        }}
        open={mode !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "refund" ? "记录退款" : "记录支付修正"}
            </DialogTitle>
            <DialogDescription>
              仅限 Owner 或 Manager，提交后会保留原因与操作审计。
            </DialogDescription>
          </DialogHeader>

          {mode === "refund" ? (
            <label className="grid gap-2 text-sm font-medium text-foreground">
              原始支付流水
              <Select
                disabled={isPending}
                onValueChange={(paymentId) => {
                  const selected = refundablePayments.find(
                    ({ payment }) => payment.id === paymentId,
                  );
                  setSelectedPaymentId(paymentId);
                  setAmount(selected ? selected.remaining.toFixed(2) : "");
                  resetIntent();
                }}
                value={selectedPaymentId}
              >
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="选择支付流水" />
                </SelectTrigger>
                <SelectContent>
                  {refundablePayments.map(({ payment, remaining }) => (
                    <SelectItem key={payment.id} value={payment.id}>
                      {payment.id.slice(-8)} · 可退{" "}
                      {formatOrderMoney(remaining, payment.currency)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          ) : (
            <div className="grid gap-4">
              <label className="grid gap-2 text-sm font-medium text-foreground">
                原始支付流水
                <Select
                  disabled={isPending}
                  onValueChange={(paymentId) => {
                    setSelectedPaymentId(paymentId);
                    resetIntent();
                  }}
                  value={selectedPaymentId}
                >
                  <SelectTrigger className="h-11 w-full">
                    <SelectValue placeholder="选择支付流水" />
                  </SelectTrigger>
                  <SelectContent>
                    {paidPayments.map((payment) => (
                      <SelectItem key={payment.id} value={payment.id}>
                        {payment.id.slice(-8)} ·{" "}
                        {formatOrderMoney(payment.amount, payment.currency)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <div className="text-sm font-medium text-foreground">
                修正方向
              </div>
              <div className="grid grid-cols-2 rounded-md border bg-muted/50 p-1">
                {(["debit", "credit"] as const).map((value) => (
                  <Button
                    className="h-11"
                    disabled={isPending}
                    key={value}
                    onClick={() => {
                      setDirection(value);
                      resetIntent();
                    }}
                    type="button"
                    variant={direction === value ? "secondary" : "ghost"}
                  >
                    {value === "debit" ? "减少实收" : "增加实收"}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <label className="grid gap-2 text-sm font-medium text-foreground">
            金额
            <Input
              className="h-11"
              disabled={isPending}
              inputMode="decimal"
              onChange={(event) => {
                setAmount(event.target.value);
                resetIntent();
              }}
              placeholder="0.00"
              value={amount}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-foreground">
            操作原因
            <Textarea
              className="min-h-24"
              disabled={isPending}
              maxLength={500}
              onChange={(event) => {
                setReason(event.target.value);
                resetIntent();
              }}
              placeholder="填写退款或修正原因"
              value={reason}
            />
          </label>

          <DialogFooter>
            <Button
              className="h-11"
              disabled={isPending}
              onClick={close}
              type="button"
              variant="outline"
            >
              取消
            </Button>
            <Button
              className="h-11"
              disabled={isPending || !reason.trim() || Number(amount) <= 0}
              onClick={submit}
              type="button"
            >
              {isPending ? "提交中…" : "确认提交"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(openState) => {
          if (!openState && !isPending) setResolutionAdjustment(null);
        }}
        open={resolutionAdjustment !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>核销渠道退款</DialogTitle>
            <DialogDescription>
              只有在支付渠道或终端明确返回结果后才能核销。成功核销会扣减订单实收；失败不会改变订单余额。
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 rounded-md border bg-muted/50 p-1">
            {(["succeeded", "failed"] as const).map((outcome) => (
              <Button
                className="h-11"
                disabled={isPending}
                key={outcome}
                onClick={() => setResolutionOutcome(outcome)}
                type="button"
                variant={resolutionOutcome === outcome ? "secondary" : "ghost"}
              >
                {outcome === "succeeded" ? "资金已退回" : "退款失败"}
              </Button>
            ))}
          </div>
          {resolutionOutcome === "succeeded" ? (
            <label className="grid gap-2 text-sm font-medium">
              渠道退款流水号
              <Input
                className="h-11"
                disabled={isPending}
                maxLength={160}
                onChange={(event) => setSettlementReference(event.target.value)}
                placeholder="现金退款可留空"
                value={settlementReference}
              />
            </label>
          ) : null}
          <label className="grid gap-2 text-sm font-medium">
            核销原因 / 证据说明
            <Textarea
              className="min-h-24"
              disabled={isPending}
              maxLength={500}
              onChange={(event) => setResolutionReason(event.target.value)}
              value={resolutionReason}
            />
          </label>
          <DialogFooter>
            <Button
              className="h-11"
              disabled={isPending}
              onClick={() => setResolutionAdjustment(null)}
              type="button"
              variant="outline"
            >
              取消
            </Button>
            <Button
              className="h-11"
              disabled={isPending || resolutionReason.trim().length < 3}
              onClick={submitRefundResolution}
              type="button"
            >
              {isPending ? "核销中…" : "确认核销"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
