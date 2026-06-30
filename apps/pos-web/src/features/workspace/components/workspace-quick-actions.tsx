"use client";

import Link from "next/link";
import type { PosQuickAction } from "@cleanhub/api-client";
import { Icon, type PosIconName } from "@/components/app-shell/icons";

type WorkspaceQuickActionsProps = {
  actions: PosQuickAction[];
};

type AccentColor = "blue" | "green" | "orange" | "red" | "purple" | "indigo";

const COLOR_CLASSES: Record<AccentColor, string> = {
  blue: "hover:border-blue-300 hover:bg-blue-50/60 hover:ring-blue-100",
  green:
    "hover:border-emerald-300 hover:bg-emerald-50/60 hover:ring-emerald-100",
  orange:
    "hover:border-orange-300 hover:bg-orange-50/60 hover:ring-orange-100",
  red: "hover:border-rose-300 hover:bg-rose-50/60 hover:ring-rose-100",
  purple:
    "hover:border-violet-300 hover:bg-violet-50/60 hover:ring-violet-100",
  indigo:
    "hover:border-indigo-300 hover:bg-indigo-50/60 hover:ring-indigo-100",
};

const ICON_THEME: Record<AccentColor, string> = {
  blue: "bg-blue-50 text-blue-600 ring-1 ring-blue-100",
  green: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100",
  orange: "bg-orange-50 text-orange-600 ring-1 ring-orange-100",
  red: "bg-rose-50 text-rose-600 ring-1 ring-rose-100",
  purple: "bg-violet-50 text-violet-600 ring-1 ring-violet-100",
  indigo: "bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100",
};

/** 将后端返回的 icon key 映射到统一的 PosIconName，缺失时回退到 plus。 */
const ICON_MAP: Record<string, PosIconName> = {
  plus: "plus",
  scan: "scan-line",
  "scan-line": "scan-line",
  ticket: "clipboard-list",
  "clipboard-list": "clipboard-list",
  order: "receipt",
  receipt: "receipt",
  users: "users",
  "user-plus": "user-plus",
  shirt: "shirt",
  garment: "shirt",
  customer: "users",
};

function resolveAccent(color: string): AccentColor {
  if (color in COLOR_CLASSES) {
    return color as AccentColor;
  }
  return "blue";
}

function resolveIcon(iconKey: string): PosIconName {
  return ICON_MAP[iconKey] ?? "plus";
}

function QuickActionCard({ action }: { action: PosQuickAction }) {
  const accent = resolveAccent(action.color);
  const icon = resolveIcon(action.icon);

  return (
    <Link
      href={action.route}
      className={`group flex flex-col items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white p-4 text-center shadow-sm ring-0 transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${COLOR_CLASSES[accent]}`}
    >
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110 ${ICON_THEME[accent]}`}
      >
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <span className="text-xs font-medium text-slate-700">{action.label}</span>
    </Link>
  );
}

export function WorkspaceQuickActions({
  actions,
}: WorkspaceQuickActionsProps) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-100">
          <Icon name="replace" className="h-[18px] w-[18px]" />
        </span>
        <h2 className="text-sm font-semibold text-slate-800">快速操作</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {actions.map((action) => (
          <QuickActionCard key={action.id} action={action} />
        ))}
      </div>
    </section>
  );
}
