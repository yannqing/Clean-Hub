"use client";

import type {
  PosOrderDetail,
  PosOrderDiscountApplication,
  PosPaymentTransaction,
} from "@cleanhub/api-client";
import { createId } from "@cleanhub/id";
import { useTranslation } from "@cleanhub/i18n/react";
import {
  Badge,
  Button,
  Card,
  CardAction,
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
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { Icon } from "@/components/app-shell";
import { translatePosText } from "@/components/i18n/pos-runtime-text";
import { posToast as toast } from "@/lib/pos-toast";
import { getActionErrorMessage } from "@/lib/action-error-message";
import { posMessage } from "@/lib/pos-message";
import type { TranslationKey } from "@cleanhub/i18n";

import {
  applyOrderDiscountAction,
  removeOrderDiscountAction,
} from "../actions";
import { formatOrderMoney } from "../constants";

export function OrderDiscountsCard({
  canManageSensitiveOperations,
  order,
  payments,
}: {
  canManageSensitiveOperations: boolean;
  order: PosOrderDetail;
  payments: PosPaymentTransaction[];
}) {
  const { locale } = useTranslation();
  const router = useRouter();
  const text = (value: string) => translatePosText(value, locale);
  const [code, setCode] = useState("");
  const [applyConfirmationOpen, setApplyConfirmationOpen] = useState(false);
  const [applyReason, setApplyReason] = useState("");
  const [removeTarget, setRemoveTarget] =
    useState<PosOrderDiscountApplication | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const applyIdempotencyKeyRef = useRef<string | null>(null);
  const orderCanChangeDiscounts =
    Number(order.paidAmount) === 0 &&
    order.status !== "paid" &&
    order.status !== "delivered" &&
    order.status !== "cancelled";
  const hasPendingManualPayment = payments.some(
    (payment) =>
      payment.paymentStatus === "pending" &&
      payment.paymentMethod === "app" &&
      (payment.provider === "wave" || payment.provider === "orange_money"),
  );
  const canEdit =
    canManageSensitiveOperations &&
    orderCanChangeDiscounts &&
    !hasPendingManualPayment;
  const editRestrictionMessage = !canManageSensitiveOperations
    ? "仅店主或经理可以手动应用或移除优惠码。"
    : hasPendingManualPayment
      ? "请先处理待确认的移动支付，再修改订单折扣。"
      : !orderCanChangeDiscounts
        ? "订单收款或完成后不能再修改折扣。"
        : null;

  function requestApplyCode() {
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      toast.error("请输入优惠码。");
      return;
    }
    setApplyReason("");
    setApplyConfirmationOpen(true);
  }

  function applyCode() {
    const trimmedCode = code.trim();
    const reason = applyReason.trim();
    if (!trimmedCode) {
      toast.error("请输入优惠码。");
      return;
    }
    if (!reason) {
      toast.error("请填写应用原因。");
      return;
    }

    startTransition(async () => {
      const result = await applyOrderDiscountAction(order.id, {
        code: trimmedCode,
        reason,
        version: order.version,
        idempotencyKey:
          applyIdempotencyKeyRef.current ??
          (applyIdempotencyKeyRef.current = createId()),
      });

      if (result.ok) {
        applyIdempotencyKeyRef.current = null;
        setCode("");
        setApplyConfirmationOpen(false);
        setApplyReason("");
        toast.success("优惠码已应用。");
        router.refresh();
        return;
      }

      if (
        result.code === "VERSION_CONFLICT" ||
        result.code === "DISCOUNT_IDEMPOTENCY_CONFLICT"
      ) {
        applyIdempotencyKeyRef.current = null;
        setApplyConfirmationOpen(false);
        setApplyReason("");
      }
      toast.error(getActionErrorMessage(result, "order"));
      if (result.code === "VERSION_CONFLICT") {
        router.refresh();
      }
    });
  }

  function removeCodeDiscount() {
    if (!removeTarget) {
      return;
    }
    const reason = removeReason.trim();
    if (!reason) {
      toast.error("请填写移除原因。");
      return;
    }

    startTransition(async () => {
      const result = await removeOrderDiscountAction(
        order.id,
        removeTarget.id,
        {
          version: order.version,
          reason,
        },
      );

      if (result.ok) {
        setRemoveTarget(null);
        setRemoveReason("");
        toast.success("优惠码折扣已移除。");
        router.refresh();
        return;
      }

      toast.error(getActionErrorMessage(result, "order"));
      if (result.code === "VERSION_CONFLICT") {
        setRemoveTarget(null);
        setRemoveReason("");
        router.refresh();
      }
    });
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b px-5 py-4">
        <div>
          <CardTitle>{text("折扣与优惠码")}</CardTitle>
          <CardDescription className="mt-1 text-xs">
            {text("自动折扣由系统计算，优惠码可在收款前应用或移除。")}
          </CardDescription>
        </div>
        <CardAction>
          <Icon className="h-5 w-5 text-muted-foreground" name="receipt" />
        </CardAction>
      </CardHeader>

      <div className="grid grid-cols-1 divide-y bg-muted/40 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <AmountSummary
          label={text("订单小计")}
          value={formatOrderMoney(order.subtotalAmount, order.currency, locale)}
        />
        <AmountSummary
          label={text("优惠金额")}
          tone="discount"
          value={
            Number(order.discountAmount) > 0
              ? `−${formatOrderMoney(
                  order.discountAmount,
                  order.currency,
                  locale,
                )}`
              : formatOrderMoney(0, order.currency, locale)
          }
        />
        <AmountSummary
          label={text("应付总额")}
          tone="total"
          value={formatOrderMoney(order.totalAmount, order.currency, locale)}
        />
      </div>

      <div className="border-t px-5 py-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {text("已应用折扣")}
        </h3>
        {order.discountApplications.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {text("暂无应用中的折扣。")}
          </p>
        ) : (
          <div className="mt-3 divide-y border-y">
            {order.discountApplications.map((application) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 px-3 py-3"
                key={application.id}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {application.title}
                    </span>
                    <Badge
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        application.method === "automatic"
                          ? "bg-accent text-accent-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                      variant="secondary"
                    >
                      {text(
                        application.method === "automatic"
                          ? "自动折扣"
                          : "优惠码",
                      )}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span>{posMessage(
                        `pos.discount.type.${application.type}` as TranslationKey,
                      )}</span>
                    {application.code ? (
                      <code className="rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">
                        {application.code}
                      </code>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-emerald-700">
                    −
                    {formatOrderMoney(
                      application.amount,
                      application.currency,
                      locale,
                    )}
                  </span>
                  {application.method === "code" && canEdit ? (
                    <Button
                      disabled={isPending}
                      onClick={() => setRemoveTarget(application)}
                      size="sm"
                      type="button"
                      variant="destructive"
                    >
                      {text("移除")}
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t px-5 py-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            autoComplete="off"
            className="h-11 flex-1 font-semibold uppercase placeholder:font-normal placeholder:normal-case"
            disabled={!canEdit || isPending}
            maxLength={100}
            onChange={(event) => {
              setCode(event.target.value);
              applyIdempotencyKeyRef.current = null;
            }}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                code.trim() &&
                canEdit &&
                !isPending
              ) {
                event.preventDefault();
                requestApplyCode();
              }
            }}
            placeholder={text("输入优惠码")}
            value={code}
          />
          <Button
            className="h-11"
            disabled={!canEdit || isPending || !code.trim()}
            onClick={requestApplyCode}
            type="button"
          >
            <Icon className="h-4 w-4" name="plus" />
            {text(isPending ? "应用中…" : "应用优惠码")}
          </Button>
        </div>
        {editRestrictionMessage ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {text(editRestrictionMessage)}
          </p>
        ) : null}
      </div>

      <Dialog
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setApplyConfirmationOpen(false);
            setApplyReason("");
          }
        }}
        open={applyConfirmationOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{text("应用优惠码折扣")}</DialogTitle>
            <DialogDescription>
              {text("应用后订单金额会重新计算，操作原因将写入审计记录。")}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-muted/50 px-3 py-2 text-sm text-foreground">
            <code className="rounded bg-background px-1.5 py-0.5 text-xs font-semibold">
              {code.trim().toUpperCase()}
            </code>
          </div>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            {text("应用原因")}
            <Textarea
              className="min-h-24"
              disabled={isPending}
              maxLength={500}
              onChange={(event) => setApplyReason(event.target.value)}
              placeholder={text("填写应用优惠码的原因")}
              value={applyReason}
            />
          </label>
          <DialogFooter>
            <Button
              className="h-11"
              disabled={isPending}
              onClick={() => {
                setApplyConfirmationOpen(false);
                setApplyReason("");
              }}
              type="button"
              variant="outline"
            >
              {text("返回")}
            </Button>
            <Button
              className="h-11"
              disabled={isPending || !applyReason.trim()}
              onClick={applyCode}
              type="button"
            >
              {text(isPending ? "应用中…" : "确认应用")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setRemoveTarget(null);
            setRemoveReason("");
          }
        }}
        open={removeTarget !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{text("移除优惠码折扣")}</DialogTitle>
            <DialogDescription>
              {text("移除后订单金额会重新计算，操作原因将写入审计记录。")}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-muted/50 px-3 py-2 text-sm text-foreground">
            <span className="font-semibold">{removeTarget?.title}</span>
            {removeTarget?.code ? (
              <code className="ml-2 rounded bg-background px-1.5 py-0.5 text-xs font-semibold">
                {removeTarget.code}
              </code>
            ) : null}
          </div>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            {text("移除原因")}
            <Textarea
              className="min-h-24"
              disabled={isPending}
              maxLength={500}
              onChange={(event) => setRemoveReason(event.target.value)}
              placeholder={text("填写移除优惠码的原因")}
              value={removeReason}
            />
          </label>
          <DialogFooter>
            <Button
              className="h-11"
              disabled={isPending}
              onClick={() => {
                setRemoveTarget(null);
                setRemoveReason("");
              }}
              type="button"
              variant="outline"
            >
              {text("返回")}
            </Button>
            <Button
              className="h-11"
              disabled={isPending || !removeReason.trim()}
              onClick={removeCodeDiscount}
              type="button"
              variant="destructive"
            >
              {text(isPending ? "移除中…" : "确认移除")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function AmountSummary({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "discount" | "total";
}) {
  return (
    <div className="px-5 py-4">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div
        className={`mt-1 text-base font-semibold ${
          tone === "discount" ? "text-emerald-700" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
