"use client";

import { Badge } from "@cleanhub/ui";
import { ScrollText } from "lucide-react";

import { webAdminRoutes } from "@/config/routes";
import { SaasBreadcrumbs } from "@/features/saas/shared";
import { useSaasI18n } from "@/i18n";

import type { OperationLogDetail, OperationLogLevel } from "../types";

function getLevelVariant(
  level: OperationLogLevel,
): "default" | "destructive" | "outline" | "secondary" {
  if (level === "error") {
    return "destructive";
  }

  if (level === "warn") {
    return "secondary";
  }

  if (level === "debug") {
    return "outline";
  }

  return "default";
}

function formatMetadata(
  value: Record<string, unknown> | null,
  fallback: string,
): string {
  return value ? JSON.stringify(value, null, 2) : fallback;
}

export function OperationLogDetailView({
  initialLog,
}: {
  initialLog: OperationLogDetail;
}) {
  const { m, formatDateTime } = useSaasI18n();

  return (
    <section
      className="mx-auto w-full max-w-[960px] space-y-7 pb-8"
      data-testid="saas-operation-log-detail-view"
    >
      <h1 className="sr-only">{initialLog.eventType}</h1>

      <SaasBreadcrumbs
        ariaLabel={m.systemLogs.detail.title}
        items={[{ label: initialLog.eventType }]}
        rootHref={webAdminRoutes.saas.system.logs}
        rootIcon={ScrollText}
        rootLabel={m.systemLogs.title}
      />

      <section className="min-w-0 border-y bg-background">
        <div className="grid gap-3 border-b px-3 py-3 sm:grid-cols-4">
          <DetailField label={m.systemLogs.columns.created}>
            {formatDateTime(initialLog.createdAt) || m.common.invalidDate}
          </DetailField>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">
              {m.systemLogs.level}
            </p>
            <div className="mt-1">
              <Badge
                className="px-1.5 py-px text-[11px]"
                variant={getLevelVariant(initialLog.level)}
              >
                {m.common.levelLabels[initialLog.level]}
              </Badge>
            </div>
          </div>
          <DetailField label={m.systemLogs.service}>
            {initialLog.service}
          </DetailField>
          <DetailField label={m.systemLogs.detail.eventType}>
            {initialLog.eventType}
          </DetailField>
        </div>

        <div className="grid gap-x-6 gap-y-4 p-3 sm:grid-cols-2">
          <DetailField label={m.systemLogs.detail.id} mono>
            {initialLog.id}
          </DetailField>
          <DetailField label={m.systemLogs.columns.request} mono>
            {initialLog.requestId ?? m.systemLogs.columns.none}
          </DetailField>
          <DetailField label={m.systemLogs.columns.tenant} mono>
            {initialLog.tenantId ?? m.common.platform}
          </DetailField>
          <DetailField label={m.systemLogs.detail.branch} mono>
            {initialLog.branchId ?? m.common.notSet}
          </DetailField>
          <DetailField label={m.systemLogs.columns.actor} mono>
            {initialLog.actorUserId ?? m.common.system}
          </DetailField>
        </div>
      </section>

      <section className="min-w-0 border-y bg-background">
        <div className="border-b px-3 py-2.5">
          <h2 className="text-sm font-semibold">
            {m.systemLogs.columns.message}
          </h2>
        </div>
        <p className="whitespace-pre-wrap break-words px-3 py-4 text-sm leading-6">
          {initialLog.message}
        </p>
      </section>

      <section className="min-w-0 border-y bg-background">
        <div className="border-b px-3 py-2.5">
          <h2 className="text-sm font-semibold">
            {m.systemLogs.detail.metadata}
          </h2>
        </div>
        <div className="p-3">
          <pre className="max-h-[32rem] min-h-32 overflow-auto border bg-muted/30 p-3 text-xs">
            {formatMetadata(
              initialLog.metadata,
              m.systemLogs.detail.noMetadata,
            )}
          </pre>
        </div>
      </section>
    </section>
  );
}

function DetailField({
  children,
  label,
  mono = false,
}: {
  children: React.ReactNode;
  label: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p
        className={`mt-1 break-all text-sm ${mono ? "font-mono text-xs" : "font-medium"}`}
      >
        {children}
      </p>
    </div>
  );
}
