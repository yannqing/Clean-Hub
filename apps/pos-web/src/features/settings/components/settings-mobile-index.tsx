"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "@/components/app-shell";
import { posRoutes } from "@/config";

import {
  LOCK_TIMEOUT_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  PRINT_COPIES_OPTIONS,
  ROUNDING_RULE_OPTIONS,
  SETTINGS_PAGE_TITLE,
} from "../constants";
import type { TerminalSettingsFormValues } from "../types";

type SettingsMobileIndexProps = {
  branchName: string;
  formValues: TerminalSettingsFormValues;
  hardwareCount: number;
  loading: boolean;
};

type SettingsItem = {
  description: ReactNode;
  href: string;
  title: string;
};

function optionLabel<T extends string | number>(
  options: readonly { label: string; value: T }[],
  value: T,
): string {
  return (
    options.find((option) => option.value === value)?.label ?? String(value)
  );
}

function SettingsGroup({
  items,
  title,
}: {
  items: SettingsItem[];
  title: string;
}) {
  return (
    <section aria-labelledby={`settings-group-${title}`}>
      <h2
        className="mb-2 text-sm font-medium text-muted-foreground"
        id={`settings-group-${title}`}
      >
        {title}
      </h2>
      <div>
        {items.map((item) => (
          <Link
            className="group flex min-h-[76px] items-center gap-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={item.href}
            key={item.href}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-medium text-foreground">
                {item.title}
              </span>
              <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                {item.description}
              </span>
            </span>
            <Icon
              className="size-5 shrink-0 text-foreground transition-transform group-active:translate-x-0.5"
              name="chevron-right"
            />
          </Link>
        ))}
      </div>
    </section>
  );
}

export function SettingsMobileIndex({
  branchName,
  formValues,
  hardwareCount,
  loading,
}: SettingsMobileIndexProps) {
  const terminalItems: SettingsItem[] = [
    {
      description: loading ? "正在加载…" : formValues.label || "未设置设备标签",
      href: posRoutes.settingsTerminal,
      title: "终端信息",
    },
    {
      description: loading
        ? "正在加载…"
        : `${optionLabel(PAYMENT_METHOD_OPTIONS, formValues.defaultPaymentMethod)} · ${optionLabel(ROUNDING_RULE_OPTIONS, formValues.roundingRule)}`,
      href: posRoutes.settingsCheckout,
      title: "收银偏好",
    },
    {
      description: loading
        ? "正在加载…"
        : `${formValues.autoPrintReceipt ? "自动打印" : "手动打印"} · ${optionLabel(PRINT_COPIES_OPTIONS, formValues.printCopies)}`,
      href: posRoutes.settingsPrinting,
      title: "打印设置",
    },
    {
      description: loading
        ? "正在加载…"
        : `自动锁屏：${optionLabel(LOCK_TIMEOUT_OPTIONS, formValues.lockTimeoutSeconds)}`,
      href: posRoutes.settingsSecurity,
      title: "安全设置",
    },
  ];

  const storeItems: SettingsItem[] = [
    {
      description: loading ? "正在加载…" : branchName || "未获取门店信息",
      href: posRoutes.settingsStore,
      title: "门店信息",
    },
    {
      description: loading
        ? "正在加载…"
        : hardwareCount > 0
          ? `${hardwareCount} 台已登记设备`
          : "打开查看本机可用设备",
      href: posRoutes.settingsHardware,
      title: "硬件设备",
    },
  ];

  return (
    <section
      aria-busy={loading}
      className="mx-auto w-full max-w-lg space-y-9 pb-8 lg:hidden"
    >
      <header className="pt-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {SETTINGS_PAGE_TITLE}
        </h1>
      </header>

      <SettingsGroup items={terminalItems} title="终端" />
      <SettingsGroup items={storeItems} title="门店与设备" />
    </section>
  );
}
