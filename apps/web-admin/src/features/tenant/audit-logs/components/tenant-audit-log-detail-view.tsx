"use client";

import { Badge, Icon } from "@cleanhub/ui";
import { ChevronRight, ScrollText } from "lucide-react";
import Link from "next/link";

import { webAdminRoutes } from "@/config/routes";
import { getAuditEventDescription } from "@/features/audit/event-description";
import { useTenantI18n, useWebAdminLocale } from "@/i18n";

import type { TenantAuditLogDetail } from "../types";

function formatJson(
  value: Record<string, unknown> | null,
  fallback: string,
): string {
  return value ? JSON.stringify(value, null, 2) : fallback;
}

export function TenantAuditLogDetailView({
  initialLog,
}: {
  initialLog: TenantAuditLogDetail;
}) {
  const { m, formatDateTime } = useTenantI18n();
  const { messages } = useWebAdminLocale();
  const auditCopy = messages.common.auditEvents;
  const auditCategoryCopy = messages.common.auditCategories;
  const categoryLabel =
    auditCategoryCopy[
      initialLog.eventCategory as keyof typeof auditCategoryCopy
    ] ??
    initialLog.eventCategory
      .replace(/[._]/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());

  return (
    <section
      className="mx-auto w-full max-w-[960px] space-y-7 pb-8"
      data-testid="tenant-audit-log-detail-view"
    >
      <h1 className="sr-only">
        {getAuditEventDescription(initialLog.eventType, auditCopy)}
      </h1>
      <nav aria-label={m.auditLogs.title}>
        <ol className="flex items-center gap-2 text-sm">
          <li>
            <Link
              aria-label={m.auditLogs.title}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              href={webAdminRoutes.tenant.system.logs}
              title={m.auditLogs.title}
            >
              <Icon aria-hidden icon={ScrollText} size={16} />
            </Link>
          </li>
          <li aria-hidden className="text-muted-foreground">
            <Icon aria-hidden icon={ChevronRight} size={14} />
          </li>
          <li>
            <span aria-current="page" className="font-medium">
              {getAuditEventDescription(initialLog.eventType, auditCopy)}
            </span>
          </li>
        </ol>
      </nav>

      <section className="min-w-0 border-y bg-background">
        <div className="grid gap-3 border-b px-3 py-3 sm:grid-cols-4">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">
              {m.auditLogs.detailLabels.event}
            </p>
            <p className="mt-1 text-sm font-medium">
              {getAuditEventDescription(initialLog.eventType, auditCopy)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">
              {m.auditLogs.columns.category}
            </p>
            <p className="mt-1 text-sm font-medium">{categoryLabel}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">
              {m.auditLogs.columns.time}
            </p>
            <p className="mt-1 text-sm font-medium">
              {formatDateTime(initialLog.createdAt)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">
              {m.auditLogs.columns.result}
            </p>
            <div className="mt-1">
              <Badge variant={initialLog.success ? "default" : "destructive"}>
                {initialLog.success
                  ? m.auditLogs.successLabel
                  : m.auditLogs.failedLabel}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-3 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">
              {m.auditLogs.detailLabels.branch}
            </p>
            <p className="mt-1 break-all text-sm font-medium">
              {initialLog.branchId ?? m.auditLogs.detailLabels.tenantScope}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">
              {m.auditLogs.columns.actor}
            </p>
            <p className="mt-1 text-sm font-medium">
              {initialLog.actorDisplayName ??
                initialLog.actorUserId ??
                m.auditLogs.placeholders.systemActor}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">
              {m.auditLogs.detailLabels.userAgent}
            </p>
            <p className="mt-1 break-all text-sm">
              {initialLog.userAgent ?? m.auditLogs.detailLabels.notCaptured}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">
              {m.auditLogs.placeholders.noIp}
            </p>
            <p className="mt-1 text-sm">
              {initialLog.ipAddress ?? m.auditLogs.placeholders.noIp}
            </p>
          </div>
        </div>
      </section>

      <section className="min-w-0 border-y bg-background">
        <div className="border-b px-3 py-2.5">
          <h2 className="text-sm font-semibold">{m.auditLogs.selectedDetail}</h2>
        </div>
        <div className="grid gap-3 p-3 lg:grid-cols-3">
          <pre className="max-h-96 overflow-auto border bg-muted/30 p-3 text-xs">
            {formatJson(initialLog.before, m.auditLogs.detailLabels.noJson)}
          </pre>
          <pre className="max-h-96 overflow-auto border bg-muted/30 p-3 text-xs">
            {formatJson(initialLog.after, m.auditLogs.detailLabels.noJson)}
          </pre>
          <pre className="max-h-96 overflow-auto border bg-muted/30 p-3 text-xs">
            {formatJson(initialLog.metadata, m.auditLogs.detailLabels.noJson)}
          </pre>
        </div>
      </section>
    </section>
  );
}
