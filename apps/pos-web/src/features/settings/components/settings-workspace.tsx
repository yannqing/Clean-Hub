"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import { Input, cn } from "@cleanhub/ui";

import { Icon, type PosIconName } from "@/components/app-shell";
import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";
import { posRoutes } from "@/config";

type SettingsNavigationItem = {
  description: string;
  href: string;
  icon: PosIconName;
  title: string;
};

const SETTINGS_NAVIGATION: SettingsNavigationItem[] = [
  {
    href: posRoutes.settings,
    icon: "settings",
    title: "设置概览",
    description: "查看并管理当前收银终端的设置。",
  },
  {
    href: posRoutes.settingsTerminal,
    icon: "monitor",
    title: "终端信息",
    description: "设置当前终端在设备列表中显示的名称。",
  },
  {
    href: posRoutes.settingsCheckout,
    icon: "wallet-cards",
    title: "收银偏好",
    description: "配置默认支付方式和金额处理规则。",
  },
  {
    href: posRoutes.settingsPrinting,
    icon: "printer",
    title: "打印设置",
    description: "配置自动打印与默认打印联数。",
  },
  {
    href: posRoutes.settingsSecurity,
    icon: "lock",
    title: "安全设置",
    description: "设置自动锁屏等待时间。",
  },
  {
    href: posRoutes.settingsStore,
    icon: "store",
    title: "门店信息",
    description: "查看当前门店及小票抬头信息。",
  },
  {
    href: posRoutes.settingsHardware,
    icon: "printer",
    title: "硬件设备",
    description: "发现、测试并连接当前终端的硬件。",
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === posRoutes.settings) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initials(value: string): string {
  return (
    value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "CH"
  );
}

export function SettingsWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const runtime = usePosRuntimeConfig();
  const [query, setQuery] = useState("");
  const active =
    SETTINGS_NAVIGATION.find((item) => isActive(pathname, item.href)) ??
    SETTINGS_NAVIGATION[0];
  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase();
    return keyword
      ? SETTINGS_NAVIGATION.filter((item) =>
          `${item.title} ${item.description}`
            .toLocaleLowerCase()
            .includes(keyword),
        )
      : SETTINGS_NAVIGATION;
  }, [query]);

  const ActiveIcon = active.icon;
  const tenantName = runtime.merchantName || "CleanHub";
  const operatorName = runtime.operatorName || "POS 用户";

  return (
    <section className="lg:min-h-[calc(100vh-4rem)] lg:bg-[#f1f1f1] lg:px-5 lg:py-5">
      <div className="mx-auto lg:grid lg:max-w-[1180px] lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start lg:gap-5">
        <aside className="hidden overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)] lg:sticky lg:top-5 lg:flex lg:h-[calc(100vh-2.5rem)] lg:flex-col">
          <div className="border-b border-black/10 px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-sm font-semibold text-white">
                {initials(tenantName)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-950">
                  {tenantName}
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">
                  {runtime.branchName || "POS 终端设置"}
                </span>
              </span>
            </div>
          </div>

          <div className="border-b border-black/10 p-3">
            <label className="sr-only" htmlFor="pos-settings-search">
              搜索设置
            </label>
            <div className="relative">
              <Icon
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                name="search"
              />
              <Input
                className="h-9 rounded-lg border-slate-300 bg-white pl-9 text-sm shadow-none"
                id="pos-settings-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索设置"
                type="search"
                value={query}
              />
            </div>
          </div>

          <nav className="grid min-h-0 flex-1 content-start gap-1 overflow-y-auto p-3">
            {filtered.map((item) => (
              <Link
                aria-current={item.href === active.href ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
                  item.href === active.href
                    ? "bg-slate-100 text-slate-950"
                    : "text-slate-700 hover:bg-slate-50 hover:text-slate-950",
                )}
                href={item.href}
                key={item.href}
              >
                <Icon
                  className="size-4 shrink-0 text-slate-600"
                  name={item.icon}
                />
                <span className="truncate">{item.title}</span>
              </Link>
            ))}
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-slate-500">
                没有匹配的设置
              </p>
            ) : null}
          </nav>

          <div className="border-t border-black/10 p-3">
            <div className="flex items-center gap-3 rounded-lg px-2 py-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700">
                {initials(operatorName)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium text-slate-900">
                  {operatorName}
                </span>
                <span className="block truncate text-[11px] text-slate-500">
                  {runtime.terminalName || "当前终端"}
                </span>
              </span>
            </div>
          </div>
        </aside>

        {/*
          The desktop layout supplies its gutter through the section's
          `lg:px-5`, and every settings card pads itself with `lg:px-4`. Below
          that breakpoint none of it applies, so the content sat flush against
          both screen edges on a phone. The gutter lives here rather than on
          each card so every settings page gets it.
        */}
        <main className="min-w-0 px-4 lg:px-0">
          <div className="mb-4 hidden min-h-10 items-start justify-between gap-4 px-1 lg:flex">
            <div className="flex min-w-0 items-start gap-2">
              <Icon
                className="mt-0.5 size-5 shrink-0 text-slate-700"
                name={ActiveIcon}
              />
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold tracking-tight text-slate-950">
                  {active.title}
                </h1>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {active.description}
                </p>
              </div>
            </div>
            <button
              aria-label="关闭设置"
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-black/5 hover:text-slate-950"
              onClick={() => router.push(posRoutes.home)}
              title="关闭设置"
              type="button"
            >
              <Icon className="size-5" name="x" />
            </button>
          </div>
          {children}
        </main>
      </div>
    </section>
  );
}
