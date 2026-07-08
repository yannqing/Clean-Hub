"use client";

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
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
} from "@cleanhub/ui";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { Pagination } from "@/components/pagination";
import { useTenantI18n } from "@/i18n";

import {
  hardwareConnectionTypeOptions,
  hardwareDeviceStatusOptions,
  hardwareDeviceTypeOptions,
} from "../constants";
import { getDeviceListQuery } from "../queries";
import { bindDeviceAction, updateDeviceAction } from "../actions";
import type {
  CreateHardwareConfigRequest,
  HardwareConfigSummary,
  HardwareConnectionType,
  HardwareDeviceType,
  UpdateHardwareConfigRequest,
} from "../types";

const PAGE_SIZE = 20;

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function StatusBadge({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  const variant = status === "active" ? "default" : "secondary";
  return <Badge variant={variant}>{label}</Badge>;
}

export function HardwareListView() {
  const isCurrent = useRef(true);
  const { m, formatDateTime } = useTenantI18n();

  const [devices, setDevices] = useState<HardwareConfigSummary[]>([]);
  const [offset, setOffset] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateHardwareConfigRequest>({
    branchId: "",
    name: "",
    deviceType: "printer",
    connectionType: "usb",
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editDevice, setEditDevice] = useState<HardwareConfigSummary | null>(null);
  const [editForm, setEditForm] = useState<UpdateHardwareConfigRequest>({});
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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

        if (!isCurrent.current) return;
        setDevices(result);
      } catch (err) {
        if (!isCurrent.current) return;
        setError(getErrorMessage(err, m.hardware.requestFailed));
      }
    });
  }, [offset, m.hardware.requestFailed]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const handleCreate = useCallback(async () => {
    setCreateLoading(true);
    setCreateError(null);

    const result = await bindDeviceAction(createForm);

    if (!isCurrent.current) return;
    setCreateLoading(false);

    if (!result.ok) {
      setCreateError(result.error);
      return;
    }

    setCreateOpen(false);
    setCreateForm({ branchId: "", name: "", deviceType: "printer", connectionType: "usb" });
    loadDevices();
  }, [createForm, loadDevices]);

  const handleOpenEdit = useCallback((device: HardwareConfigSummary) => {
    setEditDevice(device);
    setEditForm({
      name: device.name,
      connectionType: device.connectionType,
      status: device.status,
    });
    setEditError(null);
  }, []);

  const handleUpdate = useCallback(async () => {
    if (!editDevice) return;

    setEditLoading(true);
    setEditError(null);

    const result = await updateDeviceAction(editDevice.id, editForm);

    if (!isCurrent.current) return;
    setEditLoading(false);

    if (!result.ok) {
      setEditError(result.error);
      return;
    }

    setEditDevice(null);
    loadDevices();
  }, [editDevice, editForm, loadDevices]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{m.hardware.title}</h1>
        <Button onClick={() => setCreateOpen(true)}>{m.hardware.addDevice}</Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {isPending ? (
        <p className="text-sm text-muted-foreground">{m.common.loading}</p>
      ) : devices.length === 0 ? (
        <p className="text-sm text-muted-foreground">{m.hardware.noDevices}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{m.hardware.columns.name}</TableHead>
              <TableHead>{m.hardware.columns.type}</TableHead>
              <TableHead>{m.hardware.columns.connection}</TableHead>
              <TableHead>{m.hardware.columns.branch}</TableHead>
              <TableHead>{m.hardware.columns.status}</TableHead>
              <TableHead>{m.hardware.columns.created}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.map((device) => (
              <TableRow key={device.id}>
                <TableCell className="font-medium">{device.name}</TableCell>
                <TableCell>{device.deviceType}</TableCell>
                <TableCell>{device.connectionType}</TableCell>
                <TableCell className="font-mono text-xs">{device.branchId}</TableCell>
                <TableCell>
                  <StatusBadge
                    status={device.status}
                    label={m.common.statusLabels[device.status] ?? device.status}
                  />
                </TableCell>
                <TableCell>{formatDateTime(device.createdAt)}</TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenEdit(device)}
                  >
                    {m.common.edit}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Pagination
        currentPageCount={devices.length}
        nextLabel={m.common.next}
        offset={offset}
        onOffsetChange={setOffset}
        pageSize={PAGE_SIZE}
        previousLabel={m.common.previous}
      />

      {/* Add device dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m.hardware.create.title}</DialogTitle>
            <DialogDescription>
              {m.hardware.create.description}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>{m.hardware.create.labels.branchId} *</Label>
              <Input
                placeholder={m.hardware.create.labels.branchPlaceholder}
                value={createForm.branchId}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, branchId: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{m.hardware.create.labels.deviceName} *</Label>
              <Input
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{m.hardware.create.labels.deviceType} *</Label>
              <Select
                value={createForm.deviceType}
                onValueChange={(value) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    deviceType: value as HardwareDeviceType,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {hardwareDeviceTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{m.hardware.create.labels.connectionType} *</Label>
              <Select
                value={createForm.connectionType}
                onValueChange={(value) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    connectionType: value as HardwareConnectionType,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {hardwareConnectionTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}

            <Button disabled={createLoading} onClick={() => void handleCreate()}>
              {createLoading ? m.hardware.create.adding : m.hardware.create.action}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit device dialog */}
      <Dialog
        open={editDevice !== null}
        onOpenChange={(open) => {
          if (!open) setEditDevice(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m.hardware.edit.title}</DialogTitle>
            <DialogDescription>
              {editDevice?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>{m.hardware.edit.labels.deviceName}</Label>
              <Input
                value={editForm.name ?? ""}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{m.hardware.edit.labels.connectionType}</Label>
              <Select
                value={editForm.connectionType ?? ""}
                onValueChange={(value) =>
                  setEditForm((prev) => ({
                    ...prev,
                    connectionType: value as HardwareConnectionType,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {hardwareConnectionTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{m.hardware.edit.labels.status}</Label>
              <Select
                value={editForm.status ?? ""}
                onValueChange={(value) =>
                  setEditForm((prev) => ({
                    ...prev,
                    status: value as "active" | "inactive",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {hardwareDeviceStatusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {editError && (
              <p className="text-sm text-destructive">{editError}</p>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEditDevice(null)}>
                {m.common.cancel}
              </Button>
              <Button disabled={editLoading} onClick={() => void handleUpdate()}>
                {editLoading
                  ? m.hardware.edit.savingChanges
                  : m.hardware.edit.saveChanges}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
