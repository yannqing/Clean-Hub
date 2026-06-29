"use client";

import type { PosWorkspaceBranch } from "@cleanhub/api-client";
import { Icon } from "@/components/app-shell/icons";

type WorkspaceBranchCardProps = {
  branch: PosWorkspaceBranch | null;
};

const BRANCH_STATUS_LABELS: Record<string, string> = {
  active: "营业中",
  inactive: "已停用",
};

export function WorkspaceBranchCard({ branch }: WorkspaceBranchCardProps) {
  if (!branch) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
            <Icon name="layout-dashboard" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-700">
              尚未绑定门店
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              当前账号未分配到任何门店分店，请联系店主或店长在后台分配门店后再使用
              POS。
            </p>
          </div>
        </div>
      </section>
    );
  }

  const statusLabel = BRANCH_STATUS_LABELS[branch.status] ?? branch.status;
  const isActive = branch.status === "active";

  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-md shadow-blue-500/20">
            <Icon name="layout-dashboard" className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {branch.name}
            </h2>
            <p className="mt-0.5 font-mono text-xs text-slate-400">
              ID: {branch.id.slice(0, 8)}...
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            isActive
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
              : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isActive ? "animate-pulse bg-emerald-500" : "bg-slate-400"
            }`}
          />
          {statusLabel}
        </span>
      </div>

      {(branch.phone || branch.address) && (
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500">
          {branch.phone && (
            <span className="inline-flex items-center gap-1.5">
              <Icon
                name="languages"
                className="h-3.5 w-3.5 text-slate-400"
              />
              {branch.phone}
            </span>
          )}
          {branch.address && (
            <span className="inline-flex items-center gap-1.5">
              <Icon
                name="clipboard-list"
                className="h-3.5 w-3.5 text-slate-400"
              />
              {branch.address}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
