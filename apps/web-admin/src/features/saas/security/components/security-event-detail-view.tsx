"use client";

import { Badge, Button } from "@cleanhub/ui";
import { ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { SaasBreadcrumbs } from "@/features/saas/shared";
import { useSaasI18n } from "@/i18n";

import { getSecurityEventDetailQuery } from "../queries";
import type { SecurityEventDetail, SecurityEventSeverity } from "../types";

function getSeverityVariant(
  severity: SecurityEventSeverity,
): "default" | "destructive" | "outline" | "secondary" {
  if (severity === "critical" || severity === "high") {
    return "destructive";
  }

  if (severity === "medium") {
    return "secondary";
  }

  return "outline";
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function SecurityEventDetailView({ eventId }: { eventId: string }) {
  const { m, formatDateTime } = useSaasI18n();
  const [securityEvent, setSecurityEvent] =
    useState<SecurityEventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvent = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setSecurityEvent(await getSecurityEventDetailQuery(eventId));
    } catch (loadError) {
      setError(getErrorMessage(loadError, m.security.events.loadError));
    } finally {
      setLoading(false);
    }
  }, [eventId, m.security.events.loadError]);

  useEffect(() => {
    let isCurrent = true;

    getSecurityEventDetailQuery(eventId)
      .then((data) => {
        if (!isCurrent) {
          return;
        }

        setSecurityEvent(data);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (isCurrent) {
          setError(getErrorMessage(loadError, m.security.events.loadError));
        }
      })
      .finally(() => {
        if (isCurrent) {
          setLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [eventId, m.security.events.loadError]);

  const breadcrumbLabel =
    securityEvent?.eventType ?? m.security.events.detailTitle;

  return (
    <section
      className="mx-auto w-full max-w-[960px] space-y-3 pb-20"
      data-testid="saas-security-event-detail-view"
    >
      <h1 className="sr-only">{breadcrumbLabel}</h1>

      <SaasBreadcrumbs
        ariaLabel={m.security.events.detailTitle}
        items={[{ label: breadcrumbLabel }]}
        rootHref={webAdminRoutes.saas.auditSecurity}
        rootIcon={ShieldCheck}
        rootLabel={m.security.events.title}
      />

      {loading ? (
        <div aria-busy="true" className="grid gap-5 pt-2">
          <div className="h-28 animate-pulse border-y bg-muted/70" />
          <div className="h-64 animate-pulse border-y bg-muted/70" />
        </div>
      ) : error || !securityEvent ? (
        <div className="border-y border-destructive/30 bg-destructive/5 px-4 py-5 text-sm text-destructive">
          <p>{error ?? m.security.events.loadError}</p>
          <Button
            className="mt-3 h-8 text-xs"
            onClick={loadEvent}
            size="sm"
            type="button"
            variant="outline"
          >
            {m.common.tryAgain}
          </Button>
        </div>
      ) : (
        <div className="grid gap-5 pt-2">
          <section className="min-w-0 border-y bg-background">
            <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
              <DetailField label={m.security.events.eventType}>
                {securityEvent.eventType}
              </DetailField>
              <DetailField label={m.security.events.severity}>
                <Badge variant={getSeverityVariant(securityEvent.severity)}>
                  {m.common.severityLabels[securityEvent.severity]}
                </Badge>
              </DetailField>
              <DetailField label={m.security.events.columns.created}>
                {formatDateTime(securityEvent.createdAt) ||
                  m.common.invalidDate}
              </DetailField>
              <DetailField label={m.security.events.columns.ip}>
                {securityEvent.ipAddress ?? m.security.events.notCaptured}
              </DetailField>
            </div>
          </section>

          <section className="min-w-0 border-y bg-background">
            <div className="grid gap-x-6 gap-y-5 p-4 sm:grid-cols-2">
              <DetailField label={m.security.events.eventId} mono>
                {securityEvent.id}
              </DetailField>
              <DetailField label={m.security.events.tenantId} mono>
                {securityEvent.tenantId ?? m.common.platform}
              </DetailField>
              <DetailField label={m.security.events.branch} mono>
                {securityEvent.branchId ?? m.common.notSet}
              </DetailField>
              <DetailField label={m.security.events.columns.actor} mono>
                {securityEvent.actorUserId ?? m.common.system}
              </DetailField>
              <DetailField
                className="sm:col-span-2"
                label={m.security.events.columns.description}
              >
                {securityEvent.description ?? m.security.events.noDescription}
              </DetailField>
              <DetailField
                className="sm:col-span-2"
                label={m.security.events.userAgent}
              >
                {securityEvent.userAgent ?? m.security.events.notCaptured}
              </DetailField>
            </div>
          </section>

          <section className="min-w-0 border-y bg-background">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold">
                {m.security.events.metadata}
              </h2>
            </div>
            <pre className="max-h-[420px] min-h-32 overflow-auto whitespace-pre-wrap break-words bg-muted/30 p-4 text-xs">
              {securityEvent.metadata
                ? JSON.stringify(securityEvent.metadata, null, 2)
                : m.security.events.noMetadata}
            </pre>
          </section>
        </div>
      )}
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
      <div
        className={`mt-1 break-all text-sm ${
          mono ? "font-mono text-xs" : "font-medium"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
