import type { TenantDiscountSummary } from "./types";

type DiscountCsvLabels = {
  statuses: Record<TenantDiscountSummary["status"], string>;
  methods: Record<TenantDiscountSummary["method"], string>;
  types: Record<TenantDiscountSummary["type"], string>;
  valueTypes: Record<NonNullable<TenantDiscountSummary["valueType"]>, string>;
  allBranches: string;
  enabled: string;
  disabled: string;
};

function protectCsvValue(value: string): string {
  const protectedValue = /^[=+\-@]/.test(value.trimStart())
    ? `'${value}`
    : value;
  return `"${protectedValue.replaceAll('"', '""')}"`;
}

export function downloadDiscountCsv(
  discounts: TenantDiscountSummary[],
  headers: string[],
  filename: string,
  labels: DiscountCsvLabels,
) {
  const rows = discounts.map((discount) => [
    discount.title,
    discount.code ?? "",
    labels.statuses[discount.status],
    labels.methods[discount.method],
    labels.types[discount.type],
    labels.valueTypes[discount.valueType],
    discount.valueAmount ?? "",
    discount.currency ?? "",
    String(discount.usageCount),
    discount.usageLimit === null ? "" : String(discount.usageLimit),
    discount.startsAt,
    discount.endsAt ?? "",
    discount.allBranches ? labels.allBranches : String(discount.branchCount),
    discount.posEnabled ? labels.enabled : labels.disabled,
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((value) => protectCsvValue(String(value))).join(","))
    .join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
