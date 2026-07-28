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
            className="flex h-11 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            onClick={reset}
            type="button"
          >
            重新加载
          </button>
          <Link
            className="flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
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
