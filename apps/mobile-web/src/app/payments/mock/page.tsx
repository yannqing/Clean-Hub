"use client";

import { useCallback, useEffect, useState } from "react";
import type { TranslationKey } from "@cleanhub/i18n";
import { useTranslation } from "@cleanhub/i18n/react";
import { Button } from "@cleanhub/ui";
import { CheckCircle2, Loader2, RefreshCcw, XCircle } from "lucide-react";

import {
  getCustomerPaymentStatus,
  simulateCustomerMockPayment,
} from "@/features/customer/queries";

type PaymentState = "pending" | "paid" | "failed" | "refunded" | "unknown";

const statusLabelKeys = {
  pending: "customer.status.payment.pending",
  paid: "customer.status.payment.paid",
  failed: "customer.status.payment.failed",
  refunded: "customer.status.payment.refunded",
} satisfies Record<Exclude<PaymentState, "unknown">, TranslationKey>;

function getPaymentId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return new URLSearchParams(window.location.search).get("paymentId") ?? "";
}

function getExternalId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return new URLSearchParams(window.location.search).get("externalId") ?? "";
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function statusCopy(status: PaymentState): {
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  tone: string;
  icon: typeof CheckCircle2;
} {
  if (status === "paid") {
    return {
      titleKey: "customer.paymentMock.paidTitle",
      bodyKey: "customer.paymentMock.paidBody",
      tone: "text-emerald-700",
      icon: CheckCircle2,
    };
  }

  if (status === "failed") {
    return {
      titleKey: "customer.paymentMock.failedTitle",
      bodyKey: "customer.paymentMock.failedBody",
      tone: "text-red-700",
      icon: XCircle,
    };
  }

  if (status === "refunded") {
    return {
      titleKey: "customer.paymentMock.refundedTitle",
      bodyKey: "customer.paymentMock.refundedBody",
      tone: "text-slate-700",
      icon: RefreshCcw,
    };
  }

  return {
    titleKey: "customer.paymentMock.pendingTitle",
    bodyKey: "customer.paymentMock.pendingBody",
    tone: "text-amber-700",
    icon: Loader2,
  };
}

export default function MockPaymentPage() {
  const { t } = useTranslation();
  const [paymentId] = useState(getPaymentId);
  const [externalId] = useState(getExternalId);
  const [status, setStatus] = useState<PaymentState>("pending");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleting, setIsCompleting] = useState<"paid" | "failed" | null>(
    null,
  );
  const copy = statusCopy(status);
  const Icon = copy.icon;

  const refreshStatus = useCallback(async () => {
    if (!paymentId) {
      setStatus("unknown");
      setError(t("common.errors.missingPaymentId"));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getCustomerPaymentStatus(paymentId);
      setStatus(result.transaction.paymentStatus as PaymentState);
    } catch (nextError) {
      setError(
        getErrorMessage(nextError, t("customer.paymentMock.statusUnavailable")),
      );
    } finally {
      setIsLoading(false);
    }
  }, [paymentId, t]);

  const completeMockPayment = useCallback(
    async (nextStatus: "paid" | "failed") => {
      if (!paymentId) {
        setStatus("unknown");
        setError(t("common.errors.missingPaymentId"));
        return;
      }

      setIsCompleting(nextStatus);
      setError(null);

      try {
        await simulateCustomerMockPayment(paymentId, nextStatus);
        await refreshStatus();
      } catch (nextError) {
        setError(
          getErrorMessage(nextError, t("customer.paymentMock.callbackUnavailable")),
        );
      } finally {
        setIsCompleting(null);
      }
    },
    [paymentId, refreshStatus, t],
  );

  useEffect(() => {
    const initial = window.setTimeout(() => {
      void refreshStatus();
    }, 0);
    const interval = window.setInterval(() => {
      void refreshStatus();
    }, 4000);

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [refreshStatus]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-[max(24px,env(safe-area-inset-top))]">
      <section className="mt-10 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div
          className={`flex size-12 items-center justify-center rounded-md bg-slate-50 ${copy.tone}`}
        >
          <Icon
            className={`size-6 ${status === "pending" ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-slate-950">
          {t(copy.titleKey)}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{t(copy.bodyKey)}</p>

        <dl className="mt-5 space-y-3 rounded-md bg-slate-50 p-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">
              {t("customer.paymentMock.payment")}
            </dt>
            <dd className="break-all font-medium text-slate-950">
              {paymentId || "-"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">{t("customer.paymentMock.gateway")}</dt>
            <dd className="break-all font-medium text-slate-950">
              {externalId || "-"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">{t("common.status")}</dt>
            <dd className="font-medium text-slate-950">
              {status === "unknown"
                ? t("common.unavailable")
                : t(statusLabelKeys[status])}
            </dd>
          </div>
        </dl>

        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-5 grid gap-2">
          <Button
            className="h-11 w-full"
            disabled={status !== "pending" || Boolean(isCompleting)}
            type="button"
            onClick={() => void completeMockPayment("paid")}
          >
            {isCompleting === "paid" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="size-4" aria-hidden="true" />
            )}
            {t("customer.paymentMock.confirmPayment")}
          </Button>
          <Button
            className="h-11 w-full"
            disabled={status !== "pending" || Boolean(isCompleting)}
            type="button"
            variant="outline"
            onClick={() => void completeMockPayment("failed")}
          >
            {isCompleting === "failed" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <XCircle className="size-4" aria-hidden="true" />
            )}
            {t("customer.paymentMock.simulateFailure")}
          </Button>
          <Button
            className="h-11 w-full"
            disabled={isLoading}
            type="button"
            variant="ghost"
            onClick={() => void refreshStatus()}
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCcw className="size-4" aria-hidden="true" />
            )}
            {t("common.refresh")}
          </Button>
        </div>
      </section>
    </main>
  );
}
