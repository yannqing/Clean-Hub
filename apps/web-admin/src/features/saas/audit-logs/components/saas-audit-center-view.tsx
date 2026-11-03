"use client";

import { ScrollText } from "lucide-react";
import Link from "next/link";

import { webAdminRoutes } from "@/config/routes";
import { SaasPageHeader } from "@/features/saas/shared";
import { SecurityEventListView } from "@/features/saas/security/components";
import { useSaasI18n } from "@/i18n";

import { SaasAuditLogListView } from "./saas-audit-log-list-view";

type AuditView = "activity" | "security";

export function SaasAuditCenterView({ view }: { view: AuditView }) {
  const { m } = useSaasI18n();
  const tabs = [
    { view: "activity", href: webAdminRoutes.saas.auditLogs, label: m.auditLogs.title },
    { view: "security", href: webAdminRoutes.saas.auditSecurity, label: m.security.events.title },
  ] as const;

  return (
    <section className="space-y-5 pb-16" data-testid="saas-audit-center-view">
      <SaasPageHeader icon={ScrollText} title={m.auditLogs.centerTitle} />
      <nav aria-label={m.auditLogs.centerTitle} className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <Link
            aria-current={view === tab.view ? "page" : undefined}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              view === tab.view
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            href={tab.href}
            key={tab.view}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <p className="text-sm text-muted-foreground">
        {view === "security"
          ? m.auditLogs.securityDescription
          : m.auditLogs.activityDescription}
      </p>
      {view === "security" ? (
        <SecurityEventListView />
      ) : (
        <SaasAuditLogListView />
      )}
    </section>
  );
}
