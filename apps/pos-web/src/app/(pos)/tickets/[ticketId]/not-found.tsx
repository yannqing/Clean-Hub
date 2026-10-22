import Link from "next/link";

import { PosBreadcrumb, PosEmptyState } from "@/components/app-shell";
import { posRoutes } from "@/config";

export default function TicketNotFound() {
  return (
    <section className="space-y-5">
      <PosBreadcrumb
        items={[
          { href: posRoutes.tickets, label: "工单管理" },
          { label: "工单未找到" },
        ]}
      />
      <PosEmptyState
        action={
          <Link
            className="flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={posRoutes.tickets}
          >
            返回工单列表
          </Link>
        }
        description="该工单可能已被删除，或不属于当前门店可访问的范围。"
        icon="clipboard-list"
        title="没有找到工单"
      />
    </section>
  );
}
