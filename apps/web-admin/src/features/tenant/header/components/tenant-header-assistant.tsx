"use client";

import type { AuthContext } from "@cleanhub/api-client";
import {
  Icon,
  Input,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  cn,
} from "@cleanhub/ui";
import {
  ArrowRight,
  BadgePercent,
  Bot,
  ContactRound,
  HandCoins,
  Package,
  Plus,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Tags,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { webAdminRoutes } from "@/config/routes";

import type { TenantHeaderCopy } from "../types";

type AssistantCopy = TenantHeaderCopy["assistant"];

type AssistantActionId =
  | "orders"
  | "customers"
  | "products"
  | "newProduct"
  | "services"
  | "newService"
  | "discounts"
  | "newDiscount"
  | "reports"
  | "finance"
  | "settings";

type AssistantAction = {
  id: AssistantActionId;
  href: string;
  icon: LucideIcon;
  label: string;
  description: string;
  ownerOnly?: boolean;
};

type TenantHeaderAssistantProps = {
  authContext: AuthContext | null;
  copy: TenantHeaderCopy;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function createActions(copy: AssistantCopy): AssistantAction[] {
  return [
    {
      id: "orders",
      href: webAdminRoutes.tenant.orders,
      icon: ShoppingBag,
      ...copy.actions.orders,
    },
    {
      id: "customers",
      href: webAdminRoutes.tenant.customers,
      icon: ContactRound,
      ...copy.actions.customers,
    },
    {
      id: "products",
      href: webAdminRoutes.tenant.products,
      icon: Package,
      ...copy.actions.products,
    },
    {
      id: "newProduct",
      href: webAdminRoutes.tenant.newProduct,
      icon: Plus,
      ownerOnly: true,
      ...copy.actions.newProduct,
    },
    {
      id: "services",
      href: webAdminRoutes.tenant.services,
      icon: Tags,
      ...copy.actions.services,
    },
    {
      id: "newService",
      href: webAdminRoutes.tenant.newService,
      icon: Plus,
      ...copy.actions.newService,
    },
    {
      id: "discounts",
      href: webAdminRoutes.tenant.discounts,
      icon: BadgePercent,
      ...copy.actions.discounts,
    },
    {
      id: "newDiscount",
      href: webAdminRoutes.tenant.newDiscount,
      icon: Plus,
      ...copy.actions.newDiscount,
    },
    {
      id: "reports",
      href: webAdminRoutes.tenant.reports,
      icon: Sparkles,
      ...copy.actions.reports,
    },
    {
      id: "finance",
      href: webAdminRoutes.tenant.finance,
      icon: HandCoins,
      ...copy.actions.finance,
    },
    {
      id: "settings",
      href: webAdminRoutes.tenant.system.settings,
      icon: Settings,
      ...copy.actions.settings,
    },
  ];
}

function getRecommendedActionIds(pathname: string): AssistantActionId[] {
  if (pathname.startsWith(webAdminRoutes.tenant.orders)) {
    return ["customers", "finance", "reports"];
  }

  if (pathname.startsWith(webAdminRoutes.tenant.customers)) {
    return ["orders", "discounts", "reports"];
  }

  if (pathname.startsWith(webAdminRoutes.tenant.products)) {
    return ["newProduct", "services", "discounts"];
  }

  if (pathname.startsWith(webAdminRoutes.tenant.services)) {
    return ["newService", "products", "discounts"];
  }

  if (pathname.startsWith(webAdminRoutes.tenant.discounts)) {
    return ["newDiscount", "products", "reports"];
  }

  if (
    pathname.startsWith(webAdminRoutes.tenant.reports) ||
    pathname.startsWith(webAdminRoutes.tenant.finance)
  ) {
    return ["orders", "reports", "finance"];
  }

  if (pathname.startsWith(webAdminRoutes.tenant.system.settings)) {
    return ["products", "services", "reports"];
  }

  return ["orders", "products", "reports"];
}

function ActionLink({
  action,
  onNavigate,
}: {
  action: AssistantAction;
  onNavigate: () => void;
}) {
  return (
    <Link
      className="group flex items-center gap-3 rounded-xl border border-border/80 bg-background px-3 py-3 transition-colors hover:border-foreground/20 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      href={action.href}
      onClick={onNavigate}
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
  );
}

export function TenantHeaderAssistant({
  authContext,
  copy,
  open,
  onOpenChange,
}: TenantHeaderAssistantProps) {
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const actions = useMemo(() => {
    const allActions = createActions(copy.assistant);
    return allActions.filter(
      (action) => !action.ownerOnly || authContext?.role === "owner",
    );
  }, [authContext?.role, copy.assistant]);
  const normalizedSearch = search.trim().toLocaleLowerCase();
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
  const recommendedIds = useMemo(
    () => new Set(getRecommendedActionIds(pathname)),
    [pathname],
  );
  const recommendedActions = actions.filter((action) =>
    recommendedIds.has(action.id),
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
            "flex size-9 items-center justify-center rounded-full border border-white/15 text-white/75 transition-colors",
            "hover:border-white/30 hover:bg-white/10 hover:text-white",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
            open && "border-white/30 bg-white/15 text-white",
          )}
          data-testid="tenant-header-assistant"
          title={copy.assistantLabel}
          type="button"
        >
          <Icon aria-hidden icon={Bot} />
        </button>
      </SheetTrigger>

      <SheetContent
        className="w-full gap-0 p-0 sm:max-w-[430px]"
        showCloseButton={false}
        side="right"
      >
        <div className="flex h-full min-h-0 flex-col">
          <SheetHeader className="border-b px-5 pb-4 pt-5 text-left">
            <div className="flex items-start gap-3 pr-10">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-black text-white">
                <Icon aria-hidden icon={Bot} size={19} />
              </span>
              <div className="min-w-0">
                <SheetTitle className="leading-6">
                  {copy.assistant.title}
                </SheetTitle>
                <SheetDescription className="mt-1 leading-5">
                  {copy.assistant.description}
                </SheetDescription>
              </div>
            </div>
            <SheetClose asChild>
              <button
                aria-label={copy.assistant.closeLabel}
                className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                type="button"
              >
                <Icon aria-hidden icon={X} size={17} />
              </button>
            </SheetClose>
          </SheetHeader>

          <div className="border-b px-5 py-4">
            <label className="sr-only" htmlFor="tenant-assistant-search">
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
                className="h-10 rounded-xl pl-9 shadow-none"
                id="tenant-assistant-search"
                onChange={(event) => setSearch(event.target.value)}
                placeholder={copy.assistant.searchPlaceholder}
                type="search"
                value={search}
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {!normalizedSearch && recommendedActions.length > 0 ? (
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {copy.assistant.recommendedTitle}
                </h3>
                <div className="grid gap-2">
                  {recommendedActions.map((action) => (
                    <ActionLink
                      action={action}
                      key={`recommended-${action.id}`}
                      onNavigate={closeAssistant}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            <section className={cn(!normalizedSearch && "mt-6")}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {copy.assistant.quickActionsTitle}
              </h3>
              {filteredActions.length > 0 ? (
                <div className="grid gap-2">
                  {filteredActions.map((action) => (
                    <ActionLink
                      action={action}
                      key={action.id}
                      onNavigate={closeAssistant}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed px-5 py-10 text-center">
                  <p className="text-sm font-semibold">
                    {copy.assistant.emptyTitle}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {copy.assistant.emptyDescription}
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

