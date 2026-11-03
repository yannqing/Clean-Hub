"use client";

import type { PosOfflineSaleException } from "@cleanhub/api-client";
import { useTranslation } from "@cleanhub/i18n/react";
import { Button } from "@cleanhub/ui";
import { useCallback, useEffect, useState, useTransition } from "react";

import { Icon } from "@/components/app-shell";
import { getPosApiErrorMessage } from "@/lib/api-error-message";
import { posApi } from "@/lib/api-client";
import { formatPosMoney } from "@/lib/money";
import { posToast as toast } from "@/lib/pos-toast";

import { useOfflineSync } from "./offline-sync-provider";

export function OfflineCashExceptionPanel() {
  const { locale, t } = useTranslation();
  const { retry } = useOfflineSync();
  const [items, setItems] = useState<PosOfflineSaleException[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    try {
      const result = await posApi.pos.offlineSales.list({
        status: "open",
        limit: 20,
      });
      setItems(result.data);
    } catch (error) {
      toast.error(getPosApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void load(), 0);
    const refreshTimer = window.setInterval(() => void load(), 30_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(refreshTimer);
    };
  }, [load]);

  function resolve(
    item: PosOfflineSaleException,
    action: "cash_refunded" | "retry_latest",
  ) {
    const reason = window.prompt(t("pos.cart.offlineCashReasonPrompt"))?.trim();
    if (!reason) return;
    startTransition(async () => {
      try {
        await posApi.pos.offlineSales.resolve(item.commandId, {
          action,
          reason,
        });
        toast.success(
          action === "cash_refunded"
            ? t("pos.cart.offlineCashRefunded")
            : t("pos.cart.offlineCashRecovered"),
        );
        await load();
        await retry();
      } catch (error) {
        toast.error(getPosApiErrorMessage(error));
      }
    });
  }

  if (!loading && items.length === 0) return null;

  return (
    <section className="border-y border-red-200 bg-red-50 p-4 text-red-950">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-5 shrink-0" name="alert" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">
            {t("pos.cart.offlineCashExceptions")}
          </h2>
          <p className="mt-1 text-xs leading-5 text-red-800">
            {t("pos.cart.offlineCashExceptionsHint")}
          </p>
          {loading ? (
            <p className="mt-3 text-xs">{t("pos.cart.loading")}</p>
          ) : (
            <div className="mt-3 space-y-2">
              {items.map((item) => (
                <article
                  className="rounded-md border border-red-200 bg-background p-3"
                  key={item.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">
                        #{item.orderId.slice(-8).toUpperCase()} ·{" "}
                        {formatPosMoney(
                          item.expectedTotalAmount,
                          item.currency,
                          locale,
                        )}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.failureCode ? `${item.failureCode} · ` : ""}
                        {item.failureMessage}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {t("pos.cart.offlineCashAttempts", {
                        count: item.failureCount,
                      })}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      className="h-8 px-3 text-xs"
                      disabled={isPending}
                      onClick={() => resolve(item, "retry_latest")}
                      size="sm"
                    >
                      {t("pos.cart.offlineCashRetryLatest")}
                    </Button>
                    <Button
                      className="h-8 px-3 text-xs"
                      disabled={isPending}
                      onClick={() => resolve(item, "cash_refunded")}
                      size="sm"
                      variant="outline"
                    >
                      {t("pos.cart.offlineCashMarkRefunded")}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
