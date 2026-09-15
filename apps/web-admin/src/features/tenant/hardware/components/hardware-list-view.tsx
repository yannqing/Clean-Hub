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
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@cleanhub/ui";
import { DataTable } from "@cleanhub/ui/data-table";
import { RefreshCw, Search, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { Pagination } from "@/components/pagination";
import { webAdminRoutes } from "@/config/routes";
import { useTenantI18n } from "@/i18n";

import { deleteDeviceAction } from "../actions";
import {
  hardwareConnectionTypeOptions,
  hardwareDeviceTypeOptions,
} from "../constants";
import { getDeviceListQuery } from "../queries";
import type { HardwareConfigSummary } from "../types";

const PAGE_SIZE = 20;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <Badge variant={status === "active" ? "default" : "secondary"}>
      {label}
    </Badge>
  );
}

export type HardwareListViewProps = {
  embedded?: boolean;
};

export function HardwareListView({
  embedded = false,
}: HardwareListViewProps = {}) {
  const isCurrent = useRef(true);
  const router = useRouter();
  const { m, formatDateTime } = useTenantI18n();
  const [devices, setDevices] = useState<HardwareConfigSummary[]>([]);
  const [offset, setOffset] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingDelete, setPendingDelete] =
    useState<HardwareConfigSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    isCurrent.current = true;
    return () => {
      isCurrent.current = false;
    };
  }, []);

  const loadDevices = useCallback(() => {
    startTransition(async () => {
      setError(null);

      try {
        const result = await getDeviceListQuery({ limit: PAGE_SIZE, offset });

        if (isCurrent.current) {
          setDevices(result);
        }
      } catch (loadError) {
        if (isCurrent.current) {
          setError(getErrorMessage(loadError) || m.hardware.requestFailed);
        }
      }
    });
  }, [m.hardware.requestFailed, offset]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const visibleDevices = useMemo(() => {
    if (!normalizedSearchQuery) {
      return devices;
    }

    return devices.filter((device) => {
      const deviceType =
        hardwareDeviceTypeOptions.find(
          (option) => option.value === device.deviceType,
        )?.label ?? device.deviceType;
      const connectionType =
        hardwareConnectionTypeOptions.find(
          (option) => option.value === device.connectionType,
        )?.label ?? device.connectionType;
      const printerPurpose =
        device.deviceType === "printer"
          ? m.hardware.printerPurposeLabels[
              device.config.printerPurpose === "label" ? "label" : "receipt"
            ]
          : "";

      return [
        device.name,
        device.terminalLabel,
        device.terminalDeviceId,
        deviceType,
        connectionType,
        printerPurpose,
        device.provisioningMode === "built_in"
          ? m.hardware.provisioning.builtIn
          : "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearchQuery);
    });
  }, [
    devices,
    m.hardware.printerPurposeLabels,
    m.hardware.provisioning.builtIn,
    normalizedSearchQuery,
  ]);

  const handleDelete = useCallback(
    async (device: HardwareConfigSummary) => {
      setDeleting(true);
      const result = await deleteDeviceAction(device.id, device.version);

      if (!isCurrent.current) {
        return;
      }

      setDeleting(false);
      if (!result.ok) {
        setError(result.error || m.hardware.requestFailed);
        return;
      }

      setPendingDelete(null);
      loadDevices();
    },
    [loadDevices, m.hardware.requestFailed],
  );

  return (
    <section
      className={cn("space-y-7 pb-8", embedded && "space-y-4 pb-0")}
      data-testid="tenant-hardware-view"
    >
      <header className="flex items-center justify-between gap-3">
        {!embedded ? (
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Icon aria-hidden icon={Wrench} size={19} />
            <span>{m.hardware.title}</span>
          </h1>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button asChild className="h-8 gap-1.5 px-2.5 text-xs" size="sm">
            <Link href={webAdminRoutes.tenant.newHardware}>
              {m.hardware.addDevice}
            </Link>
          </Button>
          <Button
            aria-label={m.common.refresh}
            className="h-8 gap-1.5 px-2.5 text-xs"
            disabled={isPending}
            onClick={loadDevices}
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

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <section className="min-w-0 border-y bg-background">
        <div className="flex items-center gap-2 border-b px-3 py-2.5">
          <div className="relative w-full max-w-sm">
            <label className="sr-only" htmlFor="hardware-search">
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
              id="hardware-search"
              inputMode="search"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={m.common.search}
              type="text"
              value={searchQuery}
            />
          </div>
          <p className="ml-auto shrink-0 text-xs text-muted-foreground">
            {visibleDevices.length.toLocaleString()}
          </p>
        </div>

        {isPending ? (
          <div className="grid gap-2 p-3">
            {[0, 1, 2].map((item) => (
              <div
                className="h-10 animate-pulse rounded-md bg-muted"
                key={item}
              />
            ))}
          </div>
        ) : visibleDevices.length === 0 ? (
          <div className="p-3">
            <div className="rounded-md border border-dashed px-4 py-10 text-center">
              <h2 className="text-sm font-semibold">{m.hardware.noDevices}</h2>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <DataTable className="text-xs [&_td]:px-1.5 [&_td]:py-1.5 [&_th]:h-8 [&_th]:px-1.5">
              <TableHeader>
                <TableRow>
                  <TableHead>{m.hardware.columns.name}</TableHead>
                  <TableHead>{m.hardware.columns.type}</TableHead>
                  <TableHead>{m.hardware.columns.connection}</TableHead>
                  <TableHead>{m.hardware.columns.terminal}</TableHead>
                  <TableHead>{m.hardware.columns.status}</TableHead>
                  <TableHead>{m.hardware.columns.binding}</TableHead>
                  <TableHead>{m.hardware.columns.created}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleDevices.map((device) => (
                  <TableRow
                    className="cursor-pointer hover:bg-muted/40"
                    key={device.id}
                    onClick={() =>
                      router.push(
                        webAdminRoutes.tenant.hardwareDevice(device.id),
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(
                          webAdminRoutes.tenant.hardwareDevice(device.id),
                        );
                      }
                    }}
                    onMouseEnter={() =>
                      router.prefetch(
                        webAdminRoutes.tenant.hardwareDevice(device.id),
                      )
                    }
                    role="link"
                    tabIndex={0}
                  >
                    <TableCell className="font-medium">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span>{device.name}</span>
                        {device.provisioningMode === "built_in" ? (
                          <Badge variant="outline">
                            {m.hardware.provisioning.builtIn}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="grid gap-0.5">
                        <span>
                          {hardwareDeviceTypeOptions.find(
                            (option) => option.value === device.deviceType,
                          )?.label ?? device.deviceType}
                        </span>
                        {device.deviceType === "printer" ? (
                          <span className="text-[10px] text-muted-foreground">
                            {
                              m.hardware.printerPurposeLabels[
                                device.config.printerPurpose === "label"
                                  ? "label"
                                  : "receipt"
                              ]
                            }
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {device.provisioningMode === "built_in"
                        ? m.hardware.provisioning.builtIn
                        : (hardwareConnectionTypeOptions.find(
                            (option) => option.value === device.connectionType,
                          )?.label ?? device.connectionType)}
                    </TableCell>
                    <TableCell>
                      <div className="grid gap-0.5">
                        <span>
                          {device.terminalLabel || device.terminalDeviceId}
                        </span>
                        {device.terminalLabel ? (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {device.terminalDeviceId}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={device.status}
                        label={
                          m.common.statusLabels[device.status] ?? device.status
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {device.provisioningMode === "built_in" ? (
                        <Badge
                          title={m.hardware.provisioning.builtInReadonly}
                          variant="outline"
                        >
                          {m.hardware.binding.bound}
                        </Badge>
                      ) : device.deviceType === "printer" ? (
                        <Badge
                          title={m.hardware.binding.posChecksConnection}
                          variant={
                            typeof device.config.printerId === "string" &&
                            device.config.printerId.trim()
                              ? "outline"
                              : "secondary"
                          }
                        >
                          {typeof device.config.printerId === "string" &&
                          device.config.printerId.trim()
                            ? m.hardware.binding.bound
                            : m.hardware.binding.unbound}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{formatDateTime(device.createdAt)}</TableCell>
                    <TableCell className="space-x-1.5 text-right">
                      <Button
                        asChild
                        className="h-7 px-2 text-xs"
                        size="sm"
                        variant="outline"
                      >
                        <Link
                          href={webAdminRoutes.tenant.hardwareDevice(device.id)}
                        >
                          {device.provisioningMode === "built_in"
                            ? m.hardware.actions.view
                            : m.hardware.actions.edit}
                        </Link>
                      </Button>
                      {device.provisioningMode !== "built_in" ? (
                        <Button
                          className="h-7 px-2 text-xs"
                          onClick={(event) => {
                            event.stopPropagation();
                            setPendingDelete(device);
                          }}
                          onKeyDown={(event) => event.stopPropagation()}
                          size="sm"
                          variant="destructive"
                        >
                          {m.hardware.actions.delete}
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          </div>
        )}

        <div className="border-t px-3 py-2">
          <Pagination
            currentPageCount={devices.length}
            nextLabel={m.common.next}
            offset={offset}
            onOffsetChange={setOffset}
            pageSize={PAGE_SIZE}
            previousLabel={m.common.previous}
          />
        </div>
      </section>

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m.hardware.delete.title}</DialogTitle>
            <DialogDescription>
              {m.hardware.delete.description}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button
              disabled={deleting}
              onClick={() => setPendingDelete(null)}
              variant="outline"
            >
              {m.common.cancel}
            </Button>
            <Button
              disabled={deleting}
              onClick={() => pendingDelete && void handleDelete(pendingDelete)}
              variant="destructive"
            >
              {deleting ? m.hardware.delete.deleting : m.hardware.delete.action}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
