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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { tenantUserRoleOptions, tenantUserStatusOptions } from "../constants";
import {
  getTenantUserDetailQuery,
  getTenantUserListQuery,
  type TenantUserListQuery,
} from "../queries";
import {
  createTenantUserAction,
  disableTenantUserAction,
  resetTenantUserPinAction,
} from "../actions";
import type {
  CreateTenantUserRequest,
  TenantUserDetail,
  TenantUserSummary,
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
  const variant =
    status === "active"
      ? "default"
      : status === "disabled"
        ? "destructive"
        : "secondary";

  return <Badge variant={variant}>{status}</Badge>;
}

export function TenantUserListView() {
  const isCurrent = useRef(true);

  const [users, setUsers] = useState<TenantUserSummary[]>([]);
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<TenantUserSummary | null>(null);
  const [detail, setDetail] = useState<TenantUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateTenantUserRequest>({
    displayName: "",
    email: "",
    initialPin: "",
    roleCode: "manager",
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [disableUserId, setDisableUserId] = useState<string | null>(null);
  const [disableLoading, setDisableLoading] = useState(false);

  const [resetPinUserId, setResetPinUserId] = useState<string | null>(null);
  const [resetPinLoading, setResetPinLoading] = useState(false);
  const [temporaryPin, setTemporaryPin] = useState<string | null>(null);

  const listQuery = useMemo<TenantUserListQuery>(
    () => ({
      limit: PAGE_SIZE,
      offset,
      q: search.trim() || undefined,
      status: statusFilter || undefined,
    }),
    [offset, search, statusFilter],
  );

  useEffect(() => {
    isCurrent.current = true;
    return () => {
      isCurrent.current = false;
    };
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getTenantUserListQuery(listQuery);

      if (!isCurrent.current) return;
      setUsers(result);
    } catch (err) {
      if (!isCurrent.current) return;
      setError(getErrorMessage(err));
    } finally {
      if (isCurrent.current) setLoading(false);
    }
  }, [listQuery]);

  useEffect(() => {
    let isCurrentRequest = true;

    getTenantUserListQuery(listQuery)
      .then((result) => {
        if (!isCurrent.current || !isCurrentRequest) return;
        setUsers(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!isCurrent.current || !isCurrentRequest) return;
        setError(getErrorMessage(err));
      })
      .finally(() => {
        if (isCurrent.current && isCurrentRequest) {
          setLoading(false);
        }
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [listQuery]);

  const handleSelectUser = useCallback(async (user: TenantUserSummary) => {
    setSelectedUser(user);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);

    try {
      const result = await getTenantUserDetailQuery(user.id);
      if (!isCurrent.current) return;
      setDetail(result);
    } catch (err) {
      if (!isCurrent.current) return;
      setDetailError(getErrorMessage(err));
    } finally {
      if (isCurrent.current) setDetailLoading(false);
    }
  }, []);

  const handleCreate = useCallback(async () => {
    setCreateLoading(true);
    setCreateError(null);

    const result = await createTenantUserAction({
      ...createForm,
      email: createForm.email?.trim() || undefined,
    });

    if (!isCurrent.current) return;
    setCreateLoading(false);

    if (!result.ok) {
      setCreateError(result.error);
      return;
    }

    setCreateOpen(false);
    setCreateForm({ displayName: "", email: "", initialPin: "", roleCode: "manager" });
    loadUsers();
  }, [createForm, loadUsers]);

  const handleDisable = useCallback(async (userId: string) => {
    setDisableLoading(true);

    const result = await disableTenantUserAction(userId);

    if (!isCurrent.current) return;
    setDisableLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setDisableUserId(null);
    if (selectedUser?.id === userId) {
      setSelectedUser(null);
      setDetail(null);
    }
    loadUsers();
  }, [loadUsers, selectedUser]);

  const handleResetPin = useCallback(async (userId: string) => {
    setResetPinLoading(true);

    const result = await resetTenantUserPinAction(userId);

    if (!isCurrent.current) return;
    setResetPinLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setTemporaryPin(result.data.temporaryPin);
    setResetPinUserId(null);
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Team Members</h1>
        <Button onClick={() => setCreateOpen(true)}>Add Member</Button>
      </div>

      <div className="flex gap-3">
        <Input
          className="max-w-xs"
          placeholder="Search by name, email..."
          value={search}
          onChange={(e) => {
            setLoading(true);
            setError(null);
            setSearch(e.target.value);
            setOffset(0);
          }}
        />
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            const nextStatus = value === "all" ? "" : value;

            if (nextStatus !== statusFilter) {
              setLoading(true);
              setError(null);
            }

            setStatusFilter(nextStatus);
            setOffset(0);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {tenantUserStatusOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-muted-foreground">No team members found.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow
                key={user.id}
                className="cursor-pointer"
                onClick={() => void handleSelectUser(user)}
              >
                <TableCell className="font-medium">{user.displayName}</TableCell>
                <TableCell>{user.email ?? "—"}</TableCell>
                <TableCell>{user.role}</TableCell>
                <TableCell>
                  <StatusBadge status={user.status} />
                </TableCell>
                <TableCell>{formatDate(user.createdAt)}</TableCell>
                <TableCell>
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setResetPinUserId(user.id)}
                    >
                      Reset PIN
                    </Button>
                    {user.status !== "disabled" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDisableUserId(user.id)}
                      >
                        Disable
                      </Button>
                    )}
                  </div>
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
          onClick={() => {
            setLoading(true);
            setError(null);
            setOffset((prev) => Math.max(0, prev - PAGE_SIZE));
          }}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          disabled={users.length < PAGE_SIZE}
          onClick={() => {
            setLoading(true);
            setError(null);
            setOffset((prev) => prev + PAGE_SIZE);
          }}
        >
          Next
        </Button>
      </div>

      {/* Detail side panel */}
      <Dialog
        open={selectedUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedUser(null);
            setDetail(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Member Detail</DialogTitle>
            <DialogDescription>
              {selectedUser?.displayName}
            </DialogDescription>
          </DialogHeader>

          {detailLoading && (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}
          {detailError && (
            <p className="text-sm text-destructive">{detailError}</p>
          )}
          {detail && (
            <div className="flex flex-col gap-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">Email</span>
                <span>{detail.email ?? "—"}</span>
                <span className="text-muted-foreground">Phone</span>
                <span>{detail.phone ?? "—"}</span>
                <span className="text-muted-foreground">Role</span>
                <span>{detail.role}</span>
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={detail.status} />
                <span className="text-muted-foreground">Language</span>
                <span>{detail.language}</span>
                <span className="text-muted-foreground">Last login</span>
                <span>
                  {detail.lastLoginAt ? formatDate(detail.lastLoginAt) : "Never"}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create member dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Create a new staff account with a 6-digit PIN.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Display Name *</Label>
              <Input
                value={createForm.displayName}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, displayName: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={createForm.email ?? ""}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, email: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Role *</Label>
              <Select
                value={createForm.roleCode}
                onValueChange={(value) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    roleCode: value as "owner" | "manager",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tenantUserRoleOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Initial PIN (6 digits) *</Label>
              <Input
                maxLength={6}
                placeholder="000000"
                value={createForm.initialPin}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, initialPin: e.target.value }))
                }
              />
            </div>

            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}

            <Button disabled={createLoading} onClick={() => void handleCreate()}>
              {createLoading ? "Creating..." : "Create Member"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Disable confirmation dialog */}
      <Dialog
        open={disableUserId !== null}
        onOpenChange={(open) => {
          if (!open) setDisableUserId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable Member</DialogTitle>
            <DialogDescription>
              This will disable the account and revoke all active sessions.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDisableUserId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={disableLoading}
              onClick={() => disableUserId && void handleDisable(disableUserId)}
            >
              {disableLoading ? "Disabling..." : "Disable"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset PIN confirmation dialog */}
      <Dialog
        open={resetPinUserId !== null}
        onOpenChange={(open) => {
          if (!open) setResetPinUserId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset PIN</DialogTitle>
            <DialogDescription>
              A new 6-digit PIN will be generated. Share it with the employee immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setResetPinUserId(null)}>
              Cancel
            </Button>
            <Button
              disabled={resetPinLoading}
              onClick={() => resetPinUserId && void handleResetPin(resetPinUserId)}
            >
              {resetPinLoading ? "Resetting..." : "Reset PIN"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Temporary PIN display dialog */}
      <Dialog
        open={temporaryPin !== null}
        onOpenChange={(open) => {
          if (!open) setTemporaryPin(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Temporary PIN</DialogTitle>
            <DialogDescription>
              Share this PIN with the employee now. It will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <span className="text-4xl font-mono font-bold tracking-widest">
              {temporaryPin}
            </span>
          </div>
          <Button onClick={() => setTemporaryPin(null)}>Done</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
