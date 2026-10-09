"use client";

import type {
  ServiceSummary,
  TenantOrderDetail,
  TenantOrderItem,
  TenantOrderPaymentTransaction,
} from "@cleanhub/api-client";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Icon,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from "@cleanhub/ui";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { interpolate, useTenantI18n } from "@/i18n";
import { formatMoney } from "@/lib/format";

import {
  createTenantOrderItemAction,
  createTenantOrderPaymentCorrectionAction,
  createTenantOrderRefundAction,
  deleteTenantOrderItemAction,
  updateTenantOrderItemAction,
} from "../actions";

type ItemEditorProps = {
  item: TenantOrderItem | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  order: TenantOrderDetail;
  services: ServiceSummary[];
};

function optionalText(value: string): string | null {
  const normalized = value.trim();
  return normalized || null;
}

export function TenantOrderItemEditorDialog({
  item,
  onOpenChange,
  open,
  order,
  services,
}: ItemEditorProps) {
  const { locale, m } = useTenantI18n();
  const router = useRouter();
  const initialService = item
    ? services.find((service) => service.id === item.serviceId)
    : services[0];
  const [serviceId, setServiceId] = useState(initialService?.id ?? "");
  const [quantity, setQuantity] = useState(item?.quantity ?? "1");
  const [weight, setWeight] = useState(item?.weight ?? "1");
  const [bagCount, setBagCount] = useState(String(item?.bagCount ?? 1));
  const [chargedUnitAmount, setChargedUnitAmount] = useState(
    item?.chargedUnitAmount ?? initialService?.standardPrice ?? "",
  );
  const [overrideReason, setOverrideReason] = useState("");
  const [itemColor, setItemColor] = useState(item?.itemColor ?? "");
  const [itemIdentifier, setItemIdentifier] = useState(
    item?.itemIdentifier ?? "",
  );
  const [defectNotes, setDefectNotes] = useState(item?.defectNotes ?? "");
  const [specialRequest, setSpecialRequest] = useState(
    item?.specialRequest ?? "",
  );
  const [submitting, setSubmitting] = useState(false);

  const selectedService = useMemo(
    () => services.find((service) => service.id === serviceId) ?? null,
    [serviceId, services],
  );
  const standardUnitAmount =
    item && item.serviceId === selectedService?.id
      ? item.standardUnitAmount
      : (selectedService?.standardPrice ?? "0");
  const customPrice = Number(chargedUnitAmount) !== Number(standardUnitAmount);

  function changeService(nextServiceId: string) {
    const service = services.find(
      (candidate) => candidate.id === nextServiceId,
    );
    setServiceId(nextServiceId);
    setChargedUnitAmount(service?.standardPrice ?? "");
    setOverrideReason("");
  }

  const quantityIsValid =
    selectedService?.pricingUnit === "per_kg"
      ? Number(weight) > 0 &&
        Number.isInteger(Number(bagCount)) &&
        Number(bagCount) > 0
      : Number.isInteger(Number(quantity)) && Number(quantity) > 0;
  const priceIsValid = Number(chargedUnitAmount) > 0;
  const canSubmit =
    Boolean(selectedService) &&
    quantityIsValid &&
    priceIsValid &&
    (!customPrice || Boolean(overrideReason.trim()));

  async function submit() {
    if (!selectedService || !canSubmit || submitting) return;
    setSubmitting(true);

    const common = {
      serviceId: selectedService.id,
      ...(selectedService.pricingUnit === "per_kg"
        ? { weight, bagCount: Number(bagCount) }
        : { quantity }),
    };
    const priceChanged =
      !item ||
      item.serviceId !== selectedService.id ||
      Number(item.chargedUnitAmount) !== Number(chargedUnitAmount);
    const pricing = priceChanged
      ? {
          chargedUnitAmount: Number(chargedUnitAmount).toFixed(2),
          ...(customPrice ? { overrideReason: overrideReason.trim() } : {}),
        }
      : {};

    try {
      const result = item
        ? await updateTenantOrderItemAction(order.id, item.id, {
            ...common,
            ...pricing,
            itemColor: optionalText(itemColor),
            itemIdentifier: optionalText(itemIdentifier),
            defectNotes: optionalText(defectNotes),
            specialRequest: optionalText(specialRequest),
            version: item.version,
          })
        : await createTenantOrderItemAction(order.id, {
            ...common,
            ...pricing,
            ...(itemColor.trim() ? { itemColor: itemColor.trim() } : {}),
            ...(itemIdentifier.trim()
              ? { itemIdentifier: itemIdentifier.trim() }
              : {}),
            ...(defectNotes.trim() ? { defectNotes: defectNotes.trim() } : {}),
            ...(specialRequest.trim()
              ? { specialRequest: specialRequest.trim() }
              : {}),
          });

      if (!result.ok) {
        toast.error(result.message || m.orders.detail.itemEditor.saveError);
        return;
      }
      toast.success(
        item
          ? m.orders.detail.itemEditor.updateSuccess
          : m.orders.detail.itemEditor.createSuccess,
      );
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error(m.orders.detail.itemEditor.saveError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!submitting) onOpenChange(nextOpen);
      }}
      open={open}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {item
              ? m.orders.detail.itemEditor.editTitle
              : m.orders.detail.itemEditor.addTitle}
          </DialogTitle>
          <DialogDescription>
            {m.orders.detail.itemEditor.description}
          </DialogDescription>
        </DialogHeader>

        {services.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            {m.orders.detail.itemEditor.noServices}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <label
                className="text-sm font-medium"
                htmlFor="order-item-service"
              >
                {m.orders.detail.itemEditor.serviceLabel}
              </label>
              <Select
                disabled={submitting}
                onValueChange={changeService}
                value={serviceId}
              >
                <SelectTrigger id="order-item-service">
                  <SelectValue
                    placeholder={m.orders.detail.itemEditor.servicePlaceholder}
                  />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name} ·{" "}
                      {formatMoney(
                        Number(service.standardPrice),
                        service.currency,
                        locale,
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedService?.pricingUnit === "per_kg" ? (
              <>
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium"
                    htmlFor="order-item-weight"
                  >
                    {m.orders.detail.itemEditor.weightLabel}
                  </label>
                  <Input
                    disabled={submitting}
                    id="order-item-weight"
                    inputMode="decimal"
                    min="0.001"
                    onChange={(event) => setWeight(event.target.value)}
                    step="0.001"
                    type="number"
                    value={weight}
                  />
                </div>
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium"
                    htmlFor="order-item-bags"
                  >
                    {m.orders.detail.itemEditor.bagCountLabel}
                  </label>
                  <Input
                    disabled={submitting}
                    id="order-item-bags"
                    inputMode="numeric"
                    min="1"
                    onChange={(event) => setBagCount(event.target.value)}
                    step="1"
                    type="number"
                    value={bagCount}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="order-item-quantity"
                >
                  {m.orders.detail.itemEditor.quantityLabel}
                </label>
                <Input
                  disabled={submitting}
                  id="order-item-quantity"
                  inputMode="numeric"
                  min="1"
                  onChange={(event) => setQuantity(event.target.value)}
                  step="1"
                  type="number"
                  value={quantity}
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="order-item-price">
                {m.orders.detail.itemEditor.unitPriceLabel}
              </label>
              <div className="relative">
                <Input
                  disabled={submitting}
                  id="order-item-price"
                  inputMode="decimal"
                  min="0.01"
                  onChange={(event) => setChargedUnitAmount(event.target.value)}
                  step="0.01"
                  type="number"
                  value={chargedUnitAmount}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {order.currency}
                </span>
              </div>
            </div>

            {customPrice ? (
              <div className="space-y-2 sm:col-span-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="order-item-override-reason"
                >
                  {m.orders.detail.itemEditor.overrideReasonLabel}
                </label>
                <Textarea
                  disabled={submitting}
                  id="order-item-override-reason"
                  maxLength={500}
                  onChange={(event) => setOverrideReason(event.target.value)}
                  placeholder={
                    m.orders.detail.itemEditor.overrideReasonPlaceholder
                  }
                  value={overrideReason}
                />
                <p className="text-xs text-muted-foreground">
                  {interpolate(m.orders.detail.itemEditor.standardPriceHint, {
                    amount: formatMoney(
                      Number(standardUnitAmount),
                      order.currency,
                      locale,
                    ),
                  })}
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="order-item-color">
                {m.orders.detail.itemColor}
              </label>
              <Input
                disabled={submitting}
                id="order-item-color"
                maxLength={40}
                onChange={(event) => setItemColor(event.target.value)}
                value={itemColor}
              />
            </div>
            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="order-item-identifier"
              >
                {m.orders.detail.itemIdentifier}
              </label>
              <Input
                disabled={submitting}
                id="order-item-identifier"
                maxLength={64}
                onChange={(event) => setItemIdentifier(event.target.value)}
                value={itemIdentifier}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label
                className="text-sm font-medium"
                htmlFor="order-item-defects"
              >
                {m.orders.detail.defectNotes}
              </label>
              <Textarea
                disabled={submitting}
                id="order-item-defects"
                maxLength={2000}
                onChange={(event) => setDefectNotes(event.target.value)}
                value={defectNotes}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label
                className="text-sm font-medium"
                htmlFor="order-item-request"
              >
                {m.orders.detail.specialRequest}
              </label>
              <Textarea
                disabled={submitting}
                id="order-item-request"
                maxLength={2000}
                onChange={(event) => setSpecialRequest(event.target.value)}
                value={specialRequest}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            disabled={submitting}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            {m.common.cancel}
          </Button>
          <Button
            disabled={!canSubmit || submitting}
            onClick={submit}
            type="button"
          >
            {submitting ? (
              <Icon
                aria-hidden
                className="animate-spin"
                icon={LoaderCircle}
                size={15}
              />
            ) : null}
            {submitting
              ? m.orders.detail.actions.submitting
              : m.orders.detail.itemEditor.saveAction}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TenantOrderItemDeleteDialog({
  item,
  onOpenChange,
  orderId,
}: {
  item: TenantOrderItem | null;
  onOpenChange: (open: boolean) => void;
  orderId: string;
}) {
  const { m } = useTenantI18n();
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!item || !reason.trim() || submitting) return;
    setSubmitting(true);
    try {
      const result = await deleteTenantOrderItemAction(
        orderId,
        item.id,
        reason.trim(),
      );
      if (!result.ok) {
        toast.error(result.message || m.orders.detail.itemEditor.deleteError);
        return;
      }
      toast.success(m.orders.detail.itemEditor.deleteSuccess);
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error(m.orders.detail.itemEditor.deleteError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!submitting) onOpenChange(open);
      }}
      open={item !== null}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.orders.detail.itemEditor.deleteTitle}</DialogTitle>
          <DialogDescription>
            {interpolate(m.orders.detail.itemEditor.deleteDescription, {
              item: item?.itemName ?? "",
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="delete-item-reason">
            {m.orders.detail.itemEditor.deleteReasonLabel}
          </label>
          <Textarea
            disabled={submitting}
            id="delete-item-reason"
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            placeholder={m.orders.detail.itemEditor.deleteReasonPlaceholder}
            value={reason}
          />
        </div>
        <DialogFooter>
          <Button
            disabled={submitting}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            {m.common.cancel}
          </Button>
          <Button
            disabled={!reason.trim() || submitting}
            onClick={submit}
            type="button"
            variant="destructive"
          >
            {submitting ? (
              <Icon
                aria-hidden
                className="animate-spin"
                icon={LoaderCircle}
                size={15}
              />
            ) : null}
            {m.orders.detail.itemEditor.deleteAction}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type PaymentAdjustmentTarget = {
  mode: "refund" | "correction";
  payment: TenantOrderPaymentTransaction;
};

export function TenantOrderPaymentAdjustmentDialog({
  onOpenChange,
  order,
  target,
}: {
  onOpenChange: (open: boolean) => void;
  order: TenantOrderDetail;
  target: PaymentAdjustmentTarget | null;
}) {
  const { locale, m } = useTenantI18n();
  const router = useRouter();
  const [direction, setDirection] = useState<"debit" | "credit">("debit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const refundedForPayment = target
    ? order.paymentAdjustments
        .filter(
          (adjustment) =>
            adjustment.adjustmentType === "refund" &&
            adjustment.direction === "debit" &&
            adjustment.originalPaymentId === target.payment.id,
        )
        .reduce((total, adjustment) => total + Number(adjustment.amount), 0)
    : 0;
  const maxAmount = target
    ? target.mode === "refund"
      ? Math.max(
          0,
          Math.min(
            Number(target.payment.amount) - refundedForPayment,
            Number(order.paidAmount),
          ),
        )
      : direction === "debit"
        ? Number(order.paidAmount)
        : Math.max(0, Number(order.totalAmount) - Number(order.paidAmount))
    : 0;
  const normalizedAmount = Number(amount);
  const canSubmit =
    Number.isFinite(normalizedAmount) &&
    normalizedAmount > 0 &&
    normalizedAmount <= maxAmount &&
    Boolean(reason.trim());

  async function submit() {
    if (!target || !canSubmit || submitting) return;
    setSubmitting(true);
    const common = {
      originalPaymentId: target.payment.id,
      amount: normalizedAmount.toFixed(2),
      idempotencyKey: crypto.randomUUID(),
      reason: reason.trim(),
    };

    try {
      const result =
        target.mode === "refund"
          ? await createTenantOrderRefundAction(order.id, common)
          : await createTenantOrderPaymentCorrectionAction(order.id, {
              ...common,
              direction,
            });
      if (!result.ok) {
        toast.error(
          result.message || m.orders.detail.paymentAdjustments.saveError,
        );
        return;
      }
      toast.success(
        target.mode === "refund"
          ? m.orders.detail.paymentAdjustments.refundSuccess
          : m.orders.detail.paymentAdjustments.correctionSuccess,
      );
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error(m.orders.detail.paymentAdjustments.saveError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!submitting) onOpenChange(open);
      }}
      open={target !== null}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {target?.mode === "refund"
              ? m.orders.detail.paymentAdjustments.refundTitle
              : m.orders.detail.paymentAdjustments.correctionTitle}
          </DialogTitle>
          <DialogDescription>
            {m.orders.detail.paymentAdjustments.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {target?.mode === "correction" ? (
            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="adjustment-direction"
              >
                {m.orders.detail.paymentAdjustments.directionLabel}
              </label>
              <Select
                disabled={submitting}
                onValueChange={(value) => {
                  setDirection(value as "debit" | "credit");
                  setAmount("");
                }}
                value={direction}
              >
                <SelectTrigger id="adjustment-direction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debit">
                    {m.orders.detail.paymentAdjustments.directionLabels.debit}
                  </SelectItem>
                  <SelectItem value="credit">
                    {m.orders.detail.paymentAdjustments.directionLabels.credit}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="adjustment-amount">
              {m.orders.detail.paymentAdjustments.amountLabel}
            </label>
            <div className="relative">
              <Input
                disabled={submitting || maxAmount <= 0}
                id="adjustment-amount"
                inputMode="decimal"
                max={maxAmount.toFixed(2)}
                min="0.01"
                onChange={(event) => setAmount(event.target.value)}
                step="0.01"
                type="number"
                value={amount}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {order.currency}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {interpolate(m.orders.detail.paymentAdjustments.maximumHint, {
                amount: formatMoney(maxAmount, order.currency, locale),
              })}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="adjustment-reason">
              {m.orders.detail.paymentAdjustments.reasonLabel}
            </label>
            <Textarea
              disabled={submitting}
              id="adjustment-reason"
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              placeholder={m.orders.detail.paymentAdjustments.reasonPlaceholder}
              value={reason}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            disabled={submitting}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            {m.common.cancel}
          </Button>
          <Button
            disabled={!canSubmit || submitting}
            onClick={submit}
            type="button"
            variant={target?.mode === "refund" ? "destructive" : "default"}
          >
            {submitting ? (
              <Icon
                aria-hidden
                className="animate-spin"
                icon={LoaderCircle}
                size={15}
              />
            ) : null}
            {m.orders.detail.paymentAdjustments.confirmAction}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
