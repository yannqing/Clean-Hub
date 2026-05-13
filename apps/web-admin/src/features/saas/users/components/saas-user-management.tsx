"use client";

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  toast,
} from "@cleanhub/ui";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import { webAdminApi } from "@/lib/api-client";

import type {
  CreateSaasUserRequest,
  SaasManagedUserType,
  SaasUserStatus,
  SaasUserSummary,
  UpdateSaasUserRequest,
} from "../types";

const PAGE_SIZE = 10;
const statusOptions: SaasUserStatus[] = [
  "invited",
  "active",
  "disabled",
  "suspended",
];
const userTypeOptions: SaasManagedUserType[] = ["saas", "tenant"];

type UserFormState = {
  tenantId: string;
  userType: SaasManagedUserType;
  email: string;
  phone: string;
  displayName: string;
  password: string;
  status: SaasUserStatus;
};

const emptyFormState: UserFormState = {
  tenantId: "",
  userType: "saas",
  email: "",
  phone: "",
  displayName: "",
  password: "",
  status: "active",
};

function createFormState(user?: SaasUserSummary): UserFormState {
  if (!user) {
    return emptyFormState;
  }

  return {
    tenantId: user.tenantId ?? "",
    userType: user.userType,
    email: user.email ?? "",
    phone: user.phone ?? "",
    displayName: user.displayName,
    password: "",
    status: user.status,
  };
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusBadgeVariant(status: SaasUserStatus) {
  if (status === "active") {
    return "default";
  }

  if (status === "disabled" || status === "suspended") {
    return "destructive";
  }

  return "secondary";
}

function toCreatePayload(formState: UserFormState): CreateSaasUserRequest {
  return {
    tenantId: formState.tenantId.trim() || undefined,
    userType: formState.userType,
    email: formState.email.trim() || undefined,
    phone: formState.phone.trim() || undefined,
    displayName: formState.displayName.trim(),
    password: formState.password,
    status: formState.status,
  };
}

function toUpdatePayload(formState: UserFormState): UpdateSaasUserRequest {
  return {
    tenantId: formState.tenantId.trim() || null,
    userType: formState.userType,
    email: formState.email.trim() || null,
    phone: formState.phone.trim() || null,
    displayName: formState.displayName.trim(),
    password: formState.password || undefined,
    status: formState.status,
  };
}

export function SaasUserManagement() {
  const [users, setUsers] = useState<SaasUserSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SaasUserStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SaasUserSummary | null>(null);
  const [deletingUser, setDeletingUser] = useState<SaasUserSummary | null>(null);
  const [formState, setFormState] = useState<UserFormState>(emptyFormState);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(total / PAGE_SIZE)),
    [total],
  );

  async function loadUsers(
    nextPage = page,
    options: {
      query?: string;
      status?: SaasUserStatus | "all";
    } = {},
  ) {
    setLoading(true);
    const nextQuery = options.query ?? query;
    const nextStatus = options.status ?? status;

    try {
      const result = await webAdminApi.saas.users.list({
        q: nextQuery.trim() || undefined,
        status: nextStatus === "all" ? undefined : nextStatus,
        limit: PAGE_SIZE,
        offset: nextPage * PAGE_SIZE,
      });

      setUsers(result.items);
      setTotal(result.total);
      setPage(nextPage);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load users.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers(0);
  }, []);

  function openCreateForm() {
    setEditingUser(null);
    setFormState(emptyFormState);
    setFormOpen(true);
  }

  function openEditForm(user: SaasUserSummary) {
    setEditingUser(user);
    setFormState(createFormState(user));
    setFormOpen(true);
  }

  function openDeleteDialog(user: SaasUserSummary) {
    setDeletingUser(user);
    setDeleteOpen(true);
  }

  function updateFormField<K extends keyof UserFormState>(
    field: K,
    value: UserFormState[K],
  ) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      if (editingUser) {
        await webAdminApi.saas.users.update(
          editingUser.id,
          toUpdatePayload(formState),
        );
        toast.success("User updated.");
      } else {
        await webAdminApi.saas.users.create(toCreatePayload(formState));
        toast.success("User created.");
      }

      setFormOpen(false);
      await loadUsers(editingUser ? page : 0);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save user.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingUser) {
      return;
    }

    setDeleting(true);

    try {
      await webAdminApi.saas.users.delete(deletingUser.id);
      toast.success("User deleted.");
      setDeleteOpen(false);
      setDeletingUser(null);
      await loadUsers(users.length === 1 && page > 0 ? page - 1 : page);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete user.";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="grid gap-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">SaaS Users</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Test user management for records in the users table.
          </p>
        </div>

        <Button onClick={openCreateForm} type="button">
          New user
        </Button>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <form
          className="flex flex-1 gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            loadUsers(0);
          }}
        >
          <Input
            aria-label="Search users"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email, or phone"
            value={query}
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>

        <Select
          onValueChange={(value) => {
            const nextStatus = value as SaasUserStatus | "all";
            setStatus(nextStatus);
            loadUsers(0, { status: nextStatus });
          }}
          value={status}
        >
          <SelectTrigger className="w-full md:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statusOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Last login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell className="h-24 text-center" colSpan={8}>
                  Loading users...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell className="h-24 text-center" colSpan={8}>
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.displayName}</TableCell>
                  <TableCell>{user.email ?? "-"}</TableCell>
                  <TableCell>{user.phone ?? "-"}</TableCell>
                  <TableCell>{user.userType}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(user.status)}>
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-48 truncate">
                    {user.tenantId ?? "-"}
                  </TableCell>
                  <TableCell>{formatDateTime(user.lastLoginAt)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        onClick={() => openEditForm(user)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Edit
                      </Button>
                      <Button
                        onClick={() => openDeleteDialog(user)}
                        size="sm"
                        type="button"
                        variant="destructive"
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          Showing {total === 0 ? 0 : page * PAGE_SIZE + 1}-
          {Math.min((page + 1) * PAGE_SIZE, total)} of {total}
        </p>
        <div className="flex gap-2">
          <Button
            disabled={loading || page === 0}
            onClick={() => loadUsers(page - 1)}
            type="button"
            variant="outline"
          >
            Previous
          </Button>
          <Button
            disabled={loading || page + 1 >= pageCount}
            onClick={() => loadUsers(page + 1)}
            type="button"
            variant="outline"
          >
            Next
          </Button>
        </div>
      </div>

      <Dialog onOpenChange={setFormOpen} open={formOpen}>
        <DialogContent>
          <form className="grid gap-4" onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editingUser ? "Edit user" : "New user"}</DialogTitle>
              <DialogDescription>
                Create or update a users table record.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="displayName">Display name</Label>
                <Input
                  id="displayName"
                  onChange={(event) =>
                    updateFormField("displayName", event.target.value)
                  }
                  required
                  value={formState.displayName}
                />
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    onChange={(event) =>
                      updateFormField("email", event.target.value)
                    }
                    type="email"
                    value={formState.email}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    onChange={(event) =>
                      updateFormField("phone", event.target.value)
                    }
                    value={formState.phone}
                  />
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>User type</Label>
                  <Select
                    onValueChange={(value) =>
                      updateFormField("userType", value as SaasManagedUserType)
                    }
                    value={formState.userType}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {userTypeOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select
                    onValueChange={(value) =>
                      updateFormField("status", value as SaasUserStatus)
                    }
                    value={formState.status}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tenantId">Tenant ID</Label>
                <Input
                  id="tenantId"
                  onChange={(event) =>
                    updateFormField("tenantId", event.target.value)
                  }
                  placeholder="Optional"
                  value={formState.tenantId}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">
                  {editingUser ? "New password" : "Password"}
                </Label>
                <Input
                  id="password"
                  minLength={6}
                  onChange={(event) =>
                    updateFormField("password", event.target.value)
                  }
                  placeholder={editingUser ? "Leave blank to keep unchanged" : ""}
                  required={!editingUser}
                  type="password"
                  value={formState.password}
                />
              </div>
            </div>

            <DialogFooter>
              <Button disabled={saving} type="submit">
                {saving ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setDeleteOpen} open={deleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user</DialogTitle>
            <DialogDescription>
              This will soft delete {deletingUser?.displayName ?? "this user"}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={deleting}
              onClick={() => setDeleteOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={deleting}
              onClick={handleDelete}
              type="button"
              variant="destructive"
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
