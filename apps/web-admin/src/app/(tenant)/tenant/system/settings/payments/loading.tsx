"use client";

import { useTenantI18n } from "@/i18n";

export default function TenantPaymentSettingsLoading() {
  const { m } = useTenantI18n();
  return (
    <div className="grid max-w-[920px] gap-4" role="status">
      <div className="h-32 animate-pulse rounded-xl bg-white" />
      <div className="h-64 animate-pulse rounded-xl bg-white" />
      <div className="h-64 animate-pulse rounded-xl bg-white" />
      <span className="sr-only">{m.common.loading}</span>
    </div>
  );
}
