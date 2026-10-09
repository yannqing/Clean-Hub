"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Icon,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
  toast,
} from "@cleanhub/ui";
import { DataTable } from "@cleanhub/ui/data-table";
import {
  BadgePercent,
  Download,
  Ellipsis,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  useState,
  useTransition,
} from "react";

import { Pagination } from "@/components/pagination";
import { webAdminRoutes } from "@/config/routes";
import { isVersionConflict } from "@/features/tenant/shared/version-conflict";
import { interpolate, useTenantI18n } from "@/i18n";
import { formatMoney } from "@/lib/format";

import {
  deleteDiscountAction,
  exportDiscountsAction,
  updateDiscountStatusAction,
} from "../actions";
import {
  DISCOUNT_METHODS,
  DISCOUNT_PAGE_SIZE,
  DISCOUNT_STATUSES,
  DISCOUNT_TYPES,
} from "../constants";
import { downloadDiscountCsv } from "../export";
import type {
  DiscountDerivedStatus,
  DiscountMethod,
  DiscountType,
  TenantDiscountListQuery,
  TenantDiscountListOptions,
  TenantDiscountListResponse,
  TenantDiscountSort,
  TenantDiscountSummary,
} from "../types";
import { DiscountStatusBadge } from "./discount-status-badge";
import { DiscountTypePicker } from "./discount-type-picker";

const ALL_VALUE = "__all__";

type DiscountListViewProps = {
  error?: string;
  options?: TenantDiscountListOptions;
  optionsError?: string;
  query: TenantDiscountListQuery;
  result?: TenantDiscountListResponse;
};

function formatDiscountValue(
  discount: TenantDiscountSummary,
  locale: string,
  freeLabel: string,
): string {
  if (discount.valueType === "free") return freeLabel;

  const amount = Number(discount.valueAmount);
  if (!Number.isFinite(amount)) return "—";

  if (discount.valueType === "percentage") {
    return `${new Intl.NumberFormat(locale, {
      maximumFractionDigits: 2,
    }).format(amount)}%`;
  }

  return discount.currency
    ? formatMoney(amount, discount.currency, locale)
    : String(amount);
}

function exportFilename(): string {
  return `cleanhub-discounts-${new Date().toISOString().slice(0, 10)}.csv`;
}

export function DiscountListView({
  error,
  options,
  optionsError,
  query,
  result,
}: DiscountListViewProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { formatDateTime, locale, m } = useTenantI18n();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(query.q ?? "");
  const [exporting, setExporting] = useState(false);
  const [pendingDelete, setPendingDelete] =
    useState<TenantDiscountSummary | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const canManage = options?.canManage === true;

  function navigate(
    changes: Partial<TenantDiscountListQuery>,
    remove: Array<keyof TenantDiscountListQuery> = [],
  ) {
    const next: TenantDiscountListQuery = { ...query, ...changes };
    for (const key of remove) delete next[key];
    const params = new URLSearchParams();

    if (next.q) params.set("q", next.q);
    if (next.status) params.set("status", next.status);
    if (next.method) params.set("method", next.method);
    if (next.type) params.set("type", next.type);
    if (next.branchId) params.set("branchId", next.branchId);
    if (next.sort && next.sort !== "created_desc") {
      params.set("sort", next.sort);
    }
    if (next.offset) params.set("offset", String(next.offset));

    startTransition(() => {
      router.push(params.size ? `${pathname}?${params}` : pathname);
    });
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = search.trim();
    navigate(
      { q: value || undefined, offset: 0 },
      value ? ["offset"] : ["q", "offset"],
    );
  }

  function openDiscountFromRow(
    event: ReactMouseEvent<HTMLTableRowElement>,
    discountId: string,
  ) {
    const target = event.target;

    if (
      target instanceof Element &&
      target.closest("a, button, input, select, textarea, [role='button']")
    ) {
      return;
    }

    router.push(webAdminRoutes.tenant.discount(discountId));
  }

  function getCsvHeaders(): string[] {
    return [
      m.discounts.list.columns.discount,
      m.discounts.methods.code,
      m.discounts.list.columns.status,
      m.discounts.list.columns.method,
      m.discounts.list.columns.type,
      m.discounts.form.fields.valueType,
      m.discounts.list.columns.value,
      m.discounts.form.fields.currency,
      m.discounts.list.columns.uses,
      m.discounts.form.fields.usageLimit,
      m.discounts.list.columns.startsAt,
      m.discounts.list.columns.endsAt,
      m.discounts.form.sections.branches,
      m.discounts.form.fields.posEnabled,
    ];
  }

  function exportRows(rows: TenantDiscountSummary[]) {
    if (rows.length === 0) {
      toast.error(m.discounts.exportEmpty);
      return;
    }

    downloadDiscountCsv(rows, getCsvHeaders(), exportFilename(), {
      statuses: {
        active: m.discounts.statuses.active,
        scheduled: m.discounts.statuses.scheduled,
        expired: m.discounts.statuses.expired,
        inactive: m.discounts.statuses.inactive,
      },
      methods: {
        code: m.discounts.methods.code,
        automatic: m.discounts.methods.automatic,
      },
      types: {
        amount_off_items: m.discounts.types.amount_off_items,
        buy_x_get_y: m.discounts.types.buy_x_get_y,
        amount_off_order: m.discounts.types.amount_off_order,
        free_shipping: m.discounts.types.free_shipping,
      },
      valueTypes: m.discounts.valueTypes,
      allBranches: m.discounts.list.allBranches,
      enabled: m.discounts.list.enabledValue,
      disabled: m.discounts.list.disabledValue,
    });
  }

  async function exportCurrentSearch() {
    setExporting(true);

    try {
      const actionResult = await exportDiscountsAction({
        q: query.q,
        status: query.status,
        method: query.method,
        type: query.type,
        branchId: query.branchId,
        sort: query.sort,
      });

      if (!actionResult.ok) {
        toast.error(m.discounts.loadError);
        return;
      }

      exportRows(actionResult.data);
    } catch {
      toast.error(m.discounts.loadError);
    } finally {
      setExporting(false);
    }
  }

  async function toggleStatus(discount: TenantDiscountSummary) {
    setMutatingId(discount.id);

    try {
      const actionResult = await updateDiscountStatusAction(
        discount.id,
        !discount.enabled,
        discount.version,
      );

      if (!actionResult.ok) {
        toast.error(
          isVersionConflict(actionResult)
            ? m.discounts.form.versionConflict
            : m.discounts.form.saveFailed,
        );
        return;
      }

      toast.success(m.discounts.statusUpdated);
      router.refresh();
    } catch {
      toast.error(m.discounts.form.saveFailed);
    } finally {
      setMutatingId(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;

    setMutatingId(pendingDelete.id);

    try {
      const actionResult = await deleteDiscountAction(
        pendingDelete.id,
        pendingDelete.version,
      );

      if (!actionResult.ok) {
        toast.error(
          isVersionConflict(actionResult)
            ? m.discounts.form.versionConflict
            : m.discounts.form.saveFailed,
        );
        return;
      }

      setPendingDelete(null);
      toast.success(m.discounts.deleted);
      router.refresh();
    } catch {
      toast.error(m.discounts.form.saveFailed);
    } finally {
      setMutatingId(null);
    }
  }

  const sortLabels: Record<TenantDiscountSort, string> = {
    created_desc: m.discounts.list.sortOptions.createdDesc,
    created_asc: m.discounts.list.sortOptions.createdAsc,
    updated_desc: m.discounts.list.sortOptions.updatedDesc,
    title_asc: m.discounts.list.sortOptions.titleAsc,
    title_desc: m.discounts.list.sortOptions.titleDesc,
    starts_at_desc: m.discounts.list.sortOptions.startsDesc,
    usage_desc: m.discounts.list.sortOptions.usageDesc,
  };
  const currentSort = query.sort ?? "created_desc";
  function formatCombinations(discount: TenantDiscountSummary): string {
    const labels = [
      discount.combinesWithItemDiscounts
        ? m.discounts.list.combinationItem
        : null,
      discount.combinesWithOrderDiscounts
        ? m.discounts.list.combinationOrder
        : null,
      discount.combinesWithShippingDiscounts
        ? m.discounts.list.combinationShipping
        : null,
    ].filter((label): label is string => Boolean(label));

    return labels.join(", ") || m.discounts.list.noCombinations;
  }

  return (
    <section
      className={cn(
        "space-y-5 pb-8 transition-opacity",
        isPending && "opacity-60",
      )}
      data-testid="tenant-discounts-view"
    >
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Icon aria-hidden icon={BadgePercent} size={19} />
            {m.discounts.title}
          </h1>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {m.discounts.description}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                disabled={!result || exporting}
                size="sm"
                type="button"
                variant="outline"
              >
                <Icon aria-hidden icon={Download} size={14} />
                {m.discounts.exportAction}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 p-1.5">
              <button
                className="flex h-8 w-full items-center rounded-md px-2 text-left text-xs hover:bg-accent"
                onClick={() => exportRows(result?.data ?? [])}
                type="button"
              >
                {m.discounts.exportCurrentPage}
              </button>
              <button
                className="flex h-8 w-full items-center rounded-md px-2 text-left text-xs hover:bg-accent disabled:opacity-50"
                disabled={exporting}
                onClick={exportCurrentSearch}
                type="button"
              >
                {m.discounts.exportCurrentSearch}
              </button>
            </PopoverContent>
          </Popover>

          <DiscountTypePicker canManage={canManage} />
        </div>
      </header>

      {!canManage && options ? (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          {m.discounts.permissionDescription}
        </div>
      ) : null}

      {optionsError ? (
        <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {m.discounts.optionsLoadError}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border bg-background">
        <div className="flex gap-1 overflow-x-auto border-b px-3 pt-2">
          {(["all", ...DISCOUNT_STATUSES] as const).map((status) => {
            const active =
              status === "all" ? !query.status : query.status === status;
            return (
              <button
                aria-pressed={active}
                className={cn(
                  "relative shrink-0 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                  active && "text-foreground",
                )}
                key={status}
                onClick={() =>
                  navigate(
                    {
                      status:
                        status === "all"
                          ? undefined
                          : (status as DiscountDerivedStatus),
                      offset: 0,
                    },
                    status === "all" ? ["status", "offset"] : ["offset"],
                  )
                }
                type="button"
              >
                {m.discounts.statuses[status]}
                <span
                  className={cn(
                    "absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-foreground opacity-0",
                    active && "opacity-100",
                  )}
                />
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 border-b p-3 xl:flex-row xl:items-center">
          <form className="flex min-w-0 flex-1 gap-2" onSubmit={submitSearch}>
            <div className="relative w-full max-w-sm">
              <Icon
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                icon={Search}
                size={14}
              />
              <Input
                aria-label={m.discounts.list.searchPlaceholder}
                className="h-8 pl-8 text-xs"
                onChange={(event) => setSearch(event.target.value)}
                placeholder={m.discounts.list.searchPlaceholder}
                value={search}
              />
            </div>
            <Button className="h-8" size="sm" type="submit" variant="outline">
              {m.common.search}
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            <Select
              onValueChange={(value) =>
                navigate(
                  {
                    method:
                      value === ALL_VALUE
                        ? undefined
                        : (value as DiscountMethod),
                    offset: 0,
                  },
                  value === ALL_VALUE ? ["method", "offset"] : ["offset"],
                )
              }
              value={query.method ?? ALL_VALUE}
            >
              <SelectTrigger className="h-8 min-w-36 text-xs" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>
                  {m.discounts.methods.all}
                </SelectItem>
                {DISCOUNT_METHODS.map((method) => (
                  <SelectItem key={method} value={method}>
                    {m.discounts.methods[method]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              onValueChange={(value) =>
                navigate(
                  {
                    type:
                      value === ALL_VALUE ? undefined : (value as DiscountType),
                    offset: 0,
                  },
                  value === ALL_VALUE ? ["type", "offset"] : ["offset"],
                )
              }
              value={query.type ?? ALL_VALUE}
            >
              <SelectTrigger className="h-8 min-w-40 text-xs" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>
                  {m.discounts.types.all}
                </SelectItem>
                {DISCOUNT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {m.discounts.types[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              disabled={!options}
              onValueChange={(value) =>
                navigate(
                  {
                    branchId: value === ALL_VALUE ? undefined : value,
                    offset: 0,
                  },
                  value === ALL_VALUE ? ["branchId", "offset"] : ["offset"],
                )
              }
              value={query.branchId ?? ALL_VALUE}
            >
              <SelectTrigger className="h-8 min-w-36 text-xs" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>
                  {m.discounts.list.allBranches}
                </SelectItem>
                {options?.branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              onValueChange={(value) =>
                navigate({ sort: value as TenantDiscountSort, offset: 0 }, [
                  "offset",
                ])
              }
              value={currentSort}
            >
              <SelectTrigger className="h-8 min-w-36 text-xs" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(sortLabels) as TenantDiscountSort[]).map(
                  (sort) => (
                    <SelectItem key={sort} value={sort}>
                      {sortLabels[sort]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error ? (
          <div className="px-4 py-12 text-center text-sm text-destructive">
            {m.discounts.loadError}
          </div>
        ) : !result || result.data.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <h2 className="text-base font-semibold">
              {m.discounts.emptyTitle}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {m.discounts.emptyDescription}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <DataTable className="min-w-[1160px] text-xs">
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>{m.discounts.list.columns.discount}</TableHead>
                  <TableHead>{m.discounts.list.columns.status}</TableHead>
                  <TableHead>{m.discounts.list.columns.method}</TableHead>
                  <TableHead>{m.discounts.list.columns.type}</TableHead>
                  <TableHead>{m.discounts.list.columns.value}</TableHead>
                  <TableHead>{m.discounts.list.columns.combinations}</TableHead>
                  <TableHead>{m.discounts.list.columns.uses}</TableHead>
                  <TableHead>{m.discounts.list.columns.startsAt}</TableHead>
                  <TableHead>{m.discounts.list.columns.endsAt}</TableHead>
                  <TableHead className="text-right">
                    {m.discounts.list.columns.actions}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.data.map((discount) => (
                  <TableRow
                    className="cursor-pointer transition-colors hover:bg-muted/50"
                    key={discount.id}
                    onClick={(event) =>
                      openDiscountFromRow(event, discount.id)
                    }
                  >
                    <TableCell>
                      <Link
                        className="block max-w-52 truncate font-medium hover:underline"
                        href={webAdminRoutes.tenant.discount(discount.id)}
                      >
                        {discount.title}
                      </Link>
                      <span className="mt-0.5 block max-w-52 truncate text-[10px] text-muted-foreground">
                        {discount.code ?? m.discounts.list.noCode}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DiscountStatusBadge status={discount.status} />
                    </TableCell>
                    <TableCell>
                      {m.discounts.methods[discount.method]}
                    </TableCell>
                    <TableCell>{m.discounts.types[discount.type]}</TableCell>
                    <TableCell className="font-medium">
                      {formatDiscountValue(
                        discount,
                        locale,
                        m.discounts.valueTypes.free,
                      )}
                    </TableCell>
                    <TableCell className="max-w-44 text-muted-foreground">
                      {formatCombinations(discount)}
                    </TableCell>
                    <TableCell>
                      {discount.usageCount.toLocaleString(locale)}
                      <span className="text-muted-foreground">
                        {" / "}
                        {discount.usageLimit?.toLocaleString(locale) ??
                          m.discounts.list.unlimited}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(discount.startsAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {discount.endsAt
                        ? formatDateTime(discount.endsAt)
                        : m.discounts.list.noEndDate}
                    </TableCell>
                    <TableCell className="text-right">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            aria-label={m.common.actions}
                            disabled={
                              mutatingId === discount.id || !discount.canManage
                            }
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                          >
                            <Icon aria-hidden icon={Ellipsis} size={15} />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-40 p-1.5">
                          <Button
                            asChild
                            className="h-8 w-full justify-start text-xs"
                            size="sm"
                            variant="ghost"
                          >
                            <Link
                              href={webAdminRoutes.tenant.discount(discount.id)}
                            >
                              <Icon aria-hidden icon={Pencil} size={13} />
                              {m.discounts.list.edit}
                            </Link>
                          </Button>
                          <button
                            className="flex h-8 w-full items-center rounded-md px-2 text-left text-xs hover:bg-accent"
                            onClick={() => toggleStatus(discount)}
                            type="button"
                          >
                            {discount.enabled
                              ? m.discounts.list.disable
                              : m.discounts.list.enable}
                          </button>
                          <button
                            className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs text-destructive hover:bg-destructive/10"
                            onClick={() => setPendingDelete(discount)}
                            type="button"
                          >
                            <Icon aria-hidden icon={Trash2} size={13} />
                            {m.discounts.list.delete}
                          </button>
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          </div>
        )}

        {result ? (
          <Pagination
            currentPageCount={result.data.length}
            formatCountLabel={({ from, to, total }) =>
              interpolate(m.discounts.pageCount, {
                from: from.toLocaleString(locale),
                to: to.toLocaleString(locale),
                total: total.toLocaleString(locale),
              })
            }
            nextLabel={m.common.next}
            offset={result.offset}
            onOffsetChange={(offset) => navigate({ offset })}
            pageSize={DISCOUNT_PAGE_SIZE}
            previousLabel={m.common.previous}
            total={result.total}
          />
        ) : null}
      </section>

      <Dialog
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        open={Boolean(pendingDelete)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m.discounts.list.deleteTitle}</DialogTitle>
            <DialogDescription>
              {interpolate(m.discounts.list.deleteDescription, {
                title: pendingDelete?.title ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setPendingDelete(null)}
              type="button"
              variant="outline"
            >
              {m.common.cancel}
            </Button>
            <Button
              disabled={Boolean(
                pendingDelete && mutatingId === pendingDelete.id,
              )}
              onClick={confirmDelete}
              type="button"
              variant="destructive"
            >
              {m.discounts.list.confirmDelete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
