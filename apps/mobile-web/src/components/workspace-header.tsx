"use client";

import {
  Button,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@cleanhub/ui";
import { LogOut, Menu } from "lucide-react";

import { LanguageSwitcher } from "@/components/language-switcher";

type WorkspaceHeaderProps = {
  eyebrow?: string;
  isLoggingOut?: boolean;
  logoutLabel: string;
  subtitle?: string | null;
  title: string;
  onLogout: () => void;
};

export function WorkspaceHeader({
  eyebrow = "CleanHub",
  isLoggingOut = false,
  logoutLabel,
  subtitle,
  title,
  onLogout,
}: WorkspaceHeaderProps) {
  return (
    <header className="mb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-blue-700">{eyebrow}</p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight text-slate-950">{title}</h1>
          {subtitle ? (
            <p className="mt-2 truncate text-sm text-slate-600">{subtitle}</p>
          ) : null}
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button
              aria-label={logoutLabel}
              className="size-9 shrink-0 border-transparent bg-transparent text-slate-800 shadow-none hover:bg-white/70 hover:text-slate-950"
              size="icon"
              type="button"
              variant="ghost"
            >
              <Menu className="size-5" aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent className="max-h-[58dvh] p-5">
            <SheetHeader className="pr-8 text-left">
              <SheetTitle>CleanHub</SheetTitle>
            </SheetHeader>
            <div className="mt-5">
              <LanguageSwitcher className="w-full justify-between" />
            </div>
            <SheetFooter className="mt-4">
              <Button
                className="h-11 w-full"
                disabled={isLoggingOut}
                type="button"
                variant="outline"
                onClick={onLogout}
              >
                <LogOut className="size-4" aria-hidden="true" />
                {logoutLabel}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
