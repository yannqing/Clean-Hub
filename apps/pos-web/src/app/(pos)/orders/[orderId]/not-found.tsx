import Link from "next/link";

import { PosBreadcrumb, PosEmptyState } from "@/components/app-shell";
import { posRoutes } from "@/config";

export default function OrderNotFound() {
  return (
    <section className="space-y-5">
      <PosBreadcrumb
        items={[
          { href: posRoutes.orders, label: "订单管理" },
          { label: "订单未找到" },
        ]}
      />
      <PosEmptyState
        action={
          <Link
            className="flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={posRoutes.orders}
          >
            返回订单列表
          </Link>
        }
        description="该订单可能已被删除，或不属于当前门店可访问的范围。"
        icon="receipt"
        title="没有找到订单"
      />
    </section>
  );
}
