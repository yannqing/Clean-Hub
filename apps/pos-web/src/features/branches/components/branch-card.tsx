import { BRANCH_STATUS_LABELS } from "../constants";
import type { PosBranchSummary } from "../types";

type BranchCardProps = {
  branch: PosBranchSummary;
};

/**
 * Presentational card for a POS branch. Kept free of data fetching so it can
 * be reused in any page that already holds a branch object.
 */
export function BranchCard({ branch }: BranchCardProps) {
  const statusLabel = BRANCH_STATUS_LABELS[branch.status] ?? branch.status;
  const rows: Array<{ label: string; value: string | null }> = [
    { label: "联系电话", value: branch.phone },
    { label: "门店地址", value: branch.address },
    { label: "默认语言", value: branch.defaultLanguage },
    { label: "默认币种", value: branch.defaultCurrency },
  ];

  return (
    <section className="border-y border-border bg-background px-4 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {branch.name}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            门店编码 · {branch.id.slice(-8).toUpperCase()}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            branch.status === "active"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {statusLabel}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col">
            <dt className="text-xs font-medium text-muted-foreground">
              {row.label}
            </dt>
            <dd className="mt-0.5 text-sm font-medium text-foreground">
              {row.value ?? "—"}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
