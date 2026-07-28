"use client";

import type { AuthContext } from "@cleanhub/api-client";
import { Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { getCurrentAuthQuery } from "@/features/auth/queries";
import { SaasBreadcrumbs } from "@/features/saas/shared";
import { useSaasI18n } from "@/i18n";
import { canCreateTenant } from "@/lib/permissions";

import { createTenantAction } from "../actions";
import { getTenantLoadErrorMessage } from "../actions/tenant-action-errors";
import { TenantForm } from "./tenant-form";

export function NewTenantView() {
  const { m } = useSaasI18n();
  const router = useRouter();
  const [authContext, setAuthContext] = useState<AuthContext | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const canManageTenantCreation = canCreateTenant(authContext);

  useEffect(() => {
    let isCurrent = true;

    getCurrentAuthQuery()
      .then((data) => {
        if (!isCurrent) {
          return;
        }

        setAuthContext(data);
        setAuthError(null);
      })
      .catch((error: unknown) => {
        if (!isCurrent) {
          return;
        }

        setAuthContext(null);
        setAuthError(
          getTenantLoadErrorMessage(error, m.tenants.new.sessionError),
        );
      })
      .finally(() => {
        if (isCurrent) {
          setAuthLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [m.tenants.new.sessionError]);

  return (
    <section className="mx-auto min-h-[560px] w-full max-w-[960px] space-y-3 pb-20">
      <h1 className="sr-only">{m.tenants.new.title}</h1>
      <SaasBreadcrumbs
        ariaLabel={m.tenants.new.title}
        items={[{ label: m.tenants.new.title }]}
        rootHref={webAdminRoutes.saas.tenants}
        rootIcon={Building2}
        rootLabel={m.tenants.list.title}
      />

      {!authLoading && (authError || !canManageTenantCreation) ? (
        <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
          {authError
            ? `${m.tenants.new.sessionError} ${authError}`
            : m.tenants.new.permissionHint}
        </div>
      ) : null}

      <TenantForm
        disabled={authLoading || !canManageTenantCreation}
        mode="create"
        onSubmit={createTenantAction}
        onSuccess={(tenant) => {
          router.push(webAdminRoutes.saas.tenant(tenant.id));
          router.refresh();
        }}
      />
    </section>
  );
}
