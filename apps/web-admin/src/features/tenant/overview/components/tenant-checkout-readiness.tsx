"use client";

import type { TenantCheckoutReadiness } from "@cleanhub/api-client";
import { Button } from "@cleanhub/ui";
import { useCallback, useEffect, useState } from "react";

import { CheckoutReadinessCard } from "@/features/shared/checkout-readiness/components/checkout-readiness-card";
import { useTenantI18n } from "@/i18n";
import { getTenantOverviewQuery } from "../queries/get-tenant-overview.query";

export function TenantCheckoutReadinessPanel() {
  const { locale } = useTenantI18n();
  const [readiness, setReadiness] = useState<TenantCheckoutReadiness | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => { setLoading(true); setRevision((value) => value + 1); }, []);
  useEffect(() => {
    const controller = new AbortController();
    getTenantOverviewQuery({ signal: controller.signal })
      .then((overview) => { if (!controller.signal.aborted) { setReadiness(overview.checkoutReadiness); setFailed(false); } })
      .catch(() => { if (!controller.signal.aborted) { setFailed(true); setReadiness(null); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => {
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);
  const m = locale === "zh-CN"
    ? { loading: "正在检查收银配置…", failed: "无法确认开店就绪状态，请重新检查。", retry: "重新检查" }
    : locale === "fr"
      ? { loading: "Vérification des paramètres…", failed: "Impossible de vérifier la préparation du magasin.", retry: "Réessayer" }
      : { loading: "Checking checkout settings…", failed: "Store readiness could not be verified. Check again.", retry: "Check again" };
  return <div className="mx-auto mb-6 w-full max-w-5xl" aria-busy={loading}>
    {readiness ? <CheckoutReadinessCard readiness={readiness} locale={locale} onRefresh={refresh} />
      : <div className="flex items-center justify-between gap-3 rounded-xl border p-4 text-sm text-muted-foreground">
        <span>{failed ? m.failed : m.loading}</span>
        {failed ? <Button type="button" variant="outline" size="sm" disabled={loading} onClick={refresh}>{m.retry}</Button> : null}
      </div>}
  </div>;
}
