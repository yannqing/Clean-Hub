"use client";

import type { PosWorkspaceBranch } from "@cleanhub/api-client";
import { Icon } from "@/components/app-shell/icons";
import { getCatalogueLabel } from "@/lib/catalogue-label";
import type { TranslationKey } from "@cleanhub/i18n";

type WorkspaceBranchCardProps = {
  branch: PosWorkspaceBranch | null;
};

export function WorkspaceBranchCard({ branch }: WorkspaceBranchCardProps) {
  if (!branch) {
    return (
      <section className="border-y border-dashed border-border bg-background py-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon name="store" className="h-[18px] w-[18px]" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              尚未绑定门店
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              当前账号未分配到任何门店分店，请联系店主或店长在后台分配门店后再使用
              POS。
            </p>
          </div>
        </div>
      </section>
    );
  }

  const statusLabel = getCatalogueLabel(
    `pos.branchState.${branch.status}` as TranslationKey,
    branch.status,
  );
  const isActive = branch.status === "active";

  return (
    <section className="border-y border-border bg-background py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
            <Icon name="store" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {branch.name}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              门店编码 · {branch.id.slice(-8).toUpperCase()}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            isActive
              ? "bg-emerald-50 text-emerald-700"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isActive ? "bg-emerald-500" : "bg-muted-foreground"
            }`}
          />
          {statusLabel}
        </span>
      </div>

      {(branch.phone || branch.address) && (
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          {branch.phone && (
            <span className="inline-flex items-center gap-1.5">
              <Icon
                name="phone"
                className="h-3.5 w-3.5 text-muted-foreground"
              />
              {branch.phone}
            </span>
          )}
          {branch.address && (
            <span className="inline-flex items-center gap-1.5">
              <Icon
                name="map-pin"
                className="h-3.5 w-3.5 text-muted-foreground"
              />
              {branch.address}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
