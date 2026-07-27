import { Badge } from "@cleanhub/ui";

import { useTenantI18n } from "@/i18n";

import type { DiscountDerivedStatus } from "../types";

export function DiscountStatusBadge({
  status,
}: {
  status: DiscountDerivedStatus;
}) {
  const { m } = useTenantI18n();
  const variant =
    status === "active"
      ? "default"
      : status === "scheduled"
        ? "secondary"
        : "outline";

  return (
    <Badge className="px-1.5 py-px text-[11px]" variant={variant}>
      {m.discounts.statuses[status]}
    </Badge>
  );
}
