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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === "active" ? "default" : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}

export function HardwareListView() {
  const isCurrent = useRef(true);

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
        setError(getErrorMessage(err));
      }
    });
  }, [offset]);

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
        <h1 className="text-2xl font-semibold">Hardware Devices</h1>
        <Button onClick={() => setCreateOpen(true)}>Add Device</Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {isPending ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : devices.length === 0 ? (
        <p className="text-sm text-muted-foreground">No devices found.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Connection</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
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
                  <StatusBadge status={device.status} />
                </TableCell>
                <TableCell>{formatDate(device.createdAt)}</TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenEdit(device)}
                  >
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="flex gap-3">
        <Button
          variant="outline"
          disabled={offset === 0}
          onClick={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          disabled={devices.length < PAGE_SIZE}
          onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
        >
          Next
        </Button>
      </div>

      {/* Add device dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Device</DialogTitle>
            <DialogDescription>
              Register a hardware device to a branch.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Branch ID *</Label>
              <Input
                placeholder="Enter branch ULID"
                value={createForm.branchId}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, branchId: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Device Name *</Label>
              <Input
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Device Type *</Label>
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
              <Label>Connection Type *</Label>
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
              {createLoading ? "Adding..." : "Add Device"}
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
            <DialogTitle>Edit Device</DialogTitle>
            <DialogDescription>
              {editDevice?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Device Name</Label>
              <Input
                value={editForm.name ?? ""}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Connection Type</Label>
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
              <Label>Status</Label>
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
                Cancel
              </Button>
              <Button disabled={editLoading} onClick={() => void handleUpdate()}>
                {editLoading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
