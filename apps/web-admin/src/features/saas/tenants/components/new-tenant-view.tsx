"use client";

import type { AuthContext } from "@cleanhub/api-client";
import { Badge, Button } from "@cleanhub/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { getCurrentAuthQuery } from "@/features/auth/queries";
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
          getTenantLoadErrorMessage(
            error,
            m.tenants.new.sessionError,
          ),
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
    <section className="min-h-[560px]">
      <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">{m.tenants.new.badge}</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            {m.tenants.new.title}
          </h1>
        </div>

        <Button asChild variant="outline">
          <Link href={webAdminRoutes.saas.tenants}>
            {m.tenants.new.backToTenants}
          </Link>
        </Button>
      </div>

      {!authLoading && (authError || !canManageTenantCreation) ? (
        <div className="mx-5 mt-5 rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
          {authError
            ? `Tenant creation is disabled because the current session could not be verified: ${authError}`
            : m.tenants.new.permissionHint}
        </div>
      ) : null}

      <TenantForm
        disabled={authLoading || !canManageTenantCreation}
        mode="create"
        onSubmit={createTenantAction}
        onSuccess={(tenant) => {
          router.push(`${webAdminRoutes.saas.tenants}/${tenant.id}`);
          router.refresh();
        }}
      />
    </section>
  );
}
