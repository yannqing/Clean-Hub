"use client";

import {
  Badge,
  Button,
  Icon,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
  toast,
} from "@cleanhub/ui";
import { DataTable, DataTableMetricCards } from "@cleanhub/ui/data-table";
import {
  Check,
  CircleCheck,
  CircleOff,
  ListFilter,
  RefreshCw,
  Search,
  Store,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { interpolate, useTenantI18n } from "@/i18n";

import { updateBranchStatusAction } from "../actions";
import { BRANCH_LIST_LIMIT, useBranchListQuery } from "../queries";
import type { BranchListFilters, BranchStatus, BranchSummary } from "../types";

type StatusFilter = "all" | BranchStatus;

function getBranchStatusVariant(status: BranchStatus): "default" | "outline" {
  return status === "active" ? "default" : "outline";
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function branchDetailHref(basePath: string, branchId: string): string {
  return `${basePath}/${branchId}`;
}

function buildBranchListUrl(pathname: string, filters: BranchListFilters) {
  const params = new URLSearchParams();

  if (filters.q) {
    params.set("q", filters.q);
  }

  if (filters.status) {
    params.set("status", filters.status);
  }

  const queryString = params.toString();

  return queryString ? `${pathname}?${queryString}` : pathname;
}

export type BranchManagementViewProps = {
  basePath?: string;
  embedded?: boolean;
  initialBranches?: BranchSummary[];
  initialError?: string;
  initialFilters?: BranchListFilters;
};

export function BranchManagementView({
  basePath = webAdminRoutes.tenant.branches,
  embedded = false,
  initialBranches,
  initialError,
  initialFilters,
}: BranchManagementViewProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const { m, formatDateTime } = useTenantI18n();
  const [status, setStatus] = useState<StatusFilter>(
    initialFilters?.status ?? "all",
  );
  const [query, setQuery] = useState(initialFilters?.q ?? "");
  const [saving, setSaving] = useState(false);

  const filters: BranchListFilters = useMemo(
    () => ({
      q: query.trim() || undefined,
      status: status === "all" ? undefined : status,
    }),
    [query, status],
  );

  const {
    data: branches = [],
    error,
    refetch,
    isFetching,
  } = useBranchListQuery(filters, {
    // SSR 预取结果作为 initialData，实现 hydrate；
    // 写操作（Server Action）成功后 revalidatePath 触发 RSC 重取，
    // 新的 initialData 流入，数据自动更新。
    initialData: initialBranches,
  });

  // 筛选条件变化时同步 URL（保留可分享/可刷新的链接）。
  useEffect(() => {
    router.replace(buildBranchListUrl(pathname, filters), { scroll: false });
  }, [filters, pathname, router]);

  // initialError 仅在首次 SSR 预取失败时存在；client 端错误改由 useQuery 的 error 接管。
  const errorMessage =
    initialError ??
    (error ? getErrorMessage(error, m.common.requestFailed) : null);
  const loading = isFetching && branches.length === 0;
  const statusOptions: Array<{ label: string; value: StatusFilter }> = [
    { label: m.common.allStatuses, value: "all" },
    { label: m.common.statusLabels.active, value: "active" },
    { label: m.common.statusLabels.inactive, value: "inactive" },
  ];
  const selectedStatusLabel =
    statusOptions.find((option) => option.value === status)?.label ??
    m.common.allStatuses;
  const metrics = useMemo(
    () => [
      {
        icon: Store,
        label: m.branches.metrics.total,
        value: branches.length.toLocaleString(),
      },
      {
        icon: CircleCheck,
        label: m.branches.metrics.active,
        value: branches
          .filter((branch) => branch.status === "active")
          .length.toLocaleString(),
      },
      {
        icon: CircleOff,
        label: m.branches.metrics.inactive,
        value: branches
          .filter((branch) => branch.status === "inactive")
          .length.toLocaleString(),
      },
    ],
    [branches, m.branches.metrics],
  );

  async function handleStatusChange(branch: BranchSummary) {
    setSaving(true);

    try {
      const nextStatus: BranchStatus =
        branch.status === "active" ? "inactive" : "active";
      const result = await updateBranchStatusAction(
        branch.id,
        nextStatus,
        branch.version,
      );

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(m.branches.list.statusUpdated);
      await refetch();
    } catch (statusError) {
      const message = getErrorMessage(statusError, m.common.requestFailed);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className={cn("space-y-7 pb-8", embedded && "space-y-4 pb-0")}
      data-testid="tenant-branches-view"
    >
      <header className="flex items-center justify-between gap-3">
        {!embedded ? (
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Icon aria-hidden icon={Store} size={19} />
            <span>{m.branches.title}</span>
          </h1>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            asChild
            className="h-8 gap-1.5 px-2.5 text-xs"
            size="sm"
            type="button"
          >
            <Link href={`${basePath}/new`}>{m.branches.newBranch}</Link>
          </Button>
          <Button
            aria-label={m.common.refresh}
            className="h-8 gap-1.5 px-2.5 text-xs"
            disabled={loading}
            onClick={() => refetch()}
            size="sm"
            title={m.common.refresh}
            type="button"
            variant="outline"
          >
            <Icon aria-hidden icon={RefreshCw} size={14} />
            <span>{m.common.refresh}</span>
          </Button>
        </div>
      </header>

      {!embedded ? (
        <DataTableMetricCards
          ariaLabel={m.branches.title}
          className="xl:grid-cols-3"
          loading={loading}
          metrics={metrics}
        />
      ) : null}

      {errorMessage ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <section className="min-w-0 border-y bg-background">
        <div className="flex items-center gap-2 border-b px-3 py-2.5">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                aria-label={`${m.common.status}: ${selectedStatusLabel}`}
                className={cn(status !== "all" && "bg-accent")}
                size="icon-sm"
                title={`${m.common.status}: ${selectedStatusLabel}`}
                type="button"
                variant="outline"
              >
                <Icon aria-hidden icon={ListFilter} size={15} />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-44 p-1.5">
              <div className="grid gap-1">
                {statusOptions.map((option) => (
                  <button
                    aria-pressed={status === option.value}
                    className={cn(
                      "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs transition-colors hover:bg-accent",
                      status === option.value && "bg-accent",
                    )}
                    key={option.value}
                    onClick={() => setStatus(option.value)}
                    type="button"
                  >
                    <Icon
                      aria-hidden
                      className={cn(
                        status === option.value ? "opacity-100" : "opacity-0",
                      )}
                      icon={Check}
                      size={14}
                    />
                    {option.label}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <div className="relative w-full max-w-sm">
            <label className="sr-only" htmlFor="branch-search">
              {m.common.search}
            </label>
            <Icon
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              icon={Search}
              size={14}
            />
            <Input
              className="h-8 pl-8 text-xs"
              id="branch-search"
              inputMode="search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={m.branches.list.searchPlaceholder}
              type="text"
              value={query}
            />
          </div>
        </div>

        {branches.length === BRANCH_LIST_LIMIT ? (
          <div className="border-b px-3 py-2 text-xs text-muted-foreground">
            {interpolate(m.branches.list.limitedHint, {
              limit: String(BRANCH_LIST_LIMIT),
            })}
          </div>
        ) : null}

        {loading ? (
          <div className="grid gap-2 p-3">
            {[0, 1, 2].map((item) => (
              <div
                className="h-10 animate-pulse rounded-md bg-muted"
                key={item}
              />
            ))}
          </div>
        ) : branches.length === 0 ? (
          <div className="p-3">
            <div className="rounded-md border border-dashed px-4 py-10 text-center">
              <h2 className="text-sm font-semibold">{m.branches.list.empty}</h2>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <DataTable className="text-xs [&_td]:px-1.5 [&_td]:py-1.5 [&_th]:h-8 [&_th]:px-1.5">
              <TableHeader>
                <TableRow>
                  <TableHead>{m.branches.list.columns.branch}</TableHead>
                  <TableHead>{m.branches.list.columns.contact}</TableHead>
                  <TableHead>{m.branches.list.columns.defaults}</TableHead>
                  <TableHead>{m.branches.list.columns.status}</TableHead>
                  <TableHead>{m.branches.list.columns.updated}</TableHead>
                  <TableHead className="text-right">
                    {m.branches.list.columns.actions}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.map((branch) => (
                  <TableRow
                    className="cursor-pointer hover:bg-muted/40"
                    key={branch.id}
                    onClick={() => router.push(branchDetailHref(basePath, branch.id))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(branchDetailHref(basePath, branch.id));
                      }
                    }}
                    onMouseEnter={() =>
                      router.prefetch(branchDetailHref(basePath, branch.id))
                    }
                    role="link"
                    tabIndex={0}
                  >
                    <TableCell>
                      <div className="font-medium">{branch.name}</div>
                      <div className="max-w-56 truncate text-[11px] text-muted-foreground">
                        {branch.address ?? m.common.notSet}
                      </div>
                    </TableCell>
                    <TableCell>{branch.phone ?? m.common.notSet}</TableCell>
                    <TableCell>
                      {m.common.languageLabels[branch.defaultLanguage]} /{" "}
                      {branch.defaultCurrency}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getBranchStatusVariant(branch.status)}>
                        {m.common.statusLabels[branch.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatDateTime(branch.updatedAt) || m.common.notUpdated}
                    </TableCell>
                    <TableCell className="space-x-1.5 text-right">
                      <Button
                        className="h-7 px-2 text-xs"
                        disabled={saving}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleStatusChange(branch);
                        }}
                        onKeyDown={(event) => event.stopPropagation()}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {branch.status === "active"
                          ? m.common.disable
                          : m.common.enable}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          </div>
        )}
      </section>
    </section>
  );
}
