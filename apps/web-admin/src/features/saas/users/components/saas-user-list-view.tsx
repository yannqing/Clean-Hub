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
} from "@cleanhub/ui";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  inviteSaasUserAction,
  updateSaasUserAction,
  updateSaasUserStatusAction,
} from "../actions";
import {
  saasUserLanguageLabels,
  saasUserRoleLabels,
  saasUserStatusLabels,
  saasUserStatusOptions,
} from "../constants";
import { getSaasUserDetailQuery, getSaasUserListQuery } from "../queries";
import type {
  SaasUserStatus,
  SaasUserStatusCounts,
  SaasUserSummary,
} from "../types";
import type {
  InviteSaasUserFormErrors,
  InviteSaasUserFormInput,
  UpdateSaasUserFormInput,
} from "../validators";

type StatusFilter = "all" | SaasUserStatus;
type InviteSaasUserField = keyof InviteSaasUserFormInput;

type SaasUserMetrics = SaasUserStatusCounts & {
  total: number;
};

const emptyMetrics: SaasUserMetrics = {
  active: 0,
  disabled: 0,
  invited: 0,
  suspended: 0,
  total: 0,
};

const defaultInviteForm: InviteSaasUserFormInput = {
  displayName: "",
  email: "",
  language: "en",
  password: "",
  phone: "",
  roleCode: "support",
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Failed to load platform members.";
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(date);
}

function getStatusVariant(
  status: SaasUserStatus,
): "default" | "outline" | "secondary" {
  if (status === "active") {
    return "default";
  }

  if (status === "invited") {
    return "secondary";
  }

  return "outline";
}

function getRoleLabel(role: string): string {
  return saasUserRoleLabels[role as keyof typeof saasUserRoleLabels] ?? role;
}

function getLanguageLabel(language: string): string {
  return saasUserLanguageLabels[language] ?? language;
}

function canChangeStatus(status: SaasUserStatus): boolean {
  return status === "active" || status === "disabled";
}

function getStatusActionLabel(status: SaasUserStatus): string {
  if (status === "active") {
    return "Disable";
  }

  if (status === "disabled") {
    return "Enable";
  }

  return "No action";
}

export function SaasUserListView() {
  const editRequestIdRef = useRef(0);
  const [users, setUsers] = useState<SaasUserSummary[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [metrics, setMetrics] = useState<SaasUserMetrics>(emptyMetrics);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const [inviteFormError, setInviteFormError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] =
    useState<InviteSaasUserFormInput>(defaultInviteForm);
  const [inviteErrors, setInviteErrors] = useState<InviteSaasUserFormErrors>(
    {},
  );
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState<SaasUserSummary | null>(null);
  const [editForm, setEditForm] = useState<UpdateSaasUserFormInput>({
    displayName: "",
    email: "",
    language: "en",
    phone: "",
    timezone: "",
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [statusUpdatingUserId, setStatusUpdatingUserId] = useState<
    string | null
  >(null);

  const listQuery = useMemo(
    () => ({
      limit: 50,
      offset: 0,
      q: query.trim() || undefined,
      status: status === "all" ? undefined : status,
    }),
    [query, status],
  );

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getSaasUserListQuery(listQuery);
      setUsers(response.data);
      setMetrics({
        ...response.meta.statusCounts,
        total: response.meta.total,
      });
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [listQuery]);

  const clearInviteFieldError = useCallback((field: InviteSaasUserField) => {
    setInviteErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
    setInviteFormError(null);
  }, []);

  const openInviteForm = useCallback(() => {
    setInviteForm(defaultInviteForm);
    setInviteErrors({});
    setInviteFormError(null);
    setInviteNotice(null);
    setInviteOpen(true);
  }, []);

  useEffect(() => {
    let isCurrent = true;

    getSaasUserListQuery(listQuery)
      .then((response) => {
        if (!isCurrent) {
          return;
        }

        setUsers(response.data);
        setMetrics({
          ...response.meta.statusCounts,
          total: response.meta.total,
        });
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (isCurrent) {
          setError(getErrorMessage(loadError));
        }
      })
      .finally(() => {
        if (isCurrent) {
          setLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [listQuery]);

  const handleStatusChange = useCallback(
    async (user: SaasUserSummary) => {
      if (!canChangeStatus(user.status)) {
        return;
      }

      const nextStatus = user.status === "active" ? "disabled" : "active";

      setStatusUpdatingUserId(user.id);
      setError(null);

      try {
        const result = await updateSaasUserStatusAction(user.id, {
          status: nextStatus,
          reason:
            nextStatus === "disabled"
              ? "Disabled from SaaS platform member list."
              : "Enabled from SaaS platform member list.",
        });

        if (!result.ok) {
          setError(result.errors.reason);
          return;
        }

        await loadUsers();
      } catch (updateError) {
        setError(getErrorMessage(updateError));
      } finally {
        setStatusUpdatingUserId(null);
      }
    },
    [loadUsers],
  );

  const openEditForm = useCallback((user: SaasUserSummary) => {
    setEditingUser(user);
    setEditForm({
      displayName: user.displayName,
      email: user.email ?? "",
      language:
        user.language === "fr" || user.language === "zh-CN"
          ? user.language
          : "en",
      phone: user.phone ?? "",
      timezone: "",
    });
    setFormError(null);

    const requestId = editRequestIdRef.current + 1;

    editRequestIdRef.current = requestId;
    setEditLoading(true);
    getSaasUserDetailQuery(user.id)
      .then((detail) => {
        if (editRequestIdRef.current !== requestId) {
          return;
        }

        setEditingUser((current) =>
          current?.id === user.id ? detail : current,
        );
        setEditForm({
          displayName: detail.displayName,
          email: detail.email ?? "",
          language:
            detail.language === "fr" || detail.language === "zh-CN"
              ? detail.language
              : "en",
          phone: detail.phone ?? "",
          timezone: detail.timezone,
        });
      })
      .catch((detailError: unknown) => {
        if (editRequestIdRef.current !== requestId) {
          return;
        }

        setFormError(getErrorMessage(detailError));
      })
      .finally(() => {
        if (editRequestIdRef.current !== requestId) {
          return;
        }

        setEditLoading(false);
      });
  }, []);

  const handleInviteSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setInviteSubmitting(true);
      setInviteErrors({});
      setInviteFormError(null);
      setInviteNotice(null);

      try {
        const result = await inviteSaasUserAction(inviteForm);

        if (!result.ok) {
          setInviteErrors(result.errors);
          setInviteFormError(
            Object.values(result.errors)[0] ?? "Invite could not be sent.",
          );
          return;
        }

        setInviteForm(defaultInviteForm);
        setInviteOpen(false);
        setInviteNotice("Invitation created successfully.");
        await loadUsers();
      } catch (submitError) {
        setInviteFormError(getErrorMessage(submitError));
      } finally {
        setInviteSubmitting(false);
      }
    },
    [inviteForm, loadUsers],
  );

  const handleEditSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!editingUser) {
        return;
      }

      setEditSubmitting(true);
      setFormError(null);

      try {
        const result = await updateSaasUserAction(editingUser.id, editForm);

        if (!result.ok) {
          setFormError(Object.values(result.errors)[0] ?? "Update failed.");
          return;
        }

        setEditingUser(null);
        await loadUsers();
      } catch (submitError) {
        setFormError(getErrorMessage(submitError));
      } finally {
        setEditSubmitting(false);
      }
    },
    [editForm, editingUser, loadUsers],
  );

  return (
    <section className="min-h-[560px]">
      <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">SaaS platform</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            Platform Members
          </h1>
        </div>

        <div className="flex gap-2">
          <Button onClick={openInviteForm} type="button">
            Invite member
          </Button>
          <Button onClick={loadUsers} type="button" variant="outline">
            Refresh
          </Button>
        </div>
      </div>

      {inviteNotice ? (
        <div className="border-b p-5">
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700">
            {inviteNotice}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 border-b p-5 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Total", metrics.total],
          ["Active", metrics.active],
          ["Invited", metrics.invited],
          ["Disabled", metrics.disabled],
          ["Suspended", metrics.suspended],
        ].map(([label, value]) => (
          <div className="rounded-md border bg-background p-4" key={label}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 border-b p-5 lg:grid-cols-[1fr_220px] lg:items-end">
        <div className="grid gap-2">
          <Label htmlFor="saas-user-search">Search</Label>
          <Input
            id="saas-user-search"
            onChange={(event) => {
              setLoading(true);
              setQuery(event.target.value);
            }}
            placeholder="Name, email, phone"
            value={query}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="saas-user-status-filter">Status</Label>
          <Select
            onValueChange={(value) => {
              setLoading(true);
              setStatus(value as StatusFilter);
            }}
            value={status}
          >
            <SelectTrigger className="w-full" id="saas-user-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {saasUserStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 p-5">
          {[0, 1, 2].map((item) => (
            <div
              className="h-14 animate-pulse rounded-md bg-muted"
              key={item}
            />
          ))}
        </div>
      ) : error ? (
        <div className="p-5">
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        </div>
      ) : users.length === 0 ? (
        <div className="p-5">
          <div className="rounded-md border border-dashed p-8 text-center">
            <h2 className="text-base font-semibold">
              No platform members found
            </h2>
          </div>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Language</TableHead>
              <TableHead>Last login</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="font-medium">{user.displayName}</div>
                  <div className="text-xs text-muted-foreground">
                    {user.email ?? user.phone ?? user.id}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {(user.roles.length > 0 ? user.roles : [user.role]).map(
                      (role) => (
                        <Badge key={role} variant="outline">
                          {getRoleLabel(role)}
                        </Badge>
                      ),
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(user.status)}>
                    {saasUserStatusLabels[user.status]}
                  </Badge>
                </TableCell>
                <TableCell>{getLanguageLabel(user.language)}</TableCell>
                <TableCell>{formatDate(user.lastLoginAt)}</TableCell>
                <TableCell>{formatDate(user.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      onClick={() => {
                        openEditForm(user);
                      }}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Edit
                    </Button>
                    <Button
                      disabled={
                        statusUpdatingUserId === user.id ||
                        !canChangeStatus(user.status)
                      }
                      onClick={() => void handleStatusChange(user)}
                      size="sm"
                      type="button"
                      variant={user.status === "active" ? "outline" : "default"}
                    >
                      {getStatusActionLabel(user.status)}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => {
          setInviteOpen(open);

          if (!open) {
            setInviteForm(defaultInviteForm);
            setInviteErrors({});
            setInviteFormError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite platform member</DialogTitle>
            <DialogDescription className="sr-only">
              Invite a SaaS-only platform member and assign the initial platform
              role.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" noValidate onSubmit={handleInviteSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="invite-display-name">Display name</Label>
              <Input
                aria-invalid={Boolean(inviteErrors.displayName)}
                id="invite-display-name"
                maxLength={120}
                onChange={(event) => {
                  clearInviteFieldError("displayName");
                  setInviteForm((current) => ({
                    ...current,
                    displayName: event.target.value,
                  }));
                }}
                required
                value={inviteForm.displayName}
              />
              {inviteErrors.displayName ? (
                <p className="text-xs text-destructive">
                  {inviteErrors.displayName}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                aria-invalid={Boolean(inviteErrors.email)}
                autoComplete="email"
                id="invite-email"
                maxLength={320}
                onChange={(event) => {
                  clearInviteFieldError("email");
                  setInviteForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }));
                }}
                required
                type="email"
                value={inviteForm.email}
              />
              {inviteErrors.email ? (
                <p className="text-xs text-destructive">
                  {inviteErrors.email}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invite-phone">Phone</Label>
              <Input
                aria-invalid={Boolean(inviteErrors.phone)}
                autoComplete="tel"
                id="invite-phone"
                maxLength={32}
                onChange={(event) => {
                  clearInviteFieldError("phone");
                  setInviteForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }));
                }}
                value={inviteForm.phone}
              />
              {inviteErrors.phone ? (
                <p className="text-xs text-destructive">
                  {inviteErrors.phone}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invite-password">Temporary password</Label>
              <Input
                aria-invalid={Boolean(inviteErrors.password)}
                autoComplete="new-password"
                id="invite-password"
                maxLength={128}
                minLength={6}
                onChange={(event) => {
                  clearInviteFieldError("password");
                  setInviteForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }));
                }}
                required
                type="password"
                value={inviteForm.password}
              />
              {inviteErrors.password ? (
                <p className="text-xs text-destructive">
                  {inviteErrors.password}
                </p>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="invite-role">Role</Label>
                <Select
                  onValueChange={(value) => {
                    clearInviteFieldError("roleCode");
                    setInviteForm((current) => ({
                      ...current,
                      roleCode: value as InviteSaasUserFormInput["roleCode"],
                    }));
                  }}
                  value={inviteForm.roleCode}
                >
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="support">Support</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
                {inviteErrors.roleCode ? (
                  <p className="text-xs text-destructive">
                    {inviteErrors.roleCode}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="invite-language">Language</Label>
                <Select
                  onValueChange={(value) => {
                    clearInviteFieldError("language");
                    setInviteForm((current) => ({
                      ...current,
                      language: value as InviteSaasUserFormInput["language"],
                    }));
                  }}
                  value={inviteForm.language}
                >
                  <SelectTrigger id="invite-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="zh-CN">Chinese</SelectItem>
                  </SelectContent>
                </Select>
                {inviteErrors.language ? (
                  <p className="text-xs text-destructive">
                    {inviteErrors.language}
                  </p>
                ) : null}
              </div>
            </div>
            {inviteFormError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {inviteFormError}
              </div>
            ) : null}
            <DialogFooter>
              <Button disabled={inviteSubmitting} type="submit">
                {inviteSubmitting ? "Sending invite" : "Invite member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingUser)}
        onOpenChange={(open) => {
          if (!open) {
            editRequestIdRef.current += 1;
            setEditingUser(null);
            setEditLoading(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit platform member</DialogTitle>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={handleEditSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="edit-display-name">Display name</Label>
              <Input
                disabled={editLoading}
                id="edit-display-name"
                onChange={(event) => {
                  setEditForm((current) => ({
                    ...current,
                    displayName: event.target.value,
                  }));
                }}
                value={editForm.displayName}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                disabled={editLoading}
                id="edit-email"
                onChange={(event) => {
                  setEditForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }));
                }}
                type="email"
                value={editForm.email}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                disabled={editLoading}
                id="edit-phone"
                onChange={(event) => {
                  setEditForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }));
                }}
                value={editForm.phone}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="edit-language">Language</Label>
                <Select
                  disabled={editLoading}
                  onValueChange={(value) => {
                    setEditForm((current) => ({
                      ...current,
                      language: value as UpdateSaasUserFormInput["language"],
                    }));
                  }}
                  value={editForm.language}
                >
                  <SelectTrigger id="edit-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="zh-CN">Chinese</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-timezone">Timezone</Label>
                <Input
                  disabled={editLoading}
                  id="edit-timezone"
                  onChange={(event) => {
                    setEditForm((current) => ({
                      ...current,
                      timezone: event.target.value,
                    }));
                  }}
                  value={editForm.timezone}
                />
              </div>
            </div>
            {formError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {formError}
              </div>
            ) : null}
            <DialogFooter>
              <Button disabled={editLoading || editSubmitting} type="submit">
                {editSubmitting ? "Saving" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
