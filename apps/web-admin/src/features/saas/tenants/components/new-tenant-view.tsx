"use client";

import { Badge, Button } from "@cleanhub/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { webAdminRoutes } from "@/config/routes";

import { createTenantAction } from "../actions";
import { TenantForm } from "./tenant-form";

export function NewTenantView() {
  const router = useRouter();

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

      <TenantForm
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
