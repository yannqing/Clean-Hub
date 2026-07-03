"use client";

import {
  Badge,
  Button,
  Checkbox,
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
  getTenantBranchListQuery,
  getTenantUserDetailQuery,
  getTenantUserListQuery,
  type TenantUserListQuery,
} from "../queries";
import {
  createTenantUserAction,
  disableTenantUserAction,
  enableTenantUserAction,
  resetTenantUserPinAction,
  updateTenantUserAction,
} from "../actions";
import type {
  BranchSummary,
  CreateTenantUserRequest,
  TenantUserDetail,
  TenantUserRoleCode,
  TenantUserSummary,
  UpdateTenantUserRequest,
} from "../types";

const PAGE_SIZE = 20;

type TenantUserListViewProps = {
  initialError?: string;
  initialUsers?: TenantUserSummary[];
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}

function formatDate(value: string | null): string {
  if (!value) return "Never";

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

function RoleBadge({ role }: { role: string }) {
  return <Badge variant="outline">{role}</Badge>;
}

function getTenantUserRoleCode(role: string): TenantUserRoleCode | undefined {
  return tenantUserRoleOptions.some((option) => option.value === role)
    ? (role as TenantUserRoleCode)
    : undefined;
}

function createEditForm(
  user: TenantUserSummary | TenantUserDetail,
): UpdateTenantUserRequest {
  const roleCode = getTenantUserRoleCode(user.role);
  const form: UpdateTenantUserRequest = {
    displayName: user.displayName,
    branchIds: user.branchIds,
  };

  if ("phone" in user) {
    form.phone = user.phone;
  }

  if (roleCode) {
    form.roleCode = roleCode;
  }

  return form;
}

function BranchSelect({
  branches,
  disabled = false,
  onChange,
  selected,
}: {
  branches: BranchSummary[];
  disabled?: boolean;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto border rounded-md p-2">
      {branches.length === 0 ? (
        <p className="text-sm text-muted-foreground px-1">No branches found.</p>
      ) : (
        branches.map((branch) => (
          <label
            key={branch.id}
            className={`flex items-center gap-2 ${
              disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            }`}
          >
            <Checkbox
              checked={selected.includes(branch.id)}
              disabled={disabled}
              onCheckedChange={(checked) => {
                if (disabled) return;

                if (checked) {
                  onChange([...selected, branch.id]);
                } else {
                  onChange(selected.filter((id) => id !== branch.id));
                }
              }}
            />
            <span className="text-sm">{branch.name}</span>
          </label>
        ))
      )}
    </div>
  );
}

export function TenantUserListView({
  initialError,
  initialUsers = [],
}: TenantUserListViewProps) {
  const isCurrent = useRef(true);
  const editRequestSeq = useRef(0);

  const [users, setUsers] = useState<TenantUserSummary[]>(initialUsers);
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(() => initialUsers.length === 0);
  const [error, setError] = useState<string | null>(initialError ?? null);

  const [branches, setBranches] = useState<BranchSummary[]>([]);

  const [selectedUser, setSelectedUser] = useState<TenantUserSummary | null>(null);
  const [detail, setDetail] = useState<TenantUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateTenantUserRequest>({
    displayName: "",
    email: "",
    phone: "",
    initialPin: "",
    roleCode: "manager",
    branchIds: [],
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<UpdateTenantUserRequest>({});
  const [editDetailLoading, setEditDetailLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [disableUserId, setDisableUserId] = useState<string | null>(null);
  const [disableLoading, setDisableLoading] = useState(false);
  const [enableUserId, setEnableUserId] = useState<string | null>(null);
  const [enableLoading, setEnableLoading] = useState(false);

  const [resetPinUserId, setResetPinUserId] = useState<string | null>(null);
  const [resetPinReason, setResetPinReason] = useState("");
  const [resetPinLoading, setResetPinLoading] = useState(false);
  const [temporaryPin, setTemporaryPin] = useState<string | null>(null);

  useEffect(() => {
    isCurrent.current = true;
    return () => {
      isCurrent.current = false;
    };
  }, []);

  useEffect(() => {
    getTenantBranchListQuery()
      .then((result) => {
        if (isCurrent.current) setBranches(result);
      })
      .catch(() => {
        /* non-critical */
      });
  }, []);

  const listQuery = useMemo<TenantUserListQuery>(
    () => ({
      limit: PAGE_SIZE,
      offset,
      q: search.trim() || undefined,
      status: statusFilter || undefined,
    }),
    [offset, search, statusFilter],
  );

  const loadUsers = useCallback(() => {
    return getTenantUserListQuery(listQuery)
      .then((result) => {
        if (!isCurrent.current) return;

        const filtered = result.filter((u) => {
          if (roleFilter && u.role !== roleFilter) return false;
          if (branchFilter && !u.branchIds.includes(branchFilter)) return false;
          return true;
        });

        setError(null);
        setUsers(filtered);
      })
      .catch((err: unknown) => {
        if (!isCurrent.current) return;
        setError(getErrorMessage(err));
      })
      .finally(() => {
        if (isCurrent.current) setLoading(false);
      });
  }, [listQuery, roleFilter, branchFilter]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

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
      phone: createForm.phone?.trim() || undefined,
      branchIds: createForm.branchIds?.length ? createForm.branchIds : undefined,
    });

    if (!isCurrent.current) return;
    setCreateLoading(false);

    if (!result.ok) {
      setCreateError(result.error);
      return;
    }

    setCreateOpen(false);
    setCreateForm({
      displayName: "",
      email: "",
      phone: "",
      initialPin: "",
      roleCode: "manager",
      branchIds: [],
    });
    void loadUsers();
  }, [createForm, loadUsers]);

  const openEdit = useCallback((user: TenantUserSummary) => {
    const requestSeq = editRequestSeq.current + 1;

    editRequestSeq.current = requestSeq;
    setEditUserId(user.id);
    setEditForm(createEditForm(user));
    setEditDetailLoading(true);
    setEditError(null);
    setEditOpen(true);

    getTenantUserDetailQuery(user.id)
      .then((result) => {
        if (!isCurrent.current || editRequestSeq.current !== requestSeq) return;
        setEditForm(createEditForm(result));
      })
      .catch((err: unknown) => {
        if (!isCurrent.current || editRequestSeq.current !== requestSeq) return;
        setEditError(getErrorMessage(err));
      })
      .finally(() => {
        if (isCurrent.current && editRequestSeq.current === requestSeq) {
          setEditDetailLoading(false);
        }
      });
  }, []);

  const handleEdit = useCallback(async () => {
    if (!editUserId || editDetailLoading) return;
    setEditLoading(true);
    setEditError(null);

    const result = await updateTenantUserAction(editUserId, editForm);

    if (!isCurrent.current) return;
    setEditLoading(false);

    if (!result.ok) {
      setEditError(result.error);
      return;
    }

    setEditOpen(false);
    setEditUserId(null);
    void loadUsers();
  }, [editDetailLoading, editUserId, editForm, loadUsers]);

  const handleDisable = useCallback(
    async (userId: string) => {
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
      void loadUsers();
    },
    [loadUsers, selectedUser],
  );

  const handleEnable = useCallback(
    async (userId: string) => {
      setEnableLoading(true);

      const result = await enableTenantUserAction(userId);

      if (!isCurrent.current) return;
      setEnableLoading(false);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setEnableUserId(null);
      void loadUsers();
    },
    [loadUsers],
  );

  const handleResetPin = useCallback(
    async (userId: string) => {
      if (!resetPinReason.trim()) return;
      setResetPinLoading(true);

      const result = await resetTenantUserPinAction(userId, resetPinReason.trim());

      if (!isCurrent.current) return;
      setResetPinLoading(false);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setTemporaryPin(result.data.temporaryPin);
      setResetPinUserId(null);
      setResetPinReason("");
    },
    [resetPinReason],
  );

  const getBranchNames = useCallback(
    (branchIds: string[]) => {
      if (branchIds.length === 0) return "—";

      return branchIds
        .map((id) => branches.find((b) => b.id === id)?.name ?? id.slice(0, 6))
        .join(", ");
    },
    [branches],
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Team Members</h1>
        <Button onClick={() => setCreateOpen(true)}>Add Member</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          className="max-w-xs"
          onChange={(e) => {
            setLoading(true);
            setError(null);
            setSearch(e.target.value);
            setOffset(0);
          }}
          placeholder="Search by name, email..."
          value={search}
        />
        <Select
          value={statusFilter || "all"}
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
        <Select
          value={roleFilter || "all"}
          onValueChange={(value) => {
            setRoleFilter(value === "all" ? "" : value);
            setOffset(0);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {tenantUserRoleOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {branches.length > 0 && (
          <Select
            value={branchFilter || "all"}
            onValueChange={(value) => {
              setBranchFilter(value === "all" ? "" : value);
              setOffset(0);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

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
              <TableHead>Branches</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead>Created</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow
                className="cursor-pointer"
                key={user.id}
                onClick={() => void handleSelectUser(user)}
              >
                <TableCell className="font-medium">{user.displayName}</TableCell>
                <TableCell>{user.email ?? "—"}</TableCell>
                <TableCell>
                  <RoleBadge role={user.role} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                  {getBranchNames(user.branchIds)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={user.status} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(user.lastLoginAt)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(user.createdAt)}
                </TableCell>
                <TableCell>
                  <div
                    className="flex gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      onClick={() => openEdit(user)}
                      size="sm"
                      variant="outline"
                    >
                      Edit
                    </Button>
                    <Button
                      onClick={() => {
                        setResetPinUserId(user.id);
                        setResetPinReason("");
                      }}
                      size="sm"
                      variant="outline"
                    >
                      Reset PIN
                    </Button>
                    {user.status !== "disabled" ? (
                      <Button
                        onClick={() => setDisableUserId(user.id)}
                        size="sm"
                        variant="destructive"
                      >
                        Disable
                      </Button>
                    ) : (
                      <Button
                        onClick={() => setEnableUserId(user.id)}
                        size="sm"
                        variant="outline"
                      >
                        Enable
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
          disabled={offset === 0}
          onClick={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
          variant="outline"
        >
          Previous
        </Button>
        <Button
          disabled={users.length < PAGE_SIZE}
          onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
          variant="outline"
        >
          Next
        </Button>
      </div>

      {/* Detail dialog */}
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setSelectedUser(null);
            setDetail(null);
          }
        }}
        open={selectedUser !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Member Detail</DialogTitle>
            <DialogDescription>{selectedUser?.displayName}</DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : null}
          {detailError ? (
            <p className="text-sm text-destructive">{detailError}</p>
          ) : null}
          {detail ? (
            <div className="flex flex-col gap-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">Email</span>
                <span>{detail.email ?? "—"}</span>
                <span className="text-muted-foreground">Phone</span>
                <span>{detail.phone ?? "—"}</span>
                <span className="text-muted-foreground">Role</span>
                <RoleBadge role={detail.role} />
                <span className="text-muted-foreground">Branches</span>
                <span>{getBranchNames(detail.branchIds)}</span>
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={detail.status} />
                <span className="text-muted-foreground">Language</span>
                <span>{detail.language}</span>
                <span className="text-muted-foreground">Last login</span>
                <span>{formatDate(detail.lastLoginAt)}</span>
                <span className="text-muted-foreground">Updated</span>
                <span>{formatDate(detail.updatedAt)}</span>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Create dialog */}
      <Dialog onOpenChange={setCreateOpen} open={createOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
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
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, displayName: e.target.value }))
                }
                value={createForm.displayName}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Email</Label>
              <Input
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, email: e.target.value }))
                }
                type="email"
                value={createForm.email ?? ""}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Phone</Label>
              <Input
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="+221..."
                type="tel"
                value={createForm.phone ?? ""}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Role *</Label>
              <Select
                onValueChange={(value) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    roleCode: value as TenantUserRoleCode,
                  }))
                }
                value={createForm.roleCode}
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
              <Label>Branches</Label>
              <BranchSelect
                branches={branches}
                onChange={(ids) =>
                  setCreateForm((prev) => ({ ...prev, branchIds: ids }))
                }
                selected={createForm.branchIds ?? []}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Initial PIN (6 digits) *</Label>
              <Input
                maxLength={6}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, initialPin: e.target.value }))
                }
                placeholder="000000"
                value={createForm.initialPin}
              />
            </div>

            {createError ? (
              <p className="text-sm text-destructive">{createError}</p>
            ) : null}

            <Button
              disabled={createLoading}
              onClick={() => void handleCreate()}
            >
              {createLoading ? "Creating..." : "Create Member"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            editRequestSeq.current += 1;
            setEditOpen(false);
            setEditUserId(null);
            setEditForm({});
            setEditDetailLoading(false);
            setEditError(null);
          }
        }}
        open={editOpen}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Member</DialogTitle>
            <DialogDescription>Update member details.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {editDetailLoading ? (
              <p className="text-sm text-muted-foreground">
                Loading current member details...
              </p>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <Label>Display Name</Label>
              <Input
                disabled={editDetailLoading}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, displayName: e.target.value }))
                }
                value={editForm.displayName ?? ""}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Phone</Label>
              <Input
                disabled={editDetailLoading}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    phone: e.target.value || null,
                  }))
                }
                placeholder="+221..."
                type="tel"
                value={editForm.phone ?? ""}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Role</Label>
              <Select
                disabled={editDetailLoading}
                onValueChange={(value) =>
                  setEditForm((prev) => ({
                    ...prev,
                    roleCode: value as TenantUserRoleCode,
                  }))
                }
                value={editForm.roleCode ?? ""}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Keep current role" />
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
              <Label>Branches</Label>
              <BranchSelect
                branches={branches}
                disabled={editDetailLoading}
                onChange={(ids) =>
                  setEditForm((prev) => ({ ...prev, branchIds: ids }))
                }
                selected={editForm.branchIds ?? []}
              />
            </div>

            {editError ? (
              <p className="text-sm text-destructive">{editError}</p>
            ) : null}

            <div className="flex justify-end gap-3">
              <Button onClick={() => setEditOpen(false)} variant="outline">
                Cancel
              </Button>
              <Button
                disabled={editLoading || editDetailLoading}
                onClick={() => void handleEdit()}
              >
                {editLoading ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Disable confirmation */}
      <Dialog
        onOpenChange={(open) => {
          if (!open) setDisableUserId(null);
        }}
        open={disableUserId !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable Member</DialogTitle>
            <DialogDescription>
              This will disable the account and revoke all active sessions.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button onClick={() => setDisableUserId(null)} variant="outline">
              Cancel
            </Button>
            <Button
              disabled={disableLoading}
              onClick={() => disableUserId && void handleDisable(disableUserId)}
              variant="destructive"
            >
              {disableLoading ? "Disabling..." : "Disable"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Enable confirmation */}
      <Dialog
        onOpenChange={(open) => {
          if (!open) setEnableUserId(null);
        }}
        open={enableUserId !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enable Member</DialogTitle>
            <DialogDescription>
              This will restore the member&apos;s access to the system.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button onClick={() => setEnableUserId(null)} variant="outline">
              Cancel
            </Button>
            <Button
              disabled={enableLoading}
              onClick={() => enableUserId && void handleEnable(enableUserId)}
            >
              {enableLoading ? "Enabling..." : "Enable"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset PIN dialog */}
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setResetPinUserId(null);
            setResetPinReason("");
          }
        }}
        open={resetPinUserId !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset PIN</DialogTitle>
            <DialogDescription>
              A new 6-digit PIN will be generated. Share it with the employee
              immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Reason *</Label>
              <Input
                onChange={(e) => setResetPinReason(e.target.value)}
                placeholder="e.g. Employee forgot PIN"
                value={resetPinReason}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                onClick={() => setResetPinUserId(null)}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={resetPinLoading || !resetPinReason.trim()}
                onClick={() =>
                  resetPinUserId && void handleResetPin(resetPinUserId)
                }
              >
                {resetPinLoading ? "Resetting..." : "Reset PIN"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Temporary PIN display */}
      <Dialog
        onOpenChange={(open) => {
          if (!open) setTemporaryPin(null);
        }}
        open={temporaryPin !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Temporary PIN</DialogTitle>
            <DialogDescription>
              Share this PIN with the employee now. It will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <span className="font-mono text-4xl font-bold tracking-widest">
              {temporaryPin}
            </span>
          </div>
          <Button onClick={() => setTemporaryPin(null)}>Done</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
