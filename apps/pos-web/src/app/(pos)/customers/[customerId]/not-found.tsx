import Link from "next/link";

import { PosBreadcrumb, PosEmptyState } from "@/components/app-shell";
import { posRoutes } from "@/config";

export default function CustomerNotFound() {
  return (
    <section className="space-y-5">
      <PosBreadcrumb
        items={[
          { href: posRoutes.customers, label: "客户管理" },
          { label: "客户未找到" },
        ]}
      />
      <PosEmptyState
        action={
          <Link
            className="flex h-11 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            href={posRoutes.customers}
          >
            返回客户列表
          </Link>
        }
        description="该客户档案可能已被删除，或不属于当前门店可访问的范围。"
        icon="users"
        title="没有找到客户档案"
      />
    </section>
  );
}
