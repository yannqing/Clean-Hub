"use client";

import {
  Badge,
  Button,
  Icon,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@cleanhub/ui";
import {
  Banknote,
  Building2,
  CalendarDays,
  CircleDollarSign,
  Download,
  PauseCircle,
  PlayCircle,
  Search,
  SquareTerminal,
  TimerOff,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";

import { Pagination } from "@/components/pagination";
import { interpolate, useTenantI18n } from "@/i18n";
import { formatMoney } from "@/lib/format";

import {
  pointOfSaleDatePresets,
  resolvePointOfSaleDatePreset,
  type PointOfSaleDatePresetId,
} from "../date-presets";
import type {
  PointOfSaleRegisterSessionList,
  PointOfSaleRegisterSessionQuery,
  PointOfSaleShiftStatus,
} from "../types";

type RegisterSessionsViewProps = {
  error?: string;
  query: PointOfSaleRegisterSessionQuery;
  result?: PointOfSaleRegisterSessionList;
  selectedPreset: PointOfSaleDatePresetId;
};

const ALL_VALUE = "__all__";
const PAGE_SIZE = 10;

function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTenantTime(
  value: string,
  locale: string,
  timeZone: string,
): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone,
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function escapeCsvCell(value: string | number | null): string {
  const raw = value === null ? "" : String(value);
  const safe =
    typeof value === "string" && /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function RegisterSessionsView({
  error,
  query,
  result,
  selectedPreset,
}: RegisterSessionsViewProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, m } = useTenantI18n();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(query.q ?? "");

  function navigate(
    changes: Partial<PointOfSaleRegisterSessionQuery>,
    remove: Array<keyof PointOfSaleRegisterSessionQuery> = [],
  ) {
    const next: PointOfSaleRegisterSessionQuery = { ...query, ...changes };
    for (const key of remove) delete next[key];
    const params = new URLSearchParams();

    if (next.from) params.set("from", next.from);
    if (next.to) params.set("to", next.to);
    if (next.branchId) params.set("branchId", next.branchId);
    if (next.status) params.set("status", next.status);
    if (next.q) params.set("q", next.q);
    if (next.offset) params.set("offset", String(next.offset));

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
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

  function aggregateMoney(
    value: number | null,
    key: "netSales" | "discrepancies",
  ): string {
    if (value !== null && result?.currency) {
      return formatMoney(value, result.currency, locale);
    }

    if (result && result.metrics.byCurrency.length > 0) {
      return result.metrics.byCurrency
        .map((item) => formatMoney(item[key], item.currency, locale))
        .join(" · ");
    }

    return m.pointOfSale.registerSessions.unavailable;
  }

  function exportCurrentPage() {
    if (!result || result.data.length === 0) return;

    const headers = m.pointOfSale.registerSessions.exportHeaders;
    const rows = result.data.map((session) => [
      session.id,
      session.branchName,
      session.terminalName ?? session.terminalDeviceId,
      session.staffName,
      m.pointOfSale.registerSessions.statuses[
        session.status === "on_break" ? "onBreak" : session.status
      ],
      session.startedAt,
      session.endedAt,
      session.openingFloat,
      session.closingFloat,
      session.netSales,
      session.cashVariance,
      session.currency,
    ]);
    const csv = [
      [
        headers.id,
        headers.branch,
        headers.terminal,
        headers.staff,
        headers.status,
        headers.startedAt,
        headers.endedAt,
        headers.openingFloat,
        headers.closingFloat,
        headers.netSales,
        headers.cashVariance,
        headers.currency,
      ],
      ...rows,
    ]
      .map((row) => row.map(escapeCsvCell).join(","))
      .join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cleanhub-register-sessions-${result.filters.from}-${result.filters.to}-page-${Math.floor(result.offset / result.limit) + 1}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const metrics = [
    {
      icon: SquareTerminal,
      label: m.pointOfSale.registerSessions.metrics.total,
      value: result
        ? formatCount(result.metrics.total, locale)
        : m.pointOfSale.registerSessions.unavailable,
    },
    {
      icon: PlayCircle,
      label: m.pointOfSale.registerSessions.metrics.open,
      value: result
        ? formatCount(result.metrics.open, locale)
        : m.pointOfSale.registerSessions.unavailable,
    },
    {
      icon: PauseCircle,
      label: m.pointOfSale.registerSessions.metrics.onBreak,
      value: result
        ? formatCount(result.metrics.onBreak, locale)
        : m.pointOfSale.registerSessions.unavailable,
    },
    {
      icon: TimerOff,
      label: m.pointOfSale.registerSessions.metrics.closed,
      value: result
        ? formatCount(result.metrics.closed, locale)
        : m.pointOfSale.registerSessions.unavailable,
    },
    {
      icon: CircleDollarSign,
      label: m.pointOfSale.registerSessions.metrics.netSales,
      value: aggregateMoney(result?.metrics.netSales ?? null, "netSales"),
    },
    {
      icon: Banknote,
      label: m.pointOfSale.registerSessions.metrics.cashVariance,
      value: aggregateMoney(
        result?.metrics.discrepancies ?? null,
        "discrepancies",
      ),
    },
  ];

  return (
    <div
      className={cn("space-y-5 transition-opacity", isPending && "opacity-60")}
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-base font-semibold">
            {m.pointOfSale.registerSessions.title}
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {m.pointOfSale.registerSessions.description}
          </p>
        </div>
        <Button
          disabled={!result || result.data.length === 0}
          onClick={exportCurrentPage}
          size="sm"
          type="button"
          variant="outline"
        >
          <Icon icon={Download} size={14} />
          {m.pointOfSale.registerSessions.exportCsv}
        </Button>
      </div>

      <section className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {metrics.map((metric) => (
          <div
            className="min-w-0 rounded-lg border bg-background px-3 py-3"
            key={metric.label}
          >
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Icon icon={metric.icon} size={13} />
              {metric.label}
            </span>
            <strong className="mt-2 block truncate text-base">
              {metric.value}
            </strong>
          </div>
        ))}
      </section>

      {error ? (
        <div
          className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3"
          role="alert"
        >
          <p className="text-sm font-medium">
            {m.pointOfSale.registerSessions.errorTitle}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {m.pointOfSale.registerSessions.errorDescription}
          </p>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border bg-background">
        <div className="flex flex-col gap-2 border-b p-3 xl:flex-row xl:items-center">
          <form className="flex min-w-0 flex-1 gap-2" onSubmit={submitSearch}>
            <div className="relative w-full max-w-sm">
              <Icon
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                icon={Search}
                size={14}
              />
              <Input
                aria-label={m.pointOfSale.filters.search}
                className="h-8 pl-8 text-xs"
                onChange={(event) => setSearch(event.target.value)}
                placeholder={m.pointOfSale.registerSessions.searchPlaceholder}
                value={search}
              />
            </div>
            <Button className="h-8" size="sm" type="submit" variant="outline">
              {m.pointOfSale.filters.search}
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            <Select
              disabled={isPending}
              onValueChange={(value) =>
                navigate(
                  {
                    ...resolvePointOfSaleDatePreset(
                      value as PointOfSaleDatePresetId,
                      new Date(),
                      result?.timezone ?? "UTC",
                    ),
                    offset: 0,
                  },
                  ["offset"],
                )
              }
              value={selectedPreset}
            >
              <SelectTrigger
                aria-label={m.pointOfSale.filters.dateRange}
                className="h-8 min-w-[140px] text-xs"
                size="sm"
              >
                <Icon icon={CalendarDays} size={13} />
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {pointOfSaleDatePresets.map((preset) => (
                  <SelectItem key={preset} value={preset}>
                    {m.pointOfSale.presets[preset]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              disabled={isPending || !result}
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
              <SelectTrigger
                aria-label={m.pointOfSale.filters.branch}
                className="h-8 min-w-[140px] text-xs"
                size="sm"
              >
                <Icon icon={Building2} size={13} />
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value={ALL_VALUE}>
                  {m.pointOfSale.filters.allBranches}
                </SelectItem>
                {result?.availableBranches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              disabled={isPending}
              onValueChange={(value) =>
                navigate(
                  {
                    status:
                      value === ALL_VALUE
                        ? undefined
                        : (value as PointOfSaleShiftStatus),
                    offset: 0,
                  },
                  value === ALL_VALUE ? ["status", "offset"] : ["offset"],
                )
              }
              value={query.status ?? ALL_VALUE}
            >
              <SelectTrigger
                aria-label={m.pointOfSale.filters.status}
                className="h-8 min-w-[120px] text-xs"
                size="sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value={ALL_VALUE}>
                  {m.pointOfSale.filters.allStatuses}
                </SelectItem>
                {(["open", "on_break", "closed"] as const).map((status) => (
                  <SelectItem key={status} value={status}>
                    {
                      m.pointOfSale.registerSessions.statuses[
                        status === "on_break" ? "onBreak" : status
                      ]
                    }
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {result && result.data.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    {[
                      m.pointOfSale.registerSessions.columns.session,
                      m.pointOfSale.registerSessions.columns.branch,
                      m.pointOfSale.registerSessions.columns.terminal,
                      m.pointOfSale.registerSessions.columns.staff,
                      m.pointOfSale.registerSessions.columns.status,
                      m.pointOfSale.registerSessions.columns.startedAt,
                      m.pointOfSale.registerSessions.columns.endedAt,
                      m.pointOfSale.registerSessions.columns.openingFloat,
                      m.pointOfSale.registerSessions.columns.closingFloat,
                      m.pointOfSale.registerSessions.columns.netSales,
                      m.pointOfSale.registerSessions.columns.cashVariance,
                    ].map((label) => (
                      <TableHead className="text-[10px]" key={label}>
                        {label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.data.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="py-3 text-xs">
                        <span className="block max-w-32 truncate font-medium">
                          {session.id}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-36 truncate py-3 text-xs">
                        {session.branchName}
                      </TableCell>
                      <TableCell className="py-3 text-xs">
                        <span className="block max-w-36 truncate">
                          {session.terminalName ?? session.terminalDeviceId}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-xs">
                        <span className="block max-w-36 truncate">
                          {session.staffName}
                        </span>
                        {session.staffRole ? (
                          <span className="text-[10px] text-muted-foreground">
                            {
                              m.pointOfSale.registerSessions.roleLabels[
                                session.staffRole
                              ]
                            }
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge
                          variant={
                            session.status === "closed"
                              ? "outline"
                              : "secondary"
                          }
                        >
                          {
                            m.pointOfSale.registerSessions.statuses[
                              session.status === "on_break"
                                ? "onBreak"
                                : session.status
                            ]
                          }
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-3 text-[11px] text-muted-foreground">
                        {formatTenantTime(
                          session.startedAt,
                          locale,
                          result.timezone,
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-3 text-[11px] text-muted-foreground">
                        {session.endedAt
                          ? formatTenantTime(
                              session.endedAt,
                              locale,
                              result.timezone,
                            )
                          : m.pointOfSale.registerSessions.notClosed}
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-3 text-right text-xs">
                        {formatMoney(
                          session.openingFloat,
                          session.currency,
                          locale,
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-3 text-right text-xs">
                        {session.closingFloat === null
                          ? m.pointOfSale.registerSessions.unavailable
                          : formatMoney(
                              session.closingFloat,
                              session.currency,
                              locale,
                            )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-3 text-right text-xs font-medium">
                        {session.netSales === null
                          ? m.pointOfSale.registerSessions.unavailable
                          : formatMoney(
                              session.netSales,
                              session.currency,
                              locale,
                            )}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "whitespace-nowrap py-3 text-right text-xs",
                          session.cashVariance !== null &&
                            session.cashVariance !== 0 &&
                            "text-red-600",
                        )}
                      >
                        {session.cashVariance === null
                          ? m.pointOfSale.registerSessions.unavailable
                          : formatMoney(
                              session.cashVariance,
                              session.currency,
                              locale,
                            )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination
              currentPageCount={result.data.length}
              formatCountLabel={({ from, to, total }) =>
                interpolate(m.pointOfSale.registerSessions.count, {
                  from: String(from),
                  to: String(to),
                  total: String(total),
                })
              }
              nextLabel={m.pointOfSale.registerSessions.next}
              offset={query.offset ?? 0}
              onOffsetChange={(offset) => navigate({ offset })}
              pageSize={PAGE_SIZE}
              previousLabel={m.pointOfSale.registerSessions.previous}
              total={result.total}
            />
          </>
        ) : (
          <p className="px-5 py-12 text-center text-xs text-muted-foreground">
            {m.pointOfSale.registerSessions.empty}
          </p>
        )}
      </section>
    </div>
  );
}
