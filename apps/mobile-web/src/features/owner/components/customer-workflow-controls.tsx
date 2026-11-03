"use client";

import { useState } from "react";
import type { MobileRefundSettlementPlan } from "@cleanhub/api-client";
import { useTranslation } from "@cleanhub/i18n/react";
import {
  Button,
  Input,
  Label,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  toast,
} from "@cleanhub/ui";
import { Loader2 } from "lucide-react";
import { formatTenantMoney } from "@/lib/currency";
import {
  getRefundSettlement,
  receiveAppointment,
  settleRefund,
} from "../actions/customer-workflows.actions";

export function RefundSettlementControl({
  requestId,
  onDone,
}: {
  requestId: string;
  onDone: () => void | Promise<void>;
}) {
  const { locale, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<MobileRefundSettlementPlan | null>(null);
  const [cashReturned, setCashReturned] = useState(false);
  const [references, setReferences] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    setOpen(true);
    setPlan(null);
    setCashReturned(false);
    setReferences({});
    setBusy(true);
    setError(null);
    try {
      setPlan(await getRefundSettlement(requestId));
    } catch (error) {
      setError(
        error instanceof Error ? error.message : t("common.errors.genericLoad"),
      );
    } finally {
      setBusy(false);
    }
  }
  const ready =
    plan?.canSettle &&
    plan.allocations.every((a) =>
      a.paymentMethod === "cash"
        ? cashReturned
        : Boolean(references[a.paymentId]?.trim()),
    );
  return (
    <>
      <Button
        className="mt-3 w-full"
        disabled={busy}
        onClick={() => void load()}
      >
        {t("common.readiness.settleRefund")}
      </Button>
      <Sheet
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <SheetContent className="max-h-[95dvh] overflow-y-auto p-5">
          <SheetHeader>
            <SheetTitle>{t("common.readiness.settleRefund")}</SheetTitle>
          </SheetHeader>
          <p className="my-4 text-sm text-slate-600">
            {t("common.readiness.refundHelp")}
          </p>
          {busy ? (
            <Loader2
              className="size-5 animate-spin"
              aria-label={t("common.loading")}
            />
          ) : null}
          {error ? (
            <p role="alert" className="my-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          {plan ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!ready || busy) return;
                setBusy(true);
                setError(null);
                void settleRefund(requestId, {
                  cashReturned,
                  providerReferences: references,
                })
                  .then(async () => {
                    toast.success(t("common.readiness.refundRecorded"));
                    setOpen(false);
                    await onDone();
                  })
                  .catch((error) =>
                    setError(
                      error instanceof Error
                        ? error.message
                        : t("common.errors.genericAction"),
                    ),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              <p className="font-semibold">
                {formatTenantMoney(plan.amount, locale, plan.currency)}
              </p>
              {!plan.canSettle ? (
                <p role="alert">{t("common.readiness.refundBalanceChanged")}</p>
              ) : null}
              {plan.allocations.map((a) => (
                <div
                  className="space-y-2 rounded-md border p-3"
                  key={a.paymentId}
                >
                  <p>
                    {a.paymentMethod === "cash"
                      ? t("pos.order.paymentMethod.cash")
                      : a.paymentMethod === "card"
                        ? t("pos.order.paymentMethod.card")
                        : a.paymentMethod === "app"
                          ? t("pos.order.paymentMethod.app")
                          : t("common.unavailable")}{" "}
                    · {formatTenantMoney(a.amount, locale, a.currency)}
                  </p>
                  {a.paymentMethod === "cash" ? (
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={cashReturned}
                        onChange={(e) => setCashReturned(e.target.checked)}
                      />
                      {t("common.readiness.cashReturned")}
                    </label>
                  ) : (
                    <>
                      <Label htmlFor={a.paymentId}>
                        {t("common.readiness.providerReference")}
                      </Label>
                      <Input
                        id={a.paymentId}
                        required
                        maxLength={160}
                        value={references[a.paymentId] ?? ""}
                        onChange={(e) =>
                          setReferences((current) => ({
                            ...current,
                            [a.paymentId]: e.target.value,
                          }))
                        }
                      />
                    </>
                  )}
                </div>
              ))}
              <Button
                type="submit"
                className="w-full"
                disabled={!ready || busy}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                {t("common.readiness.settleRefund")}
              </Button>
            </form>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

export function AppointmentReceptionControl({
  appointmentId,
  onDone,
}: {
  appointmentId: string;
  onDone: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"laundry" | "car_wash">("laundry");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button
        variant="outline"
        className="mt-3 w-full"
        onClick={() => setOpen(true)}
      >
        {t("common.readiness.receiveItems")}
      </Button>
      <Sheet
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <SheetContent className="p-5">
          <SheetHeader>
            <SheetTitle>{t("common.readiness.receiveItems")}</SheetTitle>
          </SheetHeader>
          <p className="my-4 text-sm text-slate-600">
            {t("common.readiness.receiveHelp")}
          </p>
          <Label htmlFor="receive-type">
            {t("common.readiness.businessType")}
          </Label>
          <select
            id="receive-type"
            className="my-3 h-11 w-full rounded-md border bg-white px-3"
            value={type}
            onChange={(event) => setType(event.target.value as typeof type)}
          >
            <option value="laundry">{t("common.readiness.laundry")}</option>
            <option value="car_wash">{t("common.readiness.carWash")}</option>
          </select>
          {error ? (
            <p role="alert" className="my-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <Button
            className="w-full"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError(null);
              void receiveAppointment(appointmentId, type)
                .then(async () => {
                  setOpen(false);
                  toast.success(t("common.readiness.receiveSuccess"));
                  await onDone();
                })
                .catch((error) =>
                  setError(
                    error instanceof Error
                      ? error.message
                      : t("common.errors.genericAction"),
                  ),
                )
                .finally(() => setBusy(false));
            }}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("common.readiness.receiveItems")}
          </Button>
        </SheetContent>
      </Sheet>
    </>
  );
}
