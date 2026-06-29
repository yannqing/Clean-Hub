"use client";

import type { PosWorkspaceBranch } from "@cleanhub/api-client";

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
        <h2 className="text-sm font-semibold text-slate-700">尚未绑定门店</h2>
        <p className="mt-1 text-xs text-slate-400">
          当前账号未分配到任何门店分店，请联系店主或店长在后台分配门店后再使用
          POS。
        </p>
      </section>
    );
  }

  const statusLabel = BRANCH_STATUS_LABELS[branch.status] ?? branch.status;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {branch.name}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            ID: {branch.id.slice(0, 8)}...
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            branch.status === "active"
              ? "bg-green-100 text-green-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {statusLabel}
        </span>
      </div>
      {branch.phone && (
        <p className="mt-2 text-xs text-slate-500">电话: {branch.phone}</p>
      )}
      {branch.address && (
        <p className="mt-1 text-xs text-slate-500">地址: {branch.address}</p>
      )}
    </section>
  );
}
