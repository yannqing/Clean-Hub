"use client";

import { Button } from "@cleanhub/ui";
import { useRouter } from "next/navigation";

import { useTenantI18n } from "@/i18n";

export function DiscountLoadError() {
  const router = useRouter();
  const { m } = useTenantI18n();

  return (
    <div
      className="mx-auto max-w-2xl rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-4 text-sm"
      role="alert"
    >
      <p>{m.discounts.loadError}</p>
      <Button
        className="mt-3"
        onClick={() => router.refresh()}
        size="sm"
        type="button"
        variant="outline"
      >
        {m.common.retry}
      </Button>
    </div>
  );
}
