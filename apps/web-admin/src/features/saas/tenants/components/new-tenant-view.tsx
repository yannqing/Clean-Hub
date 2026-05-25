"use client";

import type { AuthContext } from "@cleanhub/api-client";
import { Badge, Button } from "@cleanhub/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { webAdminRoutes } from "@/config/routes";

import { createTenantAction } from "../actions";
import { getTenantLoadErrorMessage } from "../actions/tenant-action-errors";
import { getCurrentSaasAuthQuery } from "../queries";
import { TenantForm } from "./tenant-form";

function canCreateTenant(authContext: AuthContext | null): boolean {
  return authContext?.role === "super_admin" && authContext.tenantId === null;
}

export function NewTenantView() {
  const router = useRouter();
  const [authContext, setAuthContext] = useState<AuthContext | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const canManageTenantCreation = canCreateTenant(authContext);

  useEffect(() => {
    let isCurrent = true;

    getCurrentSaasAuthQuery()
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
            "Failed to verify the current session.",
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
  }, []);

  return (
    <section className="min-h-[560px]">
      <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">Tenant setup</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            New Tenant
          </h1>
        </div>

        <Button asChild variant="outline">
          <Link href={webAdminRoutes.saas.tenants}>Back to tenants</Link>
        </Button>
      </div>

      {!authLoading && (authError || !canManageTenantCreation) ? (
        <div className="mx-5 mt-5 rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
          {authError
            ? `Tenant creation is disabled because the current session could not be verified: ${authError}`
            : "Only Super Admin can create tenants."}
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
