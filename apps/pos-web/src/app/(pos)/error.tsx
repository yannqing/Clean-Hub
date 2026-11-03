"use client";

import Link from "next/link";

import { PosEmptyState } from "@/components/app-shell";

type PosRouteErrorProps = {
  reset: () => void;
};

export default function PosRouteError({ reset }: PosRouteErrorProps) {
  return (
    <PosEmptyState
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            className="flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={reset}
            type="button"
          >
            重新加载
          </button>
          <Link
            className="flex h-11 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href="/"
          >
            返回工作台
          </Link>
        </div>
      }
      description="页面数据暂时无法加载。请检查网络连接后重试，离线操作仍会保留在本机队列中。"
      icon="alert"
      title="页面加载失败"
    />
  );
}
