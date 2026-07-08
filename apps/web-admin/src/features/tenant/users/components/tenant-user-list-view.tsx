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

import { Pagination } from "@/components/pagination";
import { useTenantI18n } from "@/i18n";

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
  const variant =
    status === "active"
      ? "default"
      : status === "disabled"
        ? "destructive"
        : "secondary";

  return <Badge variant={variant}>{label}</Badge>;
}

function RoleBadge({ label }: { label: string }) {
  return <Badge variant="outline">{label}</Badge>;
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
  emptyLabel,
  onChange,
  selected,
}: {
  branches: BranchSummary[];
  disabled?: boolean;
  emptyLabel: string;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto border rounded-md p-2">
      {branches.length === 0 ? (
        <p className="text-sm text-muted-foreground px-1">{emptyLabel}</p>
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
  const { m, formatDateTime } = useTenantI18n();

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
        setError(getErrorMessage(err, m.common.unexpectedError));
      })
      .finally(() => {
        if (isCurrent.current) setLoading(false);
      });
  }, [listQuery, roleFilter, branchFilter, m.common.unexpectedError]);

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
      setDetailError(getErrorMessage(err, m.common.unexpectedError));
    } finally {
      if (isCurrent.current) setDetailLoading(false);
    }
  }, [m.common.unexpectedError]);

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
        setEditError(getErrorMessage(err, m.common.unexpectedError));
      })
      .finally(() => {
        if (isCurrent.current && editRequestSeq.current === requestSeq) {
          setEditDetailLoading(false);
        }
      });
  }, [m.common.unexpectedError]);

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
        <h1 className="text-2xl font-semibold">{m.users.title}</h1>
        <Button onClick={() => setCreateOpen(true)}>{m.users.addMember}</Button>
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
          placeholder={m.users.searchPlaceholder}
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
            <SelectValue placeholder={m.common.allStatuses} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{m.common.allStatuses}</SelectItem>
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
            <SelectValue placeholder={m.common.allRoles} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{m.common.allRoles}</SelectItem>
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
              <SelectValue placeholder={m.common.allBranches} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{m.common.allBranches}</SelectItem>
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
        <p className="text-sm text-muted-foreground">{m.common.loading}</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-muted-foreground">{m.users.noMembers}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{m.users.columns.name}</TableHead>
              <TableHead>{m.users.columns.email}</TableHead>
              <TableHead>{m.users.columns.role}</TableHead>
              <TableHead>{m.users.columns.branches}</TableHead>
              <TableHead>{m.users.columns.status}</TableHead>
              <TableHead>{m.users.columns.lastLogin}</TableHead>
              <TableHead>{m.users.columns.created}</TableHead>
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
                  <RoleBadge label={user.role} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                  {getBranchNames(user.branchIds)}
                </TableCell>
                <TableCell>
                  <StatusBadge
                    status={user.status}
                    label={user.status}
                  />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {user.lastLoginAt
                    ? formatDateTime(user.lastLoginAt) || m.common.never
                    : m.common.never}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDateTime(user.createdAt)}
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
                      {m.users.actions.edit}
                    </Button>
                    <Button
                      onClick={() => {
                        setResetPinUserId(user.id);
                        setResetPinReason("");
                      }}
                      size="sm"
                      variant="outline"
                    >
                      {m.users.actions.resetPin}
                    </Button>
                    {user.status !== "disabled" ? (
                      <Button
                        onClick={() => setDisableUserId(user.id)}
                        size="sm"
                        variant="destructive"
                      >
                        {m.common.disable}
                      </Button>
                    ) : (
                      <Button
                        onClick={() => setEnableUserId(user.id)}
                        size="sm"
                        variant="outline"
                      >
                        {m.common.enable}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Pagination
        currentPageCount={users.length}
        nextLabel={m.common.next}
        offset={offset}
        onOffsetChange={setOffset}
        pageSize={PAGE_SIZE}
        previousLabel={m.common.previous}
      />

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
            <DialogTitle>{m.users.detail.title}</DialogTitle>
            <DialogDescription>{selectedUser?.displayName}</DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <p className="text-sm text-muted-foreground">{m.common.loading}</p>
          ) : null}
          {detailError ? (
            <p className="text-sm text-destructive">{detailError}</p>
          ) : null}
          {detail ? (
            <div className="flex flex-col gap-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">
                  {m.users.detail.labels.email}
                </span>
                <span>{detail.email ?? "—"}</span>
                <span className="text-muted-foreground">
                  {m.users.detail.labels.phone}
                </span>
                <span>{detail.phone ?? "—"}</span>
                <span className="text-muted-foreground">
                  {m.users.detail.labels.role}
                </span>
                <RoleBadge label={detail.role} />
                <span className="text-muted-foreground">
                  {m.users.detail.labels.branches}
                </span>
                <span>{getBranchNames(detail.branchIds)}</span>
                <span className="text-muted-foreground">
                  {m.users.detail.labels.status}
                </span>
                <StatusBadge status={detail.status} label={detail.status} />
                <span className="text-muted-foreground">
                  {m.users.detail.labels.language}
                </span>
                <span>{detail.language}</span>
                <span className="text-muted-foreground">
                  {m.users.detail.labels.lastLogin}
                </span>
                <span>
                  {detail.lastLoginAt
                    ? formatDateTime(detail.lastLoginAt) || m.common.never
                    : m.common.never}
                </span>
                <span className="text-muted-foreground">
                  {m.users.detail.labels.updated}
                </span>
                <span>{formatDateTime(detail.updatedAt)}</span>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Create dialog */}
      <Dialog onOpenChange={setCreateOpen} open={createOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{m.users.create.title}</DialogTitle>
            <DialogDescription>{m.users.create.description}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>{m.users.create.labels.displayName} *</Label>
              <Input
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, displayName: e.target.value }))
                }
                value={createForm.displayName}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{m.users.create.labels.email}</Label>
              <Input
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, email: e.target.value }))
                }
                type="email"
                value={createForm.email ?? ""}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{m.users.create.labels.phone}</Label>
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
              <Label>{m.users.create.labels.role} *</Label>
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
              <Label>{m.users.create.labels.branches}</Label>
              <BranchSelect
                branches={branches}
                emptyLabel={m.users.noMembers}
                onChange={(ids) =>
                  setCreateForm((prev) => ({ ...prev, branchIds: ids }))
                }
                selected={createForm.branchIds ?? []}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{m.users.create.labels.initialPin} *</Label>
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
              {createLoading
                ? m.users.create.creatingMember
                : m.users.create.createMember}
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
            <DialogTitle>{m.users.edit.title}</DialogTitle>
            <DialogDescription>{m.users.edit.description}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {editDetailLoading ? (
              <p className="text-sm text-muted-foreground">
                {m.users.edit.loadingCurrent}
              </p>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <Label>{m.users.edit.labels.displayName}</Label>
              <Input
                disabled={editDetailLoading}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, displayName: e.target.value }))
                }
                value={editForm.displayName ?? ""}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{m.users.edit.labels.phone}</Label>
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
              <Label>{m.users.edit.labels.role}</Label>
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
                  <SelectValue placeholder={m.users.edit.keepCurrentRole} />
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
              <Label>{m.users.edit.labels.branches}</Label>
              <BranchSelect
                branches={branches}
                disabled={editDetailLoading}
                emptyLabel={m.users.noMembers}
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
                {m.common.cancel}
              </Button>
              <Button
                disabled={editLoading || editDetailLoading}
                onClick={() => void handleEdit()}
              >
                {editLoading ? m.common.saving : m.common.edit}
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
            <DialogTitle>{m.users.disable.title}</DialogTitle>
            <DialogDescription>{m.users.disable.description}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button onClick={() => setDisableUserId(null)} variant="outline">
              {m.common.cancel}
            </Button>
            <Button
              disabled={disableLoading}
              onClick={() => disableUserId && void handleDisable(disableUserId)}
              variant="destructive"
            >
              {disableLoading ? m.users.disable.disabling : m.users.disable.action}
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
            <DialogTitle>{m.users.enable.title}</DialogTitle>
            <DialogDescription>{m.users.enable.description}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button onClick={() => setEnableUserId(null)} variant="outline">
              {m.common.cancel}
            </Button>
            <Button
              disabled={enableLoading}
              onClick={() => enableUserId && void handleEnable(enableUserId)}
            >
              {enableLoading ? m.users.enable.enabling : m.users.enable.action}
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
            <DialogTitle>{m.users.resetPin.title}</DialogTitle>
            <DialogDescription>
              {m.users.resetPin.description}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{m.users.resetPin.reason} *</Label>
              <Input
                onChange={(e) => setResetPinReason(e.target.value)}
                placeholder={m.users.resetPin.reasonPlaceholder}
                value={resetPinReason}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                onClick={() => setResetPinUserId(null)}
                variant="outline"
              >
                {m.common.cancel}
              </Button>
              <Button
                disabled={resetPinLoading || !resetPinReason.trim()}
                onClick={() =>
                  resetPinUserId && void handleResetPin(resetPinUserId)
                }
              >
                {resetPinLoading ? m.users.resetPin.resetting : m.users.resetPin.action}
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
            <DialogTitle>{m.users.temporaryPin.title}</DialogTitle>
            <DialogDescription>
              {m.users.temporaryPin.description}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <span className="font-mono text-4xl font-bold tracking-widest">
              {temporaryPin}
            </span>
          </div>
          <Button onClick={() => setTemporaryPin(null)}>
            {m.users.temporaryPin.done}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
