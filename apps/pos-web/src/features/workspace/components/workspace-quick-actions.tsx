"use client";

import type { CSSProperties } from "react";

import type { PosQuickAction } from "@cleanhub/api-client";
import {
  createTranslator,
  defaultLocale,
  normalizeLocale,
} from "@cleanhub/i18n";
import { useTranslation } from "@cleanhub/i18n/react";
import Link from "next/link";

import { Icon, type PosIconName } from "@/components/app-shell/icons";

type WorkspaceQuickActionsProps = {
  actions: PosQuickAction[];
};

type AccentColor = "blue" | "green" | "orange" | "red" | "purple" | "indigo";

const ACTION_COLORS: Record<AccentColor, string> = {
  blue: "var(--chart-1)",
  green: "var(--chart-2)",
  orange: "var(--chart-5)",
  red: "var(--chart-5)",
  purple: "var(--chart-4)",
  indigo: "var(--chart-3)",
};

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

const ACTION_DESCRIPTIONS: Record<string, string> = {
  "new-intake": "接待客户并创建服务工单",
  customers: "查询账户、档案与历史记录",
  tickets: "跟进状态、取件与异常工单",
  orders: "查看订单并处理现金收款",
};

function resolveAccent(color: string): AccentColor {
  if (color in ACTION_COLORS) {
    return color as AccentColor;
  }

  return "blue";
}

function resolveIcon(iconKey: string): PosIconName {
  return ICON_MAP[iconKey] ?? "plus";
}

function iconAccentStyle(color: string): CSSProperties {
  return {
    backgroundColor: `color-mix(in oklch, ${color} 12%, white)`,
    borderColor: `color-mix(in oklch, ${color} 22%, white)`,
    color,
  };
}

function formatActionCount(count: number, locale: string): string {
  return createTranslator({ locale: normalizeLocale(locale) ?? defaultLocale })(
    "pos.inline.taskCount",
    { count: new Intl.NumberFormat(locale).format(count) },
  );
}

function QuickActionCard({ action }: { action: PosQuickAction }) {
  const accent = resolveAccent(action.color);
  const color = ACTION_COLORS[accent];
  const icon = resolveIcon(action.icon);
  const description = ACTION_DESCRIPTIONS[action.id] ?? "进入对应业务页面";

  return (
    <Link
      className="group flex min-h-36 flex-col justify-between rounded-2xl border bg-background p-5 shadow-sm transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-1 hover:border-foreground/20 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none"
      href={action.route}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-transform duration-200 group-hover:scale-105"
          style={iconAccentStyle(color)}
        >
          <Icon className="h-5 w-5" name={icon} />
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground">
          <Icon className="h-4 w-4" name="chevron-right" />
        </span>
      </div>

      <div className="mt-5 min-w-0">
        <h3 className="truncate text-lg font-semibold text-foreground">
          {action.label}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
    </Link>
  );
}

export function WorkspaceQuickActions({ actions }: WorkspaceQuickActionsProps) {
  const { locale } = useTranslation();

  if (actions.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" name="plus" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">快速操作</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              门店常用业务入口
            </p>
          </div>
        </div>
        <span className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs font-semibold text-muted-foreground">
          {formatActionCount(actions.length, locale)}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((action) => (
          <QuickActionCard action={action} key={action.id} />
        ))}
      </div>
    </section>
  );
}
