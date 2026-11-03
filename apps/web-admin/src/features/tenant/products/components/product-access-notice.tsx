"use client";

import { Button, Icon } from "@cleanhub/ui";
import { Download, LockKeyhole, Package, Plus, Upload } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { useTenantI18n } from "@/i18n";

import type { ProductAccessState } from "../product-access";

export function ProductAccessNotice({
  access = "disabled",
}: {
  access?: Exclude<ProductAccessState, "enabled">;
}) {
  const { m } = useTenantI18n();
  const [checking, setChecking] = useState(false);
  const description =
    access === "disabled"
      ? m.products.featureDisabledDescription
      : m.products.featureAccessLoadFailedDescription;

  return (
    <section
      className="space-y-7 pb-8"
      data-testid="tenant-products-access-notice"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Icon aria-hidden icon={Package} size={19} />
          {m.products.title}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button
            data-testid="tenant-products-import"
            disabled
            size="sm"
            title={description}
            variant="outline"
          >
            <Icon aria-hidden icon={Upload} size={14} />
            {m.products.toolbar.importAction}
          </Button>
          <Button
            data-testid="tenant-products-export"
            disabled
            size="sm"
            title={description}
            variant="outline"
          >
            <Icon aria-hidden icon={Download} size={14} />
            {m.products.toolbar.exportAction}
          </Button>
          <Button
            data-testid="tenant-products-add"
            disabled
            size="sm"
            title={description}
          >
            <Icon aria-hidden icon={Plus} size={14} />
            {m.products.toolbar.addProductAction}
          </Button>
        </div>
      </header>
      <div
        className="rounded-lg border bg-background px-6 py-14 text-center"
        role="status"
      >
        <Icon
          aria-hidden
          className="mx-auto mb-4 text-muted-foreground"
          icon={LockKeyhole}
          size={28}
        />
        <h2 className="text-lg font-semibold">
          {access === "disabled"
            ? m.products.featureDisabledTitle
            : m.products.featureAccessLoadFailedTitle}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild variant="outline">
            <Link href={webAdminRoutes.tenant.home}>
              {m.products.returnHome}
            </Link>
          </Button>
          <Button
            disabled={checking}
            onClick={() => {
              setChecking(true);
              window.location.reload();
            }}
            variant="outline"
          >
            {m.products.recheckAccess}
          </Button>
        </div>
      </div>
    </section>
  );
}
