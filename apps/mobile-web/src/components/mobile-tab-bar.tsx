"use client";

import type { ComponentType } from "react";

type MobileTabIcon = ComponentType<{
  className?: string;
  "aria-hidden"?: true;
}>;

export type MobileTabBarItem<TValue extends string = string> = {
  badgeCount?: number;
  icon: MobileTabIcon;
  label: string;
  value: TValue;
};

export function MobileTabBar<TValue extends string>({
  activeValue,
  ariaLabel,
  items,
  onChange,
}: {
  activeValue: TValue;
  ariaLabel: string;
  items: MobileTabBarItem<TValue>[];
  onChange: (value: TValue) => void;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-[calc(100%-24px)] max-w-[420px] rounded-t-[24px] border border-b-0 border-slate-200/80 bg-white/95 px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_36px_rgba(15,23,42,0.10)] backdrop-blur-xl"
    >
      <div
        className="grid gap-1"
        role="tablist"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeValue === item.value;
          const badgeLabel =
            typeof item.badgeCount === "number" && item.badgeCount > 99
              ? "99+"
              : item.badgeCount;

          return (
            <button
              aria-selected={isActive}
                className={`relative flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-xs font-medium transition active:bg-slate-100 ${
                isActive ? "text-blue-700" : "text-slate-500"
              }`}
              key={item.value}
              role="tab"
              type="button"
              onClick={() => onChange(item.value)}
            >
              <span
                className={`absolute top-0 h-0.5 w-8 rounded-full transition ${
                  isActive ? "bg-blue-600" : "bg-transparent"
                }`}
              />
              <span className="relative">
                <Icon
                  className={`size-[22px] ${isActive ? "stroke-[2.4]" : ""}`}
                  aria-hidden
                />
                {typeof item.badgeCount === "number" && item.badgeCount > 0 ? (
                  <span className="absolute -right-2 -top-2 flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-4 text-white">
                    {badgeLabel}
                  </span>
                ) : null}
              </span>
              <span className="max-w-full truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
