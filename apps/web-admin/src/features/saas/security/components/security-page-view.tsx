"use client";

import { ShieldCheck } from "lucide-react";

import { SaasPageHeader } from "@/features/saas/shared";
import { useSaasI18n } from "@/i18n";
import { SecurityEventListView } from "./security-event-list-view";

export function SecurityPageView() {
  const { m } = useSaasI18n();

  return (
    <section className="space-y-7 pb-16">
      <SaasPageHeader icon={ShieldCheck} title={m.security.page.title} />
      <SecurityEventListView />
    </section>
  );
}
