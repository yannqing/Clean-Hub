"use client";

import { Badge } from "@cleanhub/ui";
import { ScrollText } from "lucide-react";

import { webAdminRoutes } from "@/config/routes";
import { getAuditEventDescription } from "@/features/audit/event-description";
import { SaasBreadcrumbs } from "@/features/saas/shared";
import { useSaasI18n } from "@/i18n";

import type { AuditLogDetail } from "../types";

function formatJson(
  value: Record<string, unknown> | null,
  fallback: string,
): string {
  return value ? JSON.stringify(value, null, 2) : fallback;
}

export function SaasAuditLogDetailView({
  initialLog,
}: {
  initialLog: AuditLogDetail;
}) {
  const { locale, m, formatDateTime } = useSaasI18n();
  const eventLabel = getAuditEventDescription(initialLog.eventType, locale);
  const localCopy =
    locale === "zh-CN"
      ? {
          branch: "门店",
          changeData: "数据变更",
          metadata: "元数据",
          noData: "无数据",
          notCaptured: "未记录",
          userAgent: "用户代理",
        }
      : {
          branch: "Branch",
          changeData: "Data changes",
          metadata: "Metadata",
          noData: "No data",
          notCaptured: "Not captured",
          userAgent: "User agent",
        };
  const categoryLabel =
    initialLog.eventCategory === "auth"
      ? m.common.auditCategoryLabels.auth
      : initialLog.eventCategory === "saas_platform"
        ? m.common.auditCategoryLabels.saasPlatform
        : initialLog.eventCategory === "saas_tenant"
          ? m.common.auditCategoryLabels.saasTenant
          : initialLog.eventCategory === "saas_user"
            ? m.common.auditCategoryLabels.saasUser
            : initialLog.eventCategory;

  return (
    <section
      className="mx-auto w-full max-w-[960px] space-y-7 pb-8"
      data-testid="saas-audit-log-detail-view"
    >
      <h1 className="sr-only">{eventLabel}</h1>

      <SaasBreadcrumbs
        ariaLabel={m.auditLogs.title}
        items={[{ label: eventLabel }]}
        rootHref={webAdminRoutes.saas.auditLogs}
        rootIcon={ScrollText}
        rootLabel={m.auditLogs.title}
      />

      <section className="min-w-0 border-y bg-background">
        <div className="grid gap-3 border-b px-3 py-3 sm:grid-cols-4">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">
              {m.auditLogs.columns.event}
            </p>
            <p className="mt-1 text-sm font-medium">{eventLabel}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">
              {m.auditLogs.category}
            </p>
            <p className="mt-1 text-sm font-medium">{categoryLabel}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">
              {m.auditLogs.columns.created}
            </p>
            <p className="mt-1 text-sm font-medium">
              {formatDateTime(initialLog.createdAt) || m.common.invalidDate}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">
              {m.auditLogs.result}
            </p>
            <div className="mt-1">
              <Badge
                className="px-1.5 py-px text-[11px]"
                variant={initialLog.success ? "default" : "destructive"}
              >
                {initialLog.success
                  ? m.common.resultLabels.success
                  : m.common.resultLabels.failed}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid gap-x-6 gap-y-4 p-3 sm:grid-cols-2">
          <DetailField label={m.auditLogs.detail.id} mono>
            {initialLog.id}
          </DetailField>
          <DetailField label={m.auditLogs.detail.tenant} mono>
            {initialLog.tenantId ?? m.common.platform}
          </DetailField>
          <DetailField label={localCopy.branch} mono>
            {initialLog.branchId ?? m.common.notSet}
          </DetailField>
          <DetailField label={m.auditLogs.columns.actor}>
            {initialLog.actorDisplayName ??
              initialLog.actorUserId ??
              m.common.system}
          </DetailField>
          <DetailField label={m.auditLogs.detail.entityType}>
            {initialLog.entityType ?? m.common.notSet}
          </DetailField>
          <DetailField label={m.auditLogs.detail.entityId} mono>
            {initialLog.entityId ?? m.common.notSet}
          </DetailField>
          <DetailField label={m.auditLogs.detail.ipAddress}>
            {initialLog.ipAddress ?? localCopy.notCaptured}
          </DetailField>
          <DetailField label={localCopy.userAgent}>
            {initialLog.userAgent ?? localCopy.notCaptured}
          </DetailField>
          {initialLog.reason ? (
            <DetailField
              className="sm:col-span-2"
              label={m.auditLogs.detail.reason}
            >
              {initialLog.reason}
            </DetailField>
          ) : null}
        </div>
      </section>

      <section className="min-w-0 border-y bg-background">
        <div className="border-b px-3 py-2.5">
          <h2 className="text-sm font-semibold">{localCopy.changeData}</h2>
        </div>
        <div className="grid gap-3 p-3 lg:grid-cols-3">
          <JsonBlock
            fallback={localCopy.noData}
            label={m.auditLogs.detail.before}
            value={initialLog.before}
          />
          <JsonBlock
            fallback={localCopy.noData}
            label={m.auditLogs.detail.after}
            value={initialLog.after}
          />
          <JsonBlock
            fallback={localCopy.noData}
            label={localCopy.metadata}
            value={initialLog.metadata}
          />
        </div>
      </section>
    </section>
  );
}

function DetailField({
  children,
  className,
  label,
  mono = false,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
  mono?: boolean;
}) {
  return (
    <div className={className}>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p
        className={`mt-1 break-all text-sm ${mono ? "font-mono text-xs" : "font-medium"}`}
      >
        {children}
      </p>
    </div>
  );
}

function JsonBlock({
  fallback,
  label,
  value,
}: {
  fallback: string;
  label: string;
  value: Record<string, unknown> | null;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-[11px] font-medium text-muted-foreground">
        {label}
      </p>
      <pre className="max-h-96 min-h-32 overflow-auto border bg-muted/30 p-3 text-xs">
        {formatJson(value, fallback)}
      </pre>
    </div>
  );
}
