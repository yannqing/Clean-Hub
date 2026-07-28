"use client";

import {
  Icon,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  cn,
} from "@cleanhub/ui";
import {
  ArrowRight,
  Bot,
  Building2,
  LayoutDashboard,
  ListChecks,
  MessageSquareWarning,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { webAdminRoutes } from "@/config/routes";

import type { SaasHeaderCopy } from "../types";

type AssistantActionId =
  | "overview"
  | "tenants"
  | "users"
  | "feedbackTickets"
  | "todos"
  | "auditLogs"
  | "operationLogs"
  | "security"
  | "settings";

type AssistantAction = {
  id: AssistantActionId;
  href: string;
  icon: LucideIcon;
  label: string;
  description: string;
};

type SaasHeaderAssistantProps = {
  copy: SaasHeaderCopy;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function createActions(copy: SaasHeaderCopy["assistant"]): AssistantAction[] {
  return [
    {
      id: "overview",
      href: webAdminRoutes.saas.home,
      icon: LayoutDashboard,
      ...copy.actions.overview,
    },
    {
      id: "tenants",
      href: webAdminRoutes.saas.tenants,
      icon: Building2,
      ...copy.actions.tenants,
    },
    {
      id: "users",
      href: webAdminRoutes.saas.users,
      icon: Users,
      ...copy.actions.users,
    },
    {
      id: "feedbackTickets",
      href: webAdminRoutes.saas.feedbackTickets,
      icon: MessageSquareWarning,
      ...copy.actions.feedbackTickets,
    },
    {
      id: "todos",
      href: webAdminRoutes.saas.todos,
      icon: ListChecks,
      ...copy.actions.todos,
    },
    {
      id: "auditLogs",
      href: webAdminRoutes.saas.auditLogs,
      icon: ScrollText,
      ...copy.actions.auditLogs,
    },
    {
      id: "operationLogs",
      href: webAdminRoutes.saas.system.logs,
      icon: ScrollText,
      ...copy.actions.operationLogs,
    },
    {
      id: "security",
      href: webAdminRoutes.saas.system.security,
      icon: ShieldCheck,
      ...copy.actions.security,
    },
    {
      id: "settings",
      href: webAdminRoutes.saas.config.platformSettings,
      icon: Settings,
      ...copy.actions.settings,
    },
  ];
}

export function SaasHeaderAssistant({
  copy,
  open,
  onOpenChange,
}: SaasHeaderAssistantProps) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const actions = useMemo(
    () => createActions(copy.assistant),
    [copy.assistant],
  );
  const filteredActions = useMemo(
    () =>
      normalizedSearch
        ? actions.filter((action) =>
            `${action.label} ${action.description}`
              .toLocaleLowerCase()
              .includes(normalizedSearch),
          )
        : actions,
    [actions, normalizedSearch],
  );

  function closeAssistant() {
    setSearch("");
    onOpenChange(false);
  }

  return (
    <Sheet
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setSearch("");
        }
        onOpenChange(nextOpen);
      }}
      open={open}
    >
      <SheetTrigger asChild>
        <button
          aria-expanded={open}
          aria-label={copy.assistantLabel}
          className={cn(
            "flex size-9 items-center justify-center rounded-xl text-white/75 transition-colors",
            "hover:bg-white/10 hover:text-white",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
            open && "bg-white/15 text-white",
          )}
          data-testid="saas-header-assistant"
          title={copy.assistantLabel}
          type="button"
        >
          <Icon aria-hidden icon={Bot} size={18} />
        </button>
      </SheetTrigger>

      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-5 py-5 text-left">
          <SheetTitle>{copy.assistant.title}</SheetTitle>
          <SheetDescription>{copy.assistant.description}</SheetDescription>
        </SheetHeader>

        <div className="border-b px-5 py-4">
          <label className="sr-only" htmlFor="saas-assistant-search">
            {copy.assistant.searchLabel}
          </label>
          <div className="relative">
            <Icon
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              icon={Search}
              size={16}
            />
            <Input
              autoComplete="off"
              className="h-10 pl-9"
              id="saas-assistant-search"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={copy.assistant.searchPlaceholder}
              type="search"
              value={search}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {copy.assistant.quickActionsTitle}
          </h2>

          {filteredActions.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {filteredActions.map((action) => (
                <Link
                  className="group flex items-center gap-3 rounded-xl border border-border/80 bg-background px-3 py-3 transition-colors hover:border-foreground/20 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  href={action.href}
                  key={action.id}
                  onClick={closeAssistant}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                    <Icon aria-hidden icon={action.icon} size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">
                      {action.label}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                      {action.description}
                    </span>
                  </span>
                  <Icon
                    aria-hidden
                    className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                    icon={ArrowRight}
                    size={16}
                  />
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-14 text-center">
              <p className="text-sm font-semibold">
                {copy.assistant.emptyTitle}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {copy.assistant.emptyDescription}
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
