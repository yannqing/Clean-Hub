"use client";

import { cn } from "@cleanhub/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoutButton } from "@/features/auth/components";
import {
  posRoutes,
  posShellCopy,
  posSidebarNavigation,
} from "@/config";

import { Icon } from "./icons";

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export type PosShellProfile = {
  name: string;
  role: string;
  initials: string;
};

type PosShellProps = {
  children: React.ReactNode;
  profile?: PosShellProfile;
};

const FALLBACK_PROFILE: PosShellProfile = {
  name: "",
  role: "",
  initials: "?",
};

function buildInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return FALLBACK_PROFILE.initials;
  }

  return [...trimmed][0] ?? FALLBACK_PROFILE.initials;
}

export function PosShell({ children, profile }: PosShellProps) {
  const pathname = usePathname();
  const resolvedProfile: PosShellProfile = profile
    ? {
        name: profile.name,
        role: profile.role,
        initials: profile.initials || buildInitials(profile.name),
      }
    : FALLBACK_PROFILE;

  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F9FC] text-slate-900">
      <aside className="flex w-[240px] shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-5">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="CleanHub mark"
              className="h-11 w-11 rounded-xl object-cover"
              src="/cleanhub-logo-mark.jpg"
            />
            <div>
              <div className="text-lg font-extrabold tracking-tight">
                <span className="text-slate-950">Clean</span>
                <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                  Hub
                </span>
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                {posShellCopy.brandSuffix}
              </div>
            </div>
          </div>

          <Link
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700"
            href={posRoutes.newIntake}
          >
            <Icon className="h-4 w-4" name="user-plus" />
            新建
          </Link>
        </div>

        <nav className="pos-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
          <div className="space-y-6">
            {posSidebarNavigation.map((section) => (
              <div key={section.title}>
                <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {section.title}
                </div>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const active = isActivePath(pathname, item.href);

                    return (
                      <Link
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition",
                          active
                            ? "bg-blue-50 text-blue-700"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                        )}
                        href={item.href}
                        key={item.label}
                      >
                        {active ? (
                          <span className="absolute left-0 h-5 w-1 rounded-r-full bg-blue-600" />
                        ) : null}
                        <span
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-md",
                            active
                              ? "bg-white text-blue-700 shadow-sm"
                              : "text-slate-400",
                          )}
                        >
                          <Icon className="h-4 w-4" name={item.icon} />
                        </span>
                        <span className="font-medium">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className="border-t border-slate-100 p-4">
          <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 via-blue-500 to-violet-500 text-xs font-bold text-white">
              {resolvedProfile.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-900">
                {resolvedProfile.name}
              </div>
              <div className="text-xs font-medium text-slate-500">
                {resolvedProfile.role}
              </div>
            </div>
            <LogoutButton
              aria-label="退出登录"
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-700"
            >
              <Icon className="h-4 w-4" name="lock" />
            </LogoutButton>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[68px] items-center gap-4 border-b border-slate-200 bg-white px-6">
          <div className="flex h-11 w-full max-w-[620px] items-center rounded-lg border border-slate-200 bg-slate-50 px-3 transition focus-within:border-blue-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(37,99,235,0.10)]">
            <Icon className="mr-2.5 h-[18px] w-[18px] text-slate-400" name="search" />
            <input
              className="h-full flex-1 bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
              placeholder="搜索手机号、客户、工单、订单、标签"
            />
            <button
              className="ml-2 flex h-8 items-center gap-1.5 rounded-md bg-white px-2.5 text-xs font-semibold text-slate-500 shadow-sm"
              type="button"
            >
              <Icon className="h-3.5 w-3.5" name="scan-line" />
              扫描
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 lg:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              已同步
            </div>
            <button
              className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              type="button"
            >
              <Icon className="h-4 w-4 text-slate-500" name="languages" />
              中文
            </button>
            <button
              className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              type="button"
            >
              <Icon className="h-4 w-4 text-slate-500" name="lock" />
              锁屏
            </button>
            <Link
              className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              href={posRoutes.notifications}
            >
              <Icon className="h-[18px] w-[18px]" name="bell" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
            </Link>
          </div>
        </header>

        <div className="pos-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-5">
          {children}
        </div>
      </main>
    </div>
  );
}
