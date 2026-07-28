import Link from "next/link";

import { PosBreadcrumb, PosEmptyState } from "@/components/app-shell";

export default function PosNotFound() {
  return (
    <section className="space-y-5">
      <PosBreadcrumb items={[{ label: "页面不存在" }]} />
      <PosEmptyState
        action={
          <Link
            className="flex h-11 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            href="/"
          >
            返回工作台
          </Link>
        }
        description="该页面可能已经移动、被删除，或当前终端没有对应的访问入口。"
        title="没有找到该页面"
      />
    </section>
  );
}
