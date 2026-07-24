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
import { getBranchListQuery } from "../../branches/queries";
import { getDeviceListQuery } from "../queries";
import {
  bindDeviceAction,
  deleteDeviceAction,
  updateDeviceAction,
} from "../actions";
import type {
  BranchSummary,
  CreateHardwareConfigRequest,
  HardwareConfigSummary,
  HardwareConnectionType,
  HardwareDeviceType,
  UpdateHardwareConfigRequest,
} from "../types";

const PAGE_SIZE = 20;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const variant = status === "active" ? "default" : "secondary";
  return <Badge variant={variant}>{label}</Badge>;
}

/**
 * Single-select branch picker. Mirrors the multi-select used by the tenant
 * users module so the two surfaces stay consistent.
 */
function BranchSelect({
  branches,
  disabled = false,
  emptyLabel,
  onChange,
  selected,
}: {
  branches: BranchSummary[];
  disabled?: boolean;
  emptyLabel: string;
  selected: string;
  onChange: (branchId: string) => void;
}) {
  if (branches.length === 0) {
    return <p className="text-sm text-muted-foreground px-1">{emptyLabel}</p>;
  }

  return (
    <Select
      disabled={disabled}
      onValueChange={(value) => onChange(value === "__none__" ? "" : value)}
      value={selected || "__none__"}
    >
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">{emptyLabel}</SelectItem>
        {branches.map((branch) => (
          <SelectItem key={branch.id} value={branch.id}>
            {branch.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function HardwareListView() {
  const isCurrent = useRef(true);
  const { m, formatDateTime } = useTenantI18n();

  const [devices, setDevices] = useState<HardwareConfigSummary[]>([]);
  const [branches, setBranches] = useState<BranchSummary[]>([]);
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

  const [editDevice, setEditDevice] = useState<HardwareConfigSummary | null>(
    null,
  );
  const [editForm, setEditForm] = useState<UpdateHardwareConfigRequest>({
    version: 0,
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] =
    useState<HardwareConfigSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    isCurrent.current = true;
    return () => {
      isCurrent.current = false;
    };
  }, []);

  useEffect(() => {
    getBranchListQuery()
      .then((result) => {
        if (isCurrent.current) setBranches(result);
      })
      .catch(() => {
        /* non-critical; branch pickers fall back to the empty state */
      });
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
        setError(getErrorMessage(err) || m.hardware.requestFailed);
      }
    });
  }, [offset, m.hardware.requestFailed]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const getBranchName = useCallback(
    (branchId: string) =>
      branches.find((b) => b.id === branchId)?.name ?? branchId,
    [branches],
  );

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
    setCreateForm({
      branchId: "",
      name: "",
      deviceType: "printer",
      connectionType: "usb",
    });
    loadDevices();
  }, [createForm, loadDevices]);

  const handleOpenEdit = useCallback((device: HardwareConfigSummary) => {
    setEditDevice(device);
    setEditForm({
      name: device.name,
      branchId: device.branchId,
      connectionType: device.connectionType,
      status: device.status,
      version: device.version,
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

  const handleDelete = useCallback(
    async (device: HardwareConfigSummary) => {
      setDeleting(true);

      const result = await deleteDeviceAction(device.id, device.version);

      if (!isCurrent.current) return;
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
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{m.hardware.title}</h1>
        <Button onClick={() => setCreateOpen(true)}>
          {m.hardware.addDevice}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

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
                <TableCell>
                  {hardwareDeviceTypeOptions.find(
                    (opt) => opt.value === device.deviceType,
                  )?.label ?? device.deviceType}
                </TableCell>
                <TableCell>
                  {hardwareConnectionTypeOptions.find(
                    (opt) => opt.value === device.connectionType,
                  )?.label ?? device.connectionType}
                </TableCell>
                <TableCell>{getBranchName(device.branchId)}</TableCell>
                <TableCell>
                  <StatusBadge
                    status={device.status}
                    label={
                      m.common.statusLabels[device.status] ?? device.status
                    }
                  />
                </TableCell>
                <TableCell>{formatDateTime(device.createdAt)}</TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenEdit(device)}
                  >
                    {m.hardware.actions.edit}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setPendingDelete(device)}
                  >
                    {m.hardware.actions.delete}
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
              <BranchSelect
                branches={branches}
                emptyLabel={m.hardware.noBranches}
                onChange={(branchId) =>
                  setCreateForm((prev) => ({ ...prev, branchId }))
                }
                selected={createForm.branchId}
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

            <Button
              disabled={createLoading}
              onClick={() => void handleCreate()}
            >
              {createLoading
                ? m.hardware.create.adding
                : m.hardware.create.action}
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
            <DialogDescription>{editDevice?.name}</DialogDescription>
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
              <Label>{m.hardware.columns.type}</Label>
              <p className="text-sm text-muted-foreground">
                {editDevice
                  ? (hardwareDeviceTypeOptions.find(
                      (opt) => opt.value === editDevice.deviceType,
                    )?.label ?? editDevice.deviceType)
                  : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                {m.hardware.typeReadonlyHint}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{m.hardware.edit.labels.branchId}</Label>
              <BranchSelect
                branches={branches}
                emptyLabel={m.hardware.noBranches}
                onChange={(branchId) =>
                  setEditForm((prev) => ({ ...prev, branchId }))
                }
                selected={editForm.branchId ?? ""}
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
              <Button
                disabled={editLoading}
                onClick={() => void handleUpdate()}
              >
                {editLoading
                  ? m.hardware.edit.savingChanges
                  : m.hardware.edit.saveChanges}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
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
    </div>
  );
}
