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
  Textarea,
} from "@cleanhub/ui";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useSaasI18n } from "@/i18n";
import { interpolate } from "@/i18n/messages/saas";

import {
  inviteSaasUserAction,
  updateSaasUserAction,
  updateSaasUserRolesAction,
  updateSaasUserStatusAction,
} from "../actions";
import {
  saasUserStatusOptions,
} from "../constants";
import {
  getCurrentSaasAuthQuery,
  getSaasRoleListQuery,
  getSaasUserDetailQuery,
  getSaasUserListQuery,
} from "../queries";
import type {
  AuthContext,
  SaasRoleSummary,
  SaasUserRoleCode,
  SaasUserStatus,
  SaasUserStatusCounts,
  SaasUserSummary,
} from "../types";
import type {
  InviteSaasUserFormErrors,
  InviteSaasUserFormInput,
  UpdateSaasUserFormErrors,
  UpdateSaasUserFormInput,
  UpdateSaasUserRolesFormInput,
} from "../validators";

type StatusFilter = "all" | SaasUserStatus;
type InviteSaasUserField = keyof InviteSaasUserFormInput;
type UpdateSaasUserField = keyof UpdateSaasUserFormInput;

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

const defaultRoleForm: UpdateSaasUserRolesFormInput = {
  roleCodes: [],
};

const maxStatusReasonLength = 300;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

function formatDate(
  value: string | null,
  m: ReturnType<typeof useSaasI18n>["m"],
  formatDateFn: ReturnType<typeof useSaasI18n>["formatDate"],
): string {
  if (!value) {
    return m.common.never;
  }

  return formatDateFn(value) || m.common.invalidDate;
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

function getRoleLabel(role: string, m: ReturnType<typeof useSaasI18n>["m"]): string {
  if (role === "support") {
    return m.common.roleLabels.support;
  }
  if (role === "super_admin") {
    return m.common.roleLabels.superAdmin;
  }
  return role;
}

function getLanguageLabel(
  language: string,
  m: ReturnType<typeof useSaasI18n>["m"],
): string {
  if (language === "en") {
    return m.common.languageLabels.en;
  }
  if (language === "fr") {
    return m.common.languageLabels.fr;
  }
  if (language === "zh-CN") {
    return m.common.languageLabels.zhCN;
  }
  return language;
}

function canChangeStatus(status: SaasUserStatus): boolean {
  return status === "active" || status === "disabled";
}

function getStatusActionLabel(
  status: SaasUserStatus,
  m: ReturnType<typeof useSaasI18n>["m"],
): string {
  if (status === "active") {
    return m.users.actions.disable;
  }

  if (status === "disabled") {
    return m.users.actions.enable;
  }

  return m.users.status.noAction;
}

function getNextStatus(
  status: SaasUserStatus,
): Extract<SaasUserStatus, "active" | "disabled"> | null {
  if (status === "active") {
    return "disabled";
  }

  if (status === "disabled") {
    return "active";
  }

  return null;
}

function getDefaultStatusReason(
  user: SaasUserSummary,
  m: ReturnType<typeof useSaasI18n>["m"],
): string {
  const nextStatus = getNextStatus(user.status);

  if (nextStatus === "disabled") {
    return interpolate(m.users.status.disableConfirm, {});
  }

  if (nextStatus === "active") {
    return interpolate(m.users.status.enableConfirm, {});
  }

  return "";
}

export function SaasUserListView() {
  const { m, formatDate: formatSaasDate } = useSaasI18n();
  const editRequestIdRef = useRef(0);
  const [users, setUsers] = useState<SaasUserSummary[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [metrics, setMetrics] = useState<SaasUserMetrics>(emptyMetrics);
  const [authContext, setAuthContext] = useState<AuthContext | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [roles, setRoles] = useState<SaasRoleSummary[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
  const [editErrors, setEditErrors] = useState<UpdateSaasUserFormErrors>({});
  const [editLoading, setEditLoading] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [roleEditingUser, setRoleEditingUser] =
    useState<SaasUserSummary | null>(null);
  const [roleForm, setRoleForm] =
    useState<UpdateSaasUserRolesFormInput>(defaultRoleForm);
  const [roleFormError, setRoleFormError] = useState<string | null>(null);
  const [roleSubmitting, setRoleSubmitting] = useState(false);
  const [pendingStatusUser, setPendingStatusUser] =
    useState<SaasUserSummary | null>(null);
  const [statusReason, setStatusReason] = useState("");
  const [statusFormError, setStatusFormError] = useState<string | null>(null);
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

  const isSuperAdmin = authContext?.role === "super_admin";
  const canManageMembers = isSuperAdmin && !authError;
  const activeRoleCodes = useMemo<SaasUserRoleCode[]>(() => {
    const loadedRoleCodes = roles
      .filter((role) => role.status === "active")
      .map((role) => role.code)
      .filter(
        (roleCode): roleCode is SaasUserRoleCode =>
          roleCode === "support" || roleCode === "super_admin",
      );

    return loadedRoleCodes.length > 0
      ? [...new Set(loadedRoleCodes)].sort()
      : ["super_admin", "support"];
  }, [roles]);

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
      setError(getErrorMessage(loadError) || m.users.loadError);
    } finally {
      setLoading(false);
    }
  }, [listQuery]);

  useEffect(() => {
    let isCurrent = true;

    Promise.allSettled([getCurrentSaasAuthQuery(), getSaasRoleListQuery()])
      .then(([authResult, rolesResult]) => {
        if (!isCurrent) {
          return;
        }

        if (authResult.status === "fulfilled") {
          setAuthContext(authResult.value);
          setAuthError(null);
        } else {
          setAuthError(getErrorMessage(authResult.reason) || m.users.loadError);
        }

        if (rolesResult.status === "fulfilled") {
          setRoles(rolesResult.value);
          setRolesError(null);
        } else {
          setRoles([]);
          setRolesError(getErrorMessage(rolesResult.reason) || m.users.loadError);
        }
      })
      .finally(() => {
        if (isCurrent) {
          setRolesLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const clearInviteFieldError = useCallback((field: InviteSaasUserField) => {
    setInviteErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
    setInviteFormError(null);
  }, []);

  const openInviteForm = useCallback(() => {
    if (!canManageMembers) {
      return;
    }

    setInviteForm(defaultInviteForm);
    setInviteErrors({});
    setInviteFormError(null);
    setNotice(null);
    setInviteOpen(true);
  }, [canManageMembers]);

  const clearEditFieldError = useCallback((field: UpdateSaasUserField) => {
    setEditErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
    setFormError(null);
  }, []);

  const openStatusDialog = useCallback((user: SaasUserSummary) => {
    if (
      !canManageMembers ||
      authContext?.userId === user.id ||
      !canChangeStatus(user.status)
    ) {
      return;
    }

    setPendingStatusUser(user);
    setStatusReason(getDefaultStatusReason(user, m));
    setStatusFormError(null);
    setError(null);
    setNotice(null);
  }, [authContext?.userId, canManageMembers, m]);

  const openRoleForm = useCallback(
    (user: SaasUserSummary) => {
      if (!canManageMembers) {
        return;
      }

      const roleCodes = user.roles.filter(
        (role): role is SaasUserRoleCode =>
          role === "support" || role === "super_admin",
      );

      setRoleEditingUser(user);
      setRoleForm({
        roleCodes,
      });
      setRoleFormError(null);
      setNotice(null);
    },
    [canManageMembers],
  );

  const toggleRoleCode = useCallback((roleCode: SaasUserRoleCode) => {
    setRoleFormError(null);
    setRoleForm((current) => ({
      roleCodes: current.roleCodes.includes(roleCode)
        ? current.roleCodes.filter((currentRole) => currentRole !== roleCode)
        : [...current.roleCodes, roleCode],
    }));
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
          setError(getErrorMessage(loadError) || m.users.loadError);
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
  }, [listQuery, m.users.loadError]);

  const handleStatusChange = useCallback(
    async () => {
      if (!pendingStatusUser) {
        return;
      }

      const nextStatus = getNextStatus(pendingStatusUser.status);

      if (!nextStatus) {
        setStatusFormError(m.users.status.noAction);
        return;
      }

      const reason = statusReason.trim();

      if (!reason) {
        setStatusFormError(m.users.status.reasonRequired);
        return;
      }

      setStatusUpdatingUserId(pendingStatusUser.id);
      setStatusFormError(null);
      setError(null);
      setNotice(null);

      try {
        const result = await updateSaasUserStatusAction(pendingStatusUser.id, {
          status: nextStatus,
          reason,
        });

        if (!result.ok) {
          setStatusFormError(result.errors.reason);
          return;
        }

        setNotice(
          nextStatus === "disabled"
            ? m.users.status.disableSuccess
            : m.users.status.enableSuccess,
        );
        setPendingStatusUser(null);
        setStatusReason("");
        await loadUsers();
      } catch (updateError) {
        setStatusFormError(getErrorMessage(updateError) || m.users.loadError);
      } finally {
        setStatusUpdatingUserId(null);
      }
    },
    [loadUsers, m.users.loadError, m.users.status, pendingStatusUser, statusReason],
  );

  const openEditForm = useCallback((user: SaasUserSummary) => {
    if (!canManageMembers) {
      return;
    }

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
    setEditErrors({});
    setNotice(null);

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

        setFormError(getErrorMessage(detailError) || m.users.loadError);
      })
      .finally(() => {
        if (editRequestIdRef.current !== requestId) {
          return;
        }

        setEditLoading(false);
      });
  }, [canManageMembers, m.users.loadError]);

  const handleInviteSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setInviteSubmitting(true);
      setInviteErrors({});
      setInviteFormError(null);
      setNotice(null);

      try {
        const result = await inviteSaasUserAction(inviteForm);

        if (!result.ok) {
          setInviteErrors(result.errors);
          setInviteFormError(
            Object.values(result.errors)[0] ?? m.users.invite.failed,
          );
          return;
        }

        setInviteForm(defaultInviteForm);
        setInviteOpen(false);
        setNotice(m.users.invite.success);
        await loadUsers();
      } catch (submitError) {
        setInviteFormError(getErrorMessage(submitError) || m.users.invite.failed);
      } finally {
        setInviteSubmitting(false);
      }
    },
    [inviteForm, loadUsers, m.users.invite.failed, m.users.invite.success],
  );

  const handleEditSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!editingUser) {
        return;
      }

      if (editLoading || editSubmitting) {
        return;
      }

      setEditSubmitting(true);
      setFormError(null);
      setEditErrors({});
      setNotice(null);

      try {
        const result = await updateSaasUserAction(editingUser.id, editForm);

        if (!result.ok) {
          setEditErrors(result.errors);
          setFormError(Object.values(result.errors)[0] ?? m.users.edit.failed);
          return;
        }

        setEditingUser(null);
        setEditErrors({});
        setNotice(m.users.edit.success);
        await loadUsers();
      } catch (submitError) {
        setFormError(getErrorMessage(submitError) || m.users.edit.failed);
      } finally {
        setEditSubmitting(false);
      }
    },
    [
      editForm,
      editLoading,
      editingUser,
      editSubmitting,
      loadUsers,
      m.users.edit.failed,
      m.users.edit.success,
    ],
  );

  const handleRoleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!roleEditingUser || roleSubmitting) {
        return;
      }

      setRoleSubmitting(true);
      setRoleFormError(null);
      setNotice(null);

      try {
        const result = await updateSaasUserRolesAction(
          roleEditingUser.id,
          roleForm,
        );

        if (!result.ok) {
          setRoleFormError(
            result.errors.roleCodes ?? m.users.roles.failed,
          );
          return;
        }

        setRoleEditingUser(null);
        setRoleForm(defaultRoleForm);
        setNotice(m.users.roles.success);
        await loadUsers();
      } catch (submitError) {
        setRoleFormError(getErrorMessage(submitError) || m.users.roles.failed);
      } finally {
        setRoleSubmitting(false);
      }
    },
    [
      loadUsers,
      m.users.roles.failed,
      m.users.roles.success,
      roleEditingUser,
      roleForm,
      roleSubmitting,
    ],
  );

  return (
    <section className="min-h-[560px]">
      <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">{m.users.badge}</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            {m.users.title}
          </h1>
        </div>

        <div className="flex gap-2">
          <Button
            disabled={!canManageMembers}
            onClick={openInviteForm}
            type="button"
          >
            {m.users.inviteMember}
          </Button>
          <Button onClick={loadUsers} type="button" variant="outline">
            {m.common.refresh}
          </Button>
        </div>
      </div>

      {notice ? (
        <div className="border-b p-5">
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700">
            {notice}
          </div>
        </div>
      ) : null}

      {authError || rolesError ? (
        <div className="border-b p-5">
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-800">
            {authError
              ? `Member management is read-only because the current session could not be verified: ${authError}`
              : interpolate(m.users.roleRefreshError, { error: rolesError ?? "" })}
          </div>
        </div>
      ) : null}

      {!authError && authContext && !isSuperAdmin ? (
        <div className="border-b p-5">
          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            {m.users.readOnlyHint}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 border-b p-5 sm:grid-cols-2 lg:grid-cols-5">
        {[
          [m.users.metrics.total, metrics.total],
          [m.users.metrics.active, metrics.active],
          [m.users.metrics.invited, metrics.invited],
          [m.users.metrics.disabled, metrics.disabled],
          [m.users.metrics.suspended, metrics.suspended],
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
          <Label htmlFor="saas-user-search">{m.common.search}</Label>
          <Input
            id="saas-user-search"
            onChange={(event) => {
              setLoading(true);
              setQuery(event.target.value);
            }}
            placeholder={m.users.searchPlaceholder}
            value={query}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="saas-user-status-filter">{m.common.status}</Label>
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
              <SelectItem value="all">{m.common.allStatuses}</SelectItem>
              {saasUserStatusOptions.map((option) => {
                const label =
                  option.value === "active"
                    ? m.common.statusLabels.active
                    : option.value === "invited"
                      ? m.common.statusLabels.invited
                      : option.value === "disabled"
                        ? m.common.statusLabels.disabled
                        : m.common.statusLabels.suspended;
                return (
                  <SelectItem key={option.value} value={option.value}>
                    {label}
                  </SelectItem>
                );
              })}
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
              {m.users.emptyTitle}
            </h2>
          </div>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{m.users.columns.member}</TableHead>
              <TableHead>{m.users.columns.roles}</TableHead>
              <TableHead>{m.common.status}</TableHead>
              <TableHead>{m.users.columns.language}</TableHead>
              <TableHead>{m.users.columns.lastLogin}</TableHead>
              <TableHead>{m.users.columns.created}</TableHead>
              <TableHead className="text-right">{m.common.actions}</TableHead>
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
                          {getRoleLabel(role, m)}
                        </Badge>
                      ),
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(user.status)}>
                    {m.common.statusLabels[user.status]}
                  </Badge>
                </TableCell>
                <TableCell>{getLanguageLabel(user.language, m)}</TableCell>
                <TableCell>{formatDate(user.lastLoginAt, m, formatSaasDate)}</TableCell>
                <TableCell>{formatDate(user.createdAt, m, formatSaasDate)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      disabled={!canManageMembers}
                      onClick={() => {
                        openEditForm(user);
                      }}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {m.users.actions.edit}
                    </Button>
                    <Button
                      disabled={!canManageMembers || rolesLoading}
                      onClick={() => {
                        openRoleForm(user);
                      }}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {m.users.actions.roles}
                    </Button>
                    <Button
                      disabled={
                        !canManageMembers ||
                        authContext?.userId === user.id ||
                        statusUpdatingUserId === user.id ||
                        !canChangeStatus(user.status)
                      }
                      onClick={() => {
                        openStatusDialog(user);
                      }}
                      size="sm"
                      type="button"
                      variant={user.status === "active" ? "outline" : "default"}
                    >
                      {getStatusActionLabel(user.status, m)}
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
            <DialogTitle>{m.users.invite.title}</DialogTitle>
            <DialogDescription className="sr-only">
              {m.users.invite.description}
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" noValidate onSubmit={handleInviteSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="invite-display-name">{m.users.invite.displayName}</Label>
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
              <Label htmlFor="invite-email">{m.users.invite.email}</Label>
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
              <Label htmlFor="invite-phone">{m.users.invite.phone}</Label>
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
              <Label htmlFor="invite-password">
                {m.users.invite.temporaryPassword}
              </Label>
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
                <Label htmlFor="invite-role">{m.users.invite.role}</Label>
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
                    <SelectItem value="support">{m.common.roleLabels.support}</SelectItem>
                    <SelectItem value="super_admin">
                      {m.common.roleLabels.superAdmin}
                    </SelectItem>
                  </SelectContent>
                </Select>
                {inviteErrors.roleCode ? (
                  <p className="text-xs text-destructive">
                    {inviteErrors.roleCode}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="invite-language">{m.users.invite.language}</Label>
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
                    <SelectItem value="en">{m.common.languageLabels.en}</SelectItem>
                    <SelectItem value="fr">{m.common.languageLabels.fr}</SelectItem>
                    <SelectItem value="zh-CN">{m.common.languageLabels.zhCN}</SelectItem>
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
                {inviteSubmitting ? m.users.invite.sending : m.users.invite.submit}
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
            setEditErrors({});
            setFormError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m.users.edit.title}</DialogTitle>
            <DialogDescription className="sr-only">
              {m.users.edit.description}
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" noValidate onSubmit={handleEditSubmit}>
            {editingUser ? (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="font-medium">{editingUser.displayName}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(editingUser.roles.length > 0
                    ? editingUser.roles
                    : [editingUser.role]
                  ).map((role) => (
                    <Badge key={role} variant="outline">
                      {getRoleLabel(role, m)}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="edit-display-name">{m.users.invite.displayName}</Label>
              <Input
                aria-invalid={Boolean(editErrors.displayName)}
                disabled={editLoading}
                id="edit-display-name"
                maxLength={120}
                onChange={(event) => {
                  clearEditFieldError("displayName");
                  setEditForm((current) => ({
                    ...current,
                    displayName: event.target.value,
                  }));
                }}
                required
                value={editForm.displayName}
              />
              {editErrors.displayName ? (
                <p className="text-xs text-destructive">
                  {editErrors.displayName}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-email">{m.users.invite.email}</Label>
              <Input
                aria-invalid={Boolean(editErrors.email)}
                autoComplete="email"
                disabled={editLoading}
                id="edit-email"
                maxLength={320}
                onChange={(event) => {
                  clearEditFieldError("email");
                  setEditForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }));
                }}
                required
                type="email"
                value={editForm.email}
              />
              {editErrors.email ? (
                <p className="text-xs text-destructive">{editErrors.email}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-phone">{m.users.invite.phone}</Label>
              <Input
                aria-invalid={Boolean(editErrors.phone)}
                autoComplete="tel"
                disabled={editLoading}
                id="edit-phone"
                maxLength={32}
                onChange={(event) => {
                  clearEditFieldError("phone");
                  setEditForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }));
                }}
                value={editForm.phone}
              />
              {editErrors.phone ? (
                <p className="text-xs text-destructive">{editErrors.phone}</p>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="edit-language">{m.users.invite.language}</Label>
                <Select
                  disabled={editLoading}
                  onValueChange={(value) => {
                    clearEditFieldError("language");
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
                    <SelectItem value="en">{m.common.languageLabels.en}</SelectItem>
                    <SelectItem value="fr">{m.common.languageLabels.fr}</SelectItem>
                    <SelectItem value="zh-CN">{m.common.languageLabels.zhCN}</SelectItem>
                  </SelectContent>
                </Select>
                {editErrors.language ? (
                  <p className="text-xs text-destructive">
                    {editErrors.language}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-timezone">{m.users.edit.timezone}</Label>
                <Input
                  aria-invalid={Boolean(editErrors.timezone)}
                  disabled={editLoading}
                  id="edit-timezone"
                  maxLength={64}
                  onChange={(event) => {
                    clearEditFieldError("timezone");
                    setEditForm((current) => ({
                      ...current,
                      timezone: event.target.value,
                    }));
                  }}
                  required
                  value={editForm.timezone}
                />
                {editErrors.timezone ? (
                  <p className="text-xs text-destructive">
                    {editErrors.timezone}
                  </p>
                ) : null}
              </div>
            </div>
            {formError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {formError}
              </div>
            ) : null}
            <DialogFooter>
              <Button
                disabled={editSubmitting}
                onClick={() => {
                  editRequestIdRef.current += 1;
                  setEditingUser(null);
                  setEditLoading(false);
                  setEditErrors({});
                  setFormError(null);
                }}
                type="button"
                variant="outline"
              >
                {m.common.cancel}
              </Button>
              <Button disabled={editLoading || editSubmitting} type="submit">
                {editSubmitting ? m.common.saving : m.common.saveChanges}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(roleEditingUser)}
        onOpenChange={(open) => {
          if (!open && !roleSubmitting) {
            setRoleEditingUser(null);
            setRoleForm(defaultRoleForm);
            setRoleFormError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m.users.roles.title}</DialogTitle>
            <DialogDescription className="sr-only">
              {m.users.roles.description}
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" noValidate onSubmit={handleRoleSubmit}>
            {roleEditingUser ? (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="font-medium">{roleEditingUser.displayName}</div>
                <div className="text-muted-foreground">
                  {roleEditingUser.email ??
                    roleEditingUser.phone ??
                    roleEditingUser.id}
                </div>
              </div>
            ) : null}

            <div className="grid gap-3">
              <Label>{m.users.columns.roles}</Label>
              <div className="grid gap-2">
                {activeRoleCodes.map((roleCode) => (
                  <label
                    className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
                    key={roleCode}
                  >
                    <input
                      checked={roleForm.roleCodes.includes(roleCode)}
                      className="size-4"
                      disabled={roleSubmitting || rolesLoading}
                      onChange={() => {
                        toggleRoleCode(roleCode);
                      }}
                      type="checkbox"
                    />
                    <span>{getRoleLabel(roleCode, m)}</span>
                  </label>
                ))}
              </div>
              {rolesError ? (
                <p className="text-xs text-amber-700">
                  {m.users.roles.fallbackHint}
                </p>
              ) : null}
            </div>

            {roleFormError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {roleFormError}
              </div>
            ) : null}

            <DialogFooter>
              <Button
                disabled={roleSubmitting}
                onClick={() => {
                  setRoleEditingUser(null);
                  setRoleForm(defaultRoleForm);
                  setRoleFormError(null);
                }}
                type="button"
                variant="outline"
              >
                {m.common.cancel}
              </Button>
              <Button
                disabled={
                  roleSubmitting ||
                  rolesLoading ||
                  roleForm.roleCodes.length === 0
                }
                type="submit"
              >
                {roleSubmitting ? m.common.saving : m.users.roles.submit}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pendingStatusUser)}
        onOpenChange={(open) => {
          if (!open && !statusUpdatingUserId) {
            setPendingStatusUser(null);
            setStatusReason("");
            setStatusFormError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingStatusUser?.status === "active"
                ? m.users.status.disableTitle
                : m.users.status.enableTitle}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {pendingStatusUser?.status === "active"
                ? m.users.status.disableConfirm
                : m.users.status.enableConfirm}
            </DialogDescription>
          </DialogHeader>

          {pendingStatusUser ? (
            <div className="grid gap-4">
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="font-medium">
                  {pendingStatusUser.displayName}
                </div>
                <div className="text-muted-foreground">
                  {pendingStatusUser.email ??
                    pendingStatusUser.phone ??
                    pendingStatusUser.id}
                </div>
                <div className="mt-2">
                  <Badge variant={getStatusVariant(pendingStatusUser.status)}>
                    {m.common.statusLabels[pendingStatusUser.status]}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="status-reason">{m.users.status.reason}</Label>
                <Textarea
                  disabled={Boolean(statusUpdatingUserId)}
                  id="status-reason"
                  maxLength={maxStatusReasonLength}
                  onChange={(event) => {
                    setStatusReason(event.target.value);
                    setStatusFormError(null);
                  }}
                  required
                  rows={4}
                  value={statusReason}
                />
              </div>

              {statusFormError ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {statusFormError}
                </div>
              ) : null}

              <DialogFooter>
                <Button
                  disabled={Boolean(statusUpdatingUserId)}
                  onClick={() => {
                    setPendingStatusUser(null);
                    setStatusReason("");
                    setStatusFormError(null);
                  }}
                  type="button"
                  variant="outline"
                >
                  {m.common.cancel}
                </Button>
                <Button
                  disabled={
                    Boolean(statusUpdatingUserId) || !statusReason.trim()
                  }
                  onClick={() => void handleStatusChange()}
                  type="button"
                  variant={
                    pendingStatusUser.status === "active"
                      ? "destructive"
                      : "default"
                  }
                >
                  {statusUpdatingUserId
                    ? m.common.saving
                    : getStatusActionLabel(pendingStatusUser.status, m)}
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
