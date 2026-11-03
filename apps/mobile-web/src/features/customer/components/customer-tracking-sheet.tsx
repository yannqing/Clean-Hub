"use client";
import { useEffect, useState } from "react";
import type {
  MobileCustomerTracking,
  MobileDeliveryTaskStatus,
} from "@cleanhub/api-client";
import { useTranslation } from "@cleanhub/i18n/react";
import { Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@cleanhub/ui";
import { apiClient } from "@/lib/api-client";
import { cachedCustomerQuery } from "../lib/customer-cache";
import { formatDateTime } from "../lib/format";

export function CustomerTrackingSheet({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [tracking, setTracking] = useState<MobileCustomerTracking | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    let active = true;
    let loading = false;

    const load = async () => {
      if (loading || document.visibilityState !== "visible") return;
      loading = true;
      setBusy(true);
      try {
        const result = await cachedCustomerQuery(`appointment:${id}`, () =>
          apiClient.mobile.customer.getAppointment(id),
        );
        if (active) {
          setTracking(result);
          setError(
            result.cachedAt
              ? t("common.readiness.offlineData", {
                  time: formatDateTime(result.cachedAt),
                })
              : null,
          );
        }
      } catch (error) {
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : t("common.errors.genericLoad"),
          );
      } finally {
        loading = false;
        if (active) setBusy(false);
      }
    };
    const initial = window.setTimeout(() => {
      setTracking(null);
      void load();
    }, 0);
    const timer = window.setInterval(() => void load(), 30_000);
    const refresh = () => void load();
    window.addEventListener("cleanhub:notification", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.removeEventListener("cleanhub:notification", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [id, t]);
  return (
    <Sheet
      open={Boolean(id)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="max-h-[95dvh] overflow-y-auto p-5">
        <SheetHeader>
          <SheetTitle>{t("common.readiness.deliveryProgress")}</SheetTitle>
        </SheetHeader>
        {busy ? (
          <Loader2
            className="my-4 size-5 animate-spin"
            aria-label={t("common.loading")}
          />
        ) : null}
        {error ? (
          <p role="status" className="my-3 text-sm text-amber-800">
            {error}
          </p>
        ) : null}
        {tracking ? (
          <div className="mt-4 space-y-4 text-sm">
            <p>{tracking.address}</p>
            <p>{formatDateTime(tracking.expectedAt)}</p>
            <p>{t(`customer.status.appointment.${tracking.status}`)}</p>
            {tracking.deliveryStatus ? (
              <p className="font-semibold">
                {t(
                  `delivery.status.${tracking.deliveryStatus as MobileDeliveryTaskStatus}`,
                )}
              </p>
            ) : null}
            {tracking.cancellationReason ? (
              <p>{tracking.cancellationReason}</p>
            ) : null}
            <ol className="space-y-3 border-l pl-4">
              {tracking.events.map((event, index) => (
                <li key={`${event.occurredAt}:${index}`}>
                  <p>
                    {t(
                      `delivery.status.${event.status as MobileDeliveryTaskStatus}`,
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(event.occurredAt)}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
