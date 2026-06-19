import { BranchCard } from "@/features/branches/components";
import { getMyBranchQuery } from "@/features/branches/queries";
import { getCurrentUser } from "@/lib/auth";

const ROLE_LABELS: Record<string, string> = {
  owner: "店主",
  manager: "店长",
  cashier: "收银员",
};

export default async function WorkspacePage() {
  // Parallel data fetch — both are independent server queries.
  const [user, branch] = await Promise.all([
    getCurrentUser(),
    getMyBranchQuery(),
  ]);

  const roleLabel = user ? (ROLE_LABELS[user.role] ?? user.role) : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          工作台
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">
          {user ? `欢迎，${user.displayName}` : "工作台"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {roleLabel ? `当前角色：${roleLabel}` : null}
        </p>
      </div>

      {branch ? (
        <BranchCard branch={branch} />
      ) : (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-700">
            尚未绑定门店
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            当前账号未分配到任何门店分店，请联系店主或店长在后台分配门店后再使用 POS。
          </p>
        </section>
      )}
    </div>
  );
}
