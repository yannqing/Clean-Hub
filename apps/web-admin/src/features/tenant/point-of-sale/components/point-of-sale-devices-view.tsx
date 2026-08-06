"use client";

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Icon,
  Input,
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
} from "@cleanhub/ui";
import { DataTable } from "@cleanhub/ui/data-table";
import {
  Activity,
  Building2,
  CircleAlert,
  HardDrive,
  MonitorCheck,
  Search,
  ShieldCheck,
  SquareTerminal,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";

import { Pagination } from "@/components/pagination";
import { interpolate, useTenantI18n } from "@/i18n";

import type {
  PointOfSaleDeviceList,
  PointOfSaleDeviceQuery,
  PointOfSaleDeviceConnectivity,
  PointOfSaleDeviceStatus,
} from "../types";

type PointOfSaleDevicesViewProps = {
  error?: string;
  query: PointOfSaleDeviceQuery;
  result?: PointOfSaleDeviceList;
};

const ALL_VALUE = "__all__";
const PAGE_SIZE = 10;

function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(value);
}

export function PointOfSaleDevicesView({
  error,
  query,
  result,
}: PointOfSaleDevicesViewProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { formatDateTime, locale, m } = useTenantI18n();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(query.q ?? "");
  const [setupOpen, setSetupOpen] = useState(false);

  function navigate(
    changes: Partial<PointOfSaleDeviceQuery>,
    remove: Array<keyof PointOfSaleDeviceQuery> = [],
  ) {
    const next: PointOfSaleDeviceQuery = { ...query, ...changes };
    for (const key of remove) delete next[key];
    const params = new URLSearchParams();

    if (next.q) params.set("q", next.q);
    if (next.branchId) params.set("branchId", next.branchId);
    if (next.status) params.set("status", next.status);
    if (next.connectivity) params.set("connectivity", next.connectivity);
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

  const metrics = [
    {
      icon: HardDrive,
      label: m.pointOfSale.devices.metrics.total,
      value: result?.metrics.total ?? null,
    },
    {
      icon: ShieldCheck,
      label: m.pointOfSale.devices.metrics.active,
      value: result?.metrics.active ?? null,
    },
    {
      icon: MonitorCheck,
      label: m.pointOfSale.devices.metrics.online,
      value: result?.metrics.online ?? null,
    },
    {
      icon: CircleAlert,
      label: m.pointOfSale.devices.metrics.syncIssues,
      value: result?.metrics.syncIssues ?? null,
    },
  ];

  return (
    <div
      className={cn("space-y-5 transition-opacity", isPending && "opacity-60")}
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-base font-semibold">
            {m.pointOfSale.devices.title}
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {m.pointOfSale.devices.description}
          </p>
        </div>
        <Button
          onClick={() => setSetupOpen(true)}
          size="sm"
          type="button"
          variant="outline"
        >
          <Icon icon={SquareTerminal} size={14} />
          {m.pointOfSale.devices.setupGuide}
        </Button>
      </div>

      <Dialog onOpenChange={setSetupOpen} open={setupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m.pointOfSale.devices.setupGuide}</DialogTitle>
            <DialogDescription>
              {m.pointOfSale.devices.setupNotice}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <section className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div
            className="flex min-h-16 items-center gap-2.5 rounded-lg border bg-background px-3 py-2.5"
            key={metric.label}
          >
            <span className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Icon icon={metric.icon} size={14} />
            </span>
            <span>
              <span className="block text-[10px] text-muted-foreground">
                {metric.label}
              </span>
              <strong className="mt-0.5 block text-base">
                {metric.value === null
                  ? "—"
                  : formatCount(metric.value, locale)}
              </strong>
            </span>
          </div>
        ))}
      </section>

      {error ? (
        <div
          className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3"
          role="alert"
        >
          <p className="text-sm font-medium">
            {m.pointOfSale.devices.errorTitle}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {m.pointOfSale.devices.errorDescription}
          </p>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border bg-background">
        <div className="flex flex-col gap-2 border-b p-3 lg:flex-row lg:items-center">
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
                placeholder={m.pointOfSale.devices.searchPlaceholder}
                value={search}
              />
            </div>
            <Button className="h-8" size="sm" type="submit" variant="outline">
              {m.pointOfSale.filters.search}
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
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
                <Icon icon={Building2} size={14} />
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
                        : (value as PointOfSaleDeviceStatus),
                    offset: 0,
                  },
                  value === ALL_VALUE ? ["status", "offset"] : ["offset"],
                )
              }
              value={query.status ?? ALL_VALUE}
            >
              <SelectTrigger
                aria-label={m.pointOfSale.devices.columns.enabledStatus}
                className="h-8 min-w-[120px] text-xs"
                size="sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value={ALL_VALUE}>
                  {m.pointOfSale.filters.allStatuses}
                </SelectItem>
                {(["active", "inactive"] as const).map((status) => (
                  <SelectItem key={status} value={status}>
                    {m.pointOfSale.devices.enabledStatuses[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              disabled={isPending}
              onValueChange={(value) =>
                navigate(
                  {
                    connectivity:
                      value === ALL_VALUE
                        ? undefined
                        : (value as PointOfSaleDeviceConnectivity),
                    offset: 0,
                  },
                  value === ALL_VALUE ? ["connectivity", "offset"] : ["offset"],
                )
              }
              value={query.connectivity ?? ALL_VALUE}
            >
              <SelectTrigger
                aria-label={m.pointOfSale.devices.columns.heartbeatStatus}
                className="h-8 min-w-[120px] text-xs"
                size="sm"
              >
                <Icon icon={Activity} size={13} />
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value={ALL_VALUE}>
                  {m.pointOfSale.filters.allStatuses}
                </SelectItem>
                {(["online", "offline", "never"] as const).map((status) => (
                  <SelectItem key={status} value={status}>
                    {m.pointOfSale.devices.heartbeatStatuses[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {result && result.data.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <DataTable>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-[10px]">
                      {m.pointOfSale.devices.columns.device}
                    </TableHead>
                    <TableHead className="text-[10px]">
                      {m.pointOfSale.devices.columns.typePlatform}
                    </TableHead>
                    <TableHead className="text-[10px]">
                      {m.pointOfSale.devices.columns.version}
                    </TableHead>
                    <TableHead className="text-[10px]">
                      {m.pointOfSale.devices.columns.branch}
                    </TableHead>
                    <TableHead className="text-[10px]">
                      {m.pointOfSale.devices.columns.enabledStatus}
                    </TableHead>
                    <TableHead className="text-[10px]">
                      {m.pointOfSale.devices.columns.heartbeatStatus}
                    </TableHead>
                    <TableHead className="text-[10px]">
                      {m.pointOfSale.devices.columns.lastSeen}
                    </TableHead>
                    <TableHead className="text-[10px]">
                      {m.pointOfSale.devices.columns.syncStatus}
                    </TableHead>
                    <TableHead className="text-[10px]">
                      {m.pointOfSale.devices.columns.currentSession}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.data.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell className="py-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
                            <Icon icon={SquareTerminal} size={13} />
                          </span>
                          <span className="min-w-0">
                            <span className="block max-w-44 truncate font-medium">
                              {device.label || device.deviceId}
                            </span>
                            <span className="block max-w-44 truncate text-[10px] text-muted-foreground">
                              {device.deviceId}
                            </span>
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-3 text-xs">
                        <span className="block">
                          {m.pointOfSale.devices.deviceTypes[device.deviceType]}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {device.platform ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-3 text-xs text-muted-foreground">
                        {device.appVersion ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-40 truncate py-3 text-xs">
                        {device.branchName}
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge
                          variant={
                            device.status === "active" ? "default" : "outline"
                          }
                        >
                          {m.pointOfSale.devices.enabledStatuses[device.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="inline-flex items-center gap-1.5 text-[11px]">
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              device.connectivity === "online" &&
                                "bg-emerald-500",
                              device.connectivity === "offline" &&
                                "bg-muted-foreground/50",
                              device.connectivity === "never" && "bg-amber-500",
                            )}
                          />
                          {
                            m.pointOfSale.devices.heartbeatStatuses[
                              device.connectivity
                            ]
                          }
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-3 text-[11px] text-muted-foreground">
                        {device.lastSeenAt
                          ? formatDateTime(device.lastSeenAt)
                          : m.pointOfSale.devices.neverSeen}
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge
                          variant={
                            device.syncStatus === "error"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {
                            m.pointOfSale.devices.syncStatuses[
                              device.syncStatus
                            ]
                          }
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-3 text-[11px]">
                        {device.currentSession ? (
                          <>
                            <span className="block font-medium">
                              {device.currentSession.staffName}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDateTime(device.currentSession.startedAt)}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">
                            {m.pointOfSale.devices.noCurrentSession}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </DataTable>
            </div>
            <Pagination
              currentPageCount={result.data.length}
              formatCountLabel={({ from, to, total }) =>
                interpolate(m.pointOfSale.devices.count, {
                  from: String(from),
                  to: String(to),
                  total: String(total),
                })
              }
              nextLabel={m.pointOfSale.devices.next}
              offset={query.offset ?? 0}
              onOffsetChange={(offset) => navigate({ offset })}
              pageSize={PAGE_SIZE}
              previousLabel={m.pointOfSale.devices.previous}
              total={result.total}
            />
          </>
        ) : (
          <p className="px-5 py-12 text-center text-xs text-muted-foreground">
            {m.pointOfSale.devices.empty}
          </p>
        )}
      </section>
    </div>
  );
}
