"use client";

import {
  Icon,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  cn,
} from "@cleanhub/ui";
import type {
  TenantGlobalSearchEntityType,
  TenantGlobalSearchResponse,
} from "@cleanhub/api-client";
import {
  ArrowUp,
  ArrowUpRight,
  ArrowRight,
  AtSign,
  BadgePercent,
  Bell,
  ChartNoAxesCombined,
  Check,
  CircleAlert,
  ClipboardList,
  ContactRound,
  DatabaseBackup,
  FileText,
  HandCoins,
  LaptopMinimal,
  LoaderCircle,
  Package,
  Plus,
  Printer,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Store,
  Tags,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
  type Ref,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { webAdminRoutes } from "@/config/routes";
import { useTenantI18n, useWebAdminLocale } from "@/i18n";
import { webAdminApi } from "@/lib/api-client";

type SearchContextType = "file" | "mention" | "branch" | "user";

type TenantSearchEntry = {
  contexts: SearchContextType[];
  description: string;
  href: string;
  icon: LucideIcon;
  id: string;
  keywords: string[];
  label: string;
};

type TenantDataSearchGroup = keyof TenantGlobalSearchResponse["groups"];

const tenantDataSearchGroupOrder: TenantDataSearchGroup[] = [
  "orders",
  "customers",
  "products",
  "services",
  "branches",
  "users",
];

const tenantDataSearchContexts: Record<
  TenantGlobalSearchEntityType,
  SearchContextType[]
> = {
  order: ["file", "branch"],
  customer: ["file", "mention"],
  product: ["file", "branch"],
  service: ["file", "branch"],
  branch: ["branch"],
  user: ["mention", "user"],
};

const tenantDataSearchIcons: Record<TenantGlobalSearchEntityType, LucideIcon> =
  {
    order: ShoppingBag,
    customer: ContactRound,
    product: Package,
    service: Tags,
    branch: Store,
    user: Users,
  };

const tenantSearchKeywords = {
  orders: ["order", "orders", "commande", "commandes", "订单"],
  customers: ["customer", "customers", "client", "clients", "客户", "顾客"],
  products: ["product", "products", "produit", "produits", "商品", "产品"],
  newProduct: [
    "add product",
    "new product",
    "ajouter produit",
    "新增商品",
    "添加商品",
  ],
  services: ["service", "services", "catalog", "catalogue", "服务", "服务目录"],
  newService: [
    "add service",
    "new service",
    "ajouter service",
    "新增服务",
    "添加服务",
  ],
  discounts: [
    "discount",
    "discounts",
    "promotion",
    "remise",
    "remises",
    "折扣",
    "优惠",
  ],
  newDiscount: [
    "create discount",
    "new discount",
    "créer remise",
    "新建折扣",
    "创建优惠",
  ],
  branches: [
    "branch",
    "branches",
    "store",
    "location",
    "succursale",
    "succursales",
    "门店",
    "网点",
  ],
  newBranch: [
    "add branch",
    "new branch",
    "create branch",
    "ajouter succursale",
    "créer succursale",
    "新增门店",
    "创建门店",
  ],
  users: [
    "user",
    "users",
    "staff",
    "employee",
    "team",
    "utilisateur",
    "employé",
    "équipe",
    "用户",
    "员工",
    "权限",
  ],
  pointOfSale: ["pos", "point of sale", "register", "caisse", "收银", "销售点"],
  hardware: [
    "hardware",
    "printer",
    "scanner",
    "cash drawer",
    "terminal",
    "matériel",
    "imprimante",
    "外设",
    "打印机",
    "扫码枪",
    "钱箱",
  ],
  reports: [
    "report",
    "reports",
    "analytics",
    "performance",
    "rapport",
    "rapports",
    "报表",
    "分析",
    "经营",
  ],
  finance: [
    "finance",
    "payment",
    "refund",
    "revenue",
    "paiement",
    "remboursement",
    "财务",
    "支付",
    "退款",
    "营收",
  ],
  notifications: [
    "notification",
    "notifications",
    "message",
    "messages",
    "通知",
    "消息",
  ],
  logs: [
    "log",
    "logs",
    "audit",
    "activity",
    "journal",
    "journaux",
    "日志",
    "审计",
    "操作记录",
  ],
  backups: [
    "backup",
    "backups",
    "restore",
    "sauvegarde",
    "restauration",
    "备份",
    "恢复",
  ],
  settings: [
    "setting",
    "settings",
    "configuration",
    "paramètre",
    "paramètres",
    "设置",
    "配置",
  ],
  profile: [
    "profile",
    "account",
    "password",
    "profil",
    "compte",
    "mot de passe",
    "个人资料",
    "账户",
    "密码",
  ],
} as const;

const searchStopWords = new Set([
  "a",
  "an",
  "and",
  "can",
  "de",
  "des",
  "do",
  "du",
  "et",
  "how",
  "i",
  "in",
  "la",
  "le",
  "les",
  "me",
  "no",
  "not",
  "of",
  "on",
  "or",
  "ou",
  "pour",
  "the",
  "to",
  "un",
  "une",
  "where",
]);

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function getSearchScore(
  entry: TenantSearchEntry,
  normalizedQuery: string,
): number {
  if (!normalizedQuery) {
    return 1;
  }

  const label = normalizeSearchText(entry.label);
  const haystack = normalizeSearchText(
    [entry.label, entry.description, ...entry.keywords].join(" "),
  );

  if (label === normalizedQuery) {
    return 120;
  }

  if (label.startsWith(normalizedQuery)) {
    return 100;
  }

  if (haystack.includes(normalizedQuery)) {
    return 80;
  }

  const terms = normalizedQuery
    .split(" ")
    .filter((term) => term.length > 1 && !searchStopWords.has(term));
  const matchedTerms = terms.filter((term) => haystack.includes(term)).length;

  if (terms.length === 0 || matchedTerms === 0) {
    return 0;
  }

  return Math.round((matchedTerms / terms.length) * 50) + matchedTerms;
}

function TenantSearchResultLink({
  badge,
  description,
  href,
  icon,
  label,
  onClick,
  resultRef,
  testId,
}: {
  badge?: string;
  description?: string;
  href: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  resultRef?: Ref<HTMLAnchorElement>;
  testId: string;
}) {
  return (
    <Link
      className="group flex min-h-14 items-center gap-3 rounded-xl border bg-background px-3 py-2.5 text-left transition-colors hover:border-foreground/20 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-testid={testId}
      href={href}
      onClick={onClick}
      ref={resultRef}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
        <Icon aria-hidden icon={icon} size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">
            {label}
          </span>
          {badge ? (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {badge}
            </span>
          ) : null}
        </span>
        {description ? (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {description}
          </span>
        ) : null}
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

export function TenantHomeSearch() {
  const { m } = useTenantI18n();
  const { messages } = useWebAdminLocale();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [selectedContextType, setSelectedContextType] =
    useState<SearchContextType | null>(null);
  const [tenantDataSearch, setTenantDataSearch] =
    useState<TenantGlobalSearchResponse | null>(null);
  const [tenantDataSearchLoading, setTenantDataSearchLoading] = useState(false);
  const [tenantDataSearchError, setTenantDataSearchError] = useState(false);
  const isComposingRef = useRef(false);
  const searchAreaRef = useRef<HTMLDivElement>(null);
  const firstResultRef = useRef<HTMLAnchorElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const canSend = query.trim().length > 0;
  const showSearchMode = isSearchActive || isContextMenuOpen;
  const assistantActions = messages.shell.tenant.header.assistant.actions;
  const quickEntries = [
    {
      copy: m.overview.quickEntries.branches,
      href: webAdminRoutes.tenant.branches,
      icon: Store,
    },
    {
      copy: m.overview.quickEntries.services,
      href: webAdminRoutes.tenant.services,
      icon: ClipboardList,
    },
    {
      copy: m.overview.quickEntries.hardware,
      href: webAdminRoutes.tenant.hardware,
      icon: Printer,
    },
    {
      copy: m.overview.quickEntries.reports,
      href: webAdminRoutes.tenant.reports,
      icon: ChartNoAxesCombined,
    },
  ] as const;
  const contextTypes = [
    {
      id: "file",
      copy: m.overview.searchComposer.contextTypes.file,
      icon: FileText,
    },
    {
      id: "mention",
      copy: m.overview.searchComposer.contextTypes.mention,
      icon: AtSign,
    },
    {
      id: "branch",
      copy: m.overview.searchComposer.contextTypes.branch,
      icon: Store,
    },
    {
      id: "user",
      copy: m.overview.searchComposer.contextTypes.user,
      icon: Users,
    },
  ] as const;
  const searchEntries = useMemo<TenantSearchEntry[]>(
    () => [
      {
        id: "orders",
        href: webAdminRoutes.tenant.orders,
        icon: ShoppingBag,
        contexts: ["branch", "user"],
        keywords: [...tenantSearchKeywords.orders],
        ...assistantActions.orders,
      },
      {
        id: "customers",
        href: webAdminRoutes.tenant.customers,
        icon: ContactRound,
        contexts: ["mention", "user"],
        keywords: [...tenantSearchKeywords.customers],
        ...assistantActions.customers,
      },
      {
        id: "products",
        href: webAdminRoutes.tenant.products,
        icon: Package,
        contexts: ["branch"],
        keywords: [...tenantSearchKeywords.products],
        ...assistantActions.products,
      },
      {
        id: "newProduct",
        href: webAdminRoutes.tenant.newProduct,
        icon: Plus,
        contexts: ["branch"],
        keywords: [...tenantSearchKeywords.newProduct],
        ...assistantActions.newProduct,
      },
      {
        id: "services",
        href: webAdminRoutes.tenant.services,
        icon: Tags,
        contexts: ["branch"],
        keywords: [...tenantSearchKeywords.services],
        ...assistantActions.services,
      },
      {
        id: "newService",
        href: webAdminRoutes.tenant.newService,
        icon: Plus,
        contexts: ["branch"],
        keywords: [...tenantSearchKeywords.newService],
        ...assistantActions.newService,
      },
      {
        id: "discounts",
        href: webAdminRoutes.tenant.discounts,
        icon: BadgePercent,
        contexts: ["branch", "user"],
        keywords: [...tenantSearchKeywords.discounts],
        ...assistantActions.discounts,
      },
      {
        id: "newDiscount",
        href: webAdminRoutes.tenant.newDiscount,
        icon: Plus,
        contexts: ["branch", "user"],
        keywords: [...tenantSearchKeywords.newDiscount],
        ...assistantActions.newDiscount,
      },
      {
        id: "branches",
        href: webAdminRoutes.tenant.branches,
        icon: Store,
        contexts: ["branch"],
        keywords: [...tenantSearchKeywords.branches],
        label: m.overview.quickEntries.branches.title,
        description: m.overview.quickEntries.branches.description,
      },
      {
        id: "newBranch",
        href: `${webAdminRoutes.tenant.branches}/new`,
        icon: Plus,
        contexts: ["branch"],
        keywords: [
          ...tenantSearchKeywords.newBranch,
          m.overview.searchComposer.recommendations[0] ?? "",
        ],
        label: m.overview.quickLinks.createBranch,
        description: m.overview.quickEntries.branches.description,
      },
      {
        id: "users",
        href: webAdminRoutes.tenant.users,
        icon: Users,
        contexts: ["mention", "user"],
        keywords: [
          ...tenantSearchKeywords.users,
          m.overview.searchComposer.recommendations[3] ?? "",
        ],
        label: messages.shell.tenant.header.account.employees,
        description: m.profile.access.description,
      },
      {
        id: "pointOfSale",
        href: webAdminRoutes.tenant.pointOfSale.home,
        icon: LaptopMinimal,
        contexts: ["branch"],
        keywords: [...tenantSearchKeywords.pointOfSale],
        label: m.pointOfSale.title,
        description: m.pointOfSale.description,
      },
      {
        id: "hardware",
        href: webAdminRoutes.tenant.hardware,
        icon: Printer,
        contexts: ["branch"],
        keywords: [
          ...tenantSearchKeywords.hardware,
          m.overview.searchComposer.recommendations[2] ?? "",
        ],
        label: m.overview.quickEntries.hardware.title,
        description: m.overview.quickEntries.hardware.description,
      },
      {
        id: "reports",
        href: webAdminRoutes.tenant.reports,
        icon: ChartNoAxesCombined,
        contexts: ["file", "branch"],
        keywords: [
          ...tenantSearchKeywords.reports,
          m.overview.searchComposer.recommendations[1] ?? "",
        ],
        ...assistantActions.reports,
      },
      {
        id: "finance",
        href: webAdminRoutes.tenant.finance,
        icon: HandCoins,
        contexts: ["file", "branch"],
        keywords: [...tenantSearchKeywords.finance],
        ...assistantActions.finance,
      },
      {
        id: "notifications",
        href: webAdminRoutes.tenant.notifications,
        icon: Bell,
        contexts: ["mention", "user"],
        keywords: [...tenantSearchKeywords.notifications],
        label: m.notificationCenter.title,
        description: m.notificationCenter.description,
      },
      {
        id: "logs",
        href: webAdminRoutes.tenant.system.logs,
        icon: FileText,
        contexts: ["file", "user"],
        keywords: [...tenantSearchKeywords.logs],
        label: m.auditLogs.title,
        description: m.settings.general.resourceDescriptions.activityLog,
      },
      {
        id: "backups",
        href: webAdminRoutes.tenant.system.backups,
        icon: DatabaseBackup,
        contexts: ["file"],
        keywords: [...tenantSearchKeywords.backups],
        label: m.backups.title,
        description: m.backups.description,
      },
      {
        id: "settings",
        href: webAdminRoutes.tenant.system.settings,
        icon: Settings,
        contexts: ["file", "branch", "user"],
        keywords: [...tenantSearchKeywords.settings],
        ...assistantActions.settings,
      },
      {
        id: "profile",
        href: webAdminRoutes.tenant.profile,
        icon: UserRound,
        contexts: ["user"],
        keywords: [...tenantSearchKeywords.profile],
        label: m.profile.title,
        description: m.profile.description,
      },
    ],
    [assistantActions, m, messages.shell.tenant.header.account.employees],
  );
  const normalizedQuery = normalizeSearchText(query);
  const searchResults = useMemo(
    () =>
      searchEntries
        .filter(
          (entry) =>
            !selectedContextType ||
            entry.contexts.includes(selectedContextType),
        )
        .map((entry) => ({
          entry,
          score: getSearchScore(entry, normalizedQuery),
        }))
        .filter((result) => result.score > 0)
        .sort(
          (left, right) =>
            right.score - left.score ||
            left.entry.label.localeCompare(right.entry.label),
        ),
    [normalizedQuery, searchEntries, selectedContextType],
  );
  const activeTenantDataSearch =
    tenantDataSearch?.query === query.trim() ? tenantDataSearch : null;
  const tenantDataGroups = tenantDataSearchGroupOrder
    .map((group) => ({
      group,
      label: m.overview.searchComposer.groupLabels[group],
      items: (activeTenantDataSearch?.groups[group] ?? []).filter(
        (item) =>
          !selectedContextType ||
          tenantDataSearchContexts[item.type].includes(selectedContextType),
      ),
    }))
    .filter(({ items }) => items.length > 0);
  const tenantDataItems = tenantDataGroups.flatMap(({ items }) => items);
  const tenantDataBadgeLabels: Record<
    TenantGlobalSearchEntityType,
    Record<string, string>
  > = {
    order: m.orders.paymentStatusLabels,
    customer: m.customers.statusLabels,
    product: m.products.statusLabels,
    service: m.common.statusLabels,
    branch: m.common.statusLabels,
    user: m.profile.statusLabels,
  };
  const visibleSearchResults = searchResults.slice(
    0,
    tenantDataItems.length > 0 ? 3 : 6,
  );
  const hasSearchIntent =
    normalizedQuery.length > 0 || selectedContextType !== null;
  const combinedResultCount = tenantDataItems.length + searchResults.length;
  const canSubmit = canSend && combinedResultCount > 0;
  const selectedContextLabel = contextTypes.find(
    (contextType) => contextType.id === selectedContextType,
  )?.copy.label;
  const addContextLabel = selectedContextLabel
    ? `${m.overview.searchComposer.addContextLabel}: ${selectedContextLabel}`
    : m.overview.searchComposer.addContextLabel;

  useEffect(() => {
    const searchQuery = query.trim();
    const controller = new AbortController();
    let active = true;

    if (!searchQuery) {
      return () => controller.abort();
    }

    const timeoutId = window.setTimeout(() => {
      setTenantDataSearchLoading(true);

      webAdminApi.tenant.search
        .global({ q: searchQuery, limit: 3 }, { signal: controller.signal })
        .then((result) => {
          if (active) {
            setTenantDataSearch(result);
          }
        })
        .catch(() => {
          if (active && !controller.signal.aborted) {
            setTenantDataSearchError(true);
          }
        })
        .finally(() => {
          if (active) {
            setTenantDataSearchLoading(false);
          }
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function handleDocumentPointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (searchAreaRef.current?.contains(target)) {
        return;
      }

      if (
        target instanceof Element &&
        target.closest('[data-testid="tenant-home-search-context-menu"]')
      ) {
        return;
      }

      setIsSearchActive(false);
      setIsContextMenuOpen(false);
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown);

    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
    };
  }, []);

  function handleSearchAreaBlur(event: FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;

    if (isContextMenuOpen) {
      return;
    }

    if (
      nextTarget instanceof Node &&
      event.currentTarget.contains(nextTarget)
    ) {
      return;
    }

    setIsSearchActive(false);
    setIsContextMenuOpen(false);
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    openBestResult();
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    setTenantDataSearch(null);
    setTenantDataSearchError(false);
    setTenantDataSearchLoading(false);
  }

  function openBestResult() {
    const firstResultHref =
      tenantDataItems[0]?.href ?? searchResults[0]?.entry.href;

    if (!canSend || !firstResultHref) {
      return;
    }

    setQuery(query.trim());
    router.push(firstResultHref);
  }

  function handleContextTypeSelect(contextType: SearchContextType) {
    setSelectedContextType((current) =>
      current === contextType ? null : contextType,
    );
    setIsContextMenuOpen(false);
    inputRef.current?.focus();
  }

  function handleSearchInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !isComposingRef.current) {
      event.preventDefault();
      openBestResult();
      return;
    }

    if (event.key === "ArrowDown" && combinedResultCount > 0) {
      event.preventDefault();
      firstResultRef.current?.focus();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      handleQueryChange("");
      setSelectedContextType(null);
      setIsContextMenuOpen(false);
      setIsSearchActive(false);
      inputRef.current?.blur();
    }
  }

  function handleRecommendationSelect(recommendation: string) {
    handleQueryChange(recommendation);
    inputRef.current?.focus();
  }

  function handleSearchResultNavigate() {
    setIsSearchActive(false);
    setIsContextMenuOpen(false);
  }

  return (
    <section
      className="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-5xl flex-col justify-start pb-8 pt-14"
      data-testid="tenant-home-search-panel"
    >
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          {m.overview.welcomeTitle}
        </h1>

        <div
          className="relative mx-auto mt-6 w-full max-w-lg"
          onBlurCapture={handleSearchAreaBlur}
          onFocusCapture={() => setIsSearchActive(true)}
          ref={searchAreaRef}
        >
          <form className="relative" onSubmit={handleSearchSubmit}>
            <label className="sr-only" htmlFor="tenant-home-search">
              {m.overview.searchLabel}
            </label>
            <Icon
              aria-hidden
              className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-muted-foreground"
              icon={Search}
              size={18}
            />
            <Input
              aria-controls="tenant-home-search-results"
              autoComplete="off"
              className="h-12 rounded-full border-border bg-background pl-11 pr-24 text-sm shadow-sm transition-shadow placeholder:text-muted-foreground focus-visible:shadow-md focus-visible:ring-2"
              data-testid="tenant-home-search"
              id="tenant-home-search"
              inputMode="search"
              onChange={(event) => handleQueryChange(event.target.value)}
              onCompositionEnd={() => {
                isComposingRef.current = false;
              }}
              onCompositionStart={() => {
                isComposingRef.current = true;
              }}
              onKeyDown={handleSearchInputKeyDown}
              placeholder={m.overview.searchPlaceholder}
              ref={inputRef}
              role="searchbox"
              type="text"
              value={query}
            />

            <div className="absolute right-2 top-1/2 z-20 flex -translate-y-1/2 items-center gap-1">
              <Popover
                onOpenChange={(open) => {
                  setIsContextMenuOpen(open);

                  if (open) {
                    setIsSearchActive(true);
                  }
                }}
                open={isContextMenuOpen}
              >
                <PopoverTrigger asChild>
                  <button
                    aria-label={addContextLabel}
                    className="relative flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid="tenant-home-search-add-context"
                    title={addContextLabel}
                    type="button"
                  >
                    <Icon aria-hidden icon={Plus} size={18} />
                    {selectedContextType ? (
                      <span className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-foreground ring-2 ring-background" />
                    ) : null}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  aria-label={m.overview.searchComposer.contextMenuLabel}
                  className="w-72 rounded-2xl p-2"
                  data-testid="tenant-home-search-context-menu"
                  sideOffset={8}
                >
                  {contextTypes.map((contextType) => {
                    const ContextIcon = contextType.icon;
                    const selected = selectedContextType === contextType.id;

                    return (
                      <button
                        aria-pressed={selected}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        key={contextType.id}
                        onClick={() => handleContextTypeSelect(contextType.id)}
                        type="button"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                          <Icon aria-hidden icon={ContextIcon} size={17} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">
                            {contextType.copy.label}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {contextType.copy.description}
                          </span>
                        </span>
                        {selected ? (
                          <Icon
                            aria-hidden
                            className="text-foreground"
                            icon={Check}
                            size={16}
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </PopoverContent>
              </Popover>
              <button
                aria-label={m.overview.searchComposer.sendLabel}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  canSubmit
                    ? "bg-foreground text-background hover:bg-foreground/85"
                    : "cursor-not-allowed bg-muted text-muted-foreground",
                )}
                data-testid="tenant-home-search-send"
                disabled={!canSubmit}
                title={m.overview.searchComposer.sendLabel}
                type="submit"
              >
                <Icon aria-hidden icon={ArrowUp} size={18} />
              </button>
            </div>
          </form>

          <div
            aria-hidden={!showSearchMode}
            className={cn(
              "grid transition-[grid-template-rows,opacity,transform,margin] duration-200 ease-out motion-reduce:transform-none motion-reduce:transition-none",
              showSearchMode
                ? "mt-5 grid-rows-[1fr] translate-y-0 opacity-100"
                : "pointer-events-none mt-0 grid-rows-[0fr] -translate-y-2 opacity-0",
            )}
            data-testid="tenant-home-search-recommendations-transition"
            inert={!showSearchMode}
          >
            <div className="overflow-hidden">
              {hasSearchIntent ? (
                <div
                  aria-busy={tenantDataSearchLoading}
                  aria-live="polite"
                  className="max-h-[65vh] overflow-y-auto pr-1"
                  data-testid="tenant-home-search-results"
                  id="tenant-home-search-results"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {selectedContextLabel ??
                        m.overview.searchComposer.resultsTitle}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {m.overview.searchComposer.resultCount.replace(
                        "{count}",
                        String(combinedResultCount),
                      )}
                    </span>
                  </div>

                  {tenantDataSearchLoading ? (
                    <div className="mt-3 flex items-center gap-2 rounded-xl border bg-background px-4 py-3 text-sm text-muted-foreground">
                      <Icon
                        aria-hidden
                        className="animate-spin"
                        icon={LoaderCircle}
                        size={16}
                      />
                      <span>{m.overview.searchComposer.loadingLabel}</span>
                    </div>
                  ) : null}

                  {tenantDataSearchError ? (
                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                      <Icon aria-hidden icon={CircleAlert} size={16} />
                      <span>{m.overview.searchComposer.loadError}</span>
                    </div>
                  ) : null}

                  {tenantDataGroups.length > 0 ? (
                    <div className="mt-3">
                      <p className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {m.overview.searchComposer.dataResultsTitle}
                      </p>
                      <div className="mt-2 grid gap-3">
                        {tenantDataGroups.map((dataGroup) => (
                          <section key={dataGroup.group}>
                            <p className="mb-1.5 text-left text-xs font-medium text-foreground">
                              {dataGroup.label}
                            </p>
                            <div className="grid gap-2">
                              {dataGroup.items.map((item) => (
                                <TenantSearchResultLink
                                  badge={
                                    item.badge
                                      ? (tenantDataBadgeLabels[item.type][
                                          item.badge
                                        ] ?? item.badge)
                                      : undefined
                                  }
                                  description={item.subtitle}
                                  href={item.href}
                                  icon={tenantDataSearchIcons[item.type]}
                                  key={`${item.type}-${item.id}`}
                                  label={item.title}
                                  onClick={handleSearchResultNavigate}
                                  resultRef={
                                    item === tenantDataItems[0]
                                      ? firstResultRef
                                      : undefined
                                  }
                                  testId={`tenant-home-data-search-result-${item.type}-${item.id}`}
                                />
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {visibleSearchResults.length > 0 ? (
                    <div className="mt-3">
                      <p className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {m.overview.searchComposer.navigationResultsTitle}
                      </p>
                      <div className="mt-2 grid gap-2">
                        {visibleSearchResults.map(({ entry }, index) => (
                          <TenantSearchResultLink
                            description={entry.description}
                            href={entry.href}
                            icon={entry.icon}
                            key={entry.id}
                            label={entry.label}
                            onClick={handleSearchResultNavigate}
                            resultRef={
                              tenantDataItems.length === 0 && index === 0
                                ? firstResultRef
                                : undefined
                            }
                            testId={`tenant-home-search-result-${entry.id}`}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {!tenantDataSearchLoading &&
                  !tenantDataSearchError &&
                  combinedResultCount === 0 ? (
                    <div className="mt-2 rounded-xl border border-dashed bg-background px-5 py-8 text-center">
                      <p className="text-sm font-semibold">
                        {m.overview.searchComposer.emptyTitle}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {m.overview.searchComposer.emptyDescription}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div data-testid="tenant-home-search-recommendations">
                  <p className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {m.overview.searchComposer.recommendationsTitle}
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {m.overview.searchComposer.recommendations.map(
                      (recommendation) => (
                        <button
                          className="group flex min-h-12 items-center gap-3 rounded-xl border bg-background px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          key={recommendation}
                          onClick={() =>
                            handleRecommendationSelect(recommendation)
                          }
                          tabIndex={showSearchMode ? 0 : -1}
                          type="button"
                        >
                          <Icon
                            aria-hidden
                            className="text-muted-foreground transition-colors group-hover:text-foreground"
                            icon={Sparkles}
                            size={16}
                          />
                          <span>{recommendation}</span>
                        </button>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div
        aria-hidden={showSearchMode}
        className={cn(
          "grid transition-[grid-template-rows,opacity,transform,margin] duration-200 ease-out motion-reduce:transform-none motion-reduce:transition-none",
          showSearchMode
            ? "pointer-events-none mt-0 grid-rows-[0fr] -translate-y-2 opacity-0"
            : "mt-10 grid-rows-[1fr] translate-y-0 opacity-100",
        )}
        data-testid="tenant-home-quick-entries-transition"
        inert={showSearchMode}
      >
        <div className="overflow-hidden">
          <div
            className="grid gap-4 pb-1 md:grid-cols-2 xl:grid-cols-3"
            data-testid="tenant-home-quick-entries"
          >
            {quickEntries.map((entry) => {
              const EntryIcon = entry.icon;

              return (
                <Link
                  className="group flex min-h-36 flex-col justify-between rounded-2xl border bg-background p-5 shadow-sm transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-1 hover:border-foreground/20 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none"
                  href={entry.href}
                  key={entry.href}
                  tabIndex={showSearchMode ? -1 : undefined}
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-foreground transition-[transform,background-color,color] duration-200 group-hover:scale-105 group-hover:bg-foreground group-hover:text-background">
                      <Icon aria-hidden icon={EntryIcon} size={20} />
                    </span>
                    <Icon
                      aria-hidden
                      className="text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
                      icon={ArrowUpRight}
                    />
                  </div>
                  <div className="mt-5">
                    <h2 className="text-lg font-semibold">
                      {entry.copy.title}
                    </h2>
                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                      {entry.copy.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
