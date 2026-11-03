"use client";

import { useSaasI18n } from "@/i18n";

export function TenantIdentitySummary({
  tenantId,
  tenantCode,
}: {
  tenantId: string;
  tenantCode: string;
}) {
  const { m } = useSaasI18n();
  return (
    <div className="grid gap-1 text-xs text-muted-foreground">
      <p className="break-all">
        <span>{m.tenants.detail.fields.pressingCode}: </span>
        <span className="font-medium text-foreground">{tenantCode}</span>
      </p>
      <p>{m.tenants.identity.tenantCodeHint}</p>
      <details className="mt-1">
        <summary className="w-fit cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {m.tenants.identity.systemId}
        </summary>
        <p className="mt-2 break-all font-mono text-foreground">{tenantId}</p>
        <p className="mt-1 leading-5">{m.tenants.identity.systemIdHint}</p>
      </details>
    </div>
  );
}
