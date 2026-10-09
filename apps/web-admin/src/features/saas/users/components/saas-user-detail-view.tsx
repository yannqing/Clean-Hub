"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
  toast,
} from "@cleanhub/ui";
import { Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { SaasBreadcrumbs } from "@/features/saas/shared";
import { useSaasI18n } from "@/i18n";

import { updateSaasUserStatusAction } from "../actions";
import type { SaasUserDirectoryDetail, SaasUserStatus } from "../types";
import {
  UserCredentialResetDialog,
  type UserCredentialResetTarget,
} from "./user-credential-reset-dialog";

type SaasUserDetailViewProps = {
  canManage: boolean;
  initialUser: SaasUserDirectoryDetail;
  isCurrentUser: boolean;
};

const maxStatusReasonLength = 300;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
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

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 border-b py-3 last:border-b-0 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-sm">{value}</dd>
    </div>
  );
}

export function SaasUserDetailView({
  canManage,
  initialUser,
  isCurrentUser,
}: SaasUserDetailViewProps) {
  const { m, formatDate } = useSaasI18n();
  const [user, setUser] = useState(initialUser);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusReason, setStatusReason] = useState("");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [resetTarget, setResetTarget] =
    useState<UserCredentialResetTarget | null>(null);
  const nextStatus = getNextStatus(user.status);
  const roles = user.roles.length > 0 ? user.roles : [user.role];
  const canRunSensitiveActions =
    canManage &&
    !isCurrentUser &&
    user.accountType === "saas" &&
    nextStatus !== null;

  function getRoleLabel(role: string): string {
    if (role === "support") {
      return m.common.roleLabels.support;
    }

    if (role === "super_admin") {
      return m.common.roleLabels.superAdmin;
    }

    if (role === "owner") return m.users.ownerRole;
    if (role === "manager") return m.users.managerRole;
    return role;
  }

  function getLanguageLabel(language: string): string {
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

  async function handleStatusChange() {
    if (!nextStatus || !canRunSensitiveActions || statusSubmitting) {
      return;
    }

    if (!statusReason.trim()) {
      setStatusError(m.users.status.reasonRequired);
      return;
    }

    setStatusSubmitting(true);
    setStatusError(null);

    try {
      const result = await updateSaasUserStatusAction(user.id, {
        reason: statusReason,
        status: nextStatus,
      });

      if (!result.ok) {
        setStatusError(result.errors.reason);
        return;
      }

      setUser((current) => ({ ...current, ...result.data }));
      setStatusOpen(false);
      setStatusReason("");
      toast.success(
        nextStatus === "disabled"
          ? m.users.status.disableSuccess
          : m.users.status.enableSuccess,
      );
    } catch (error) {
      const message = getErrorMessage(error) || m.users.loadError;
      setStatusError(message);
      toast.error(message);
    } finally {
      setStatusSubmitting(false);
    }
  }

  return (
    <section className="mx-auto min-h-[560px] w-full max-w-[960px] space-y-3 pb-20">
      <h1 className="sr-only">{m.users.detail.title}</h1>
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-3">
        <SaasBreadcrumbs
          ariaLabel={m.users.detail.title}
          className="flex-1"
          items={[{ label: user.displayName }]}
          rootHref={webAdminRoutes.saas.users}
          rootIcon={Users}
          rootLabel={m.users.title}
        />
        {canManage && user.accountType === "saas" ? (
          <Button asChild size="sm" variant="outline">
            <Link href={webAdminRoutes.saas.editUser(user.id)}>
              {m.users.actions.edit}
            </Link>
          </Button>
        ) : null}
      </div>

      {!canManage ? (
        <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
          {m.users.readOnlyHint}
        </div>
      ) : null}

      {isCurrentUser ? (
        <p className="text-sm text-muted-foreground">
          {m.users.detail.selfCredentialHint}{" "}
          <Link
            className="underline underline-offset-4"
            href={webAdminRoutes.saas.profile}
          >
            {m.users.detail.profileLink}
          </Link>
        </p>
      ) : null}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-5">
          <Card className="gap-0 rounded-lg py-0 shadow-none">
            <CardContent className="py-2">
              <h2 className="py-3 text-sm font-semibold">
                {m.users.detail.account}
              </h2>
              <dl>
                <DetailRow
                  label={m.users.invite.displayName}
                  value={user.displayName}
                />
                <DetailRow
                  label={m.users.invite.email}
                  value={user.email ?? m.users.detail.notProvided}
                />
                <DetailRow
                  label={m.users.invite.phone}
                  value={user.phone ?? m.users.detail.notProvided}
                />
                <DetailRow
                  label={m.users.columns.language}
                  value={getLanguageLabel(user.language)}
                />
                <DetailRow
                  label={m.users.edit.timezone}
                  value={user.timezone || m.users.detail.notProvided}
                />
                <DetailRow
                  label={m.users.accountTypeLabel}
                  value={
                    user.accountType === "saas"
                      ? m.users.platformAccount
                      : m.users.tenantAccount
                  }
                />
                {user.tenantId ? (
                  <DetailRow
                    label={m.users.tenantColumn}
                    value={
                      <Link
                        className="underline underline-offset-4"
                        href={webAdminRoutes.saas.tenant(user.tenantId)}
                      >
                        {user.tenantName} · {user.tenantCode}
                      </Link>
                    }
                  />
                ) : null}
                <DetailRow
                  label={m.users.detail.userId}
                  value={
                    <div className="grid gap-1">
                      <span className="break-all font-mono">{user.id}</span>
                      <p className="text-xs text-muted-foreground">
                        {m.users.detail.userIdHint}
                      </p>
                    </div>
                  }
                />
              </dl>
            </CardContent>
          </Card>

          <Card className="gap-0 rounded-lg py-0 shadow-none">
            <CardContent className="py-2">
              <h2 className="py-3 text-sm font-semibold">
                {m.users.detail.activity}
              </h2>
              <dl>
                <DetailRow
                  label={m.users.columns.lastLogin}
                  value={
                    user.lastLoginAt
                      ? formatDate(user.lastLoginAt)
                      : m.common.never
                  }
                />
                <DetailRow
                  label={m.users.columns.created}
                  value={formatDate(user.createdAt) || m.common.invalidDate}
                />
              </dl>
            </CardContent>
          </Card>
        </div>

        <aside className="grid gap-5">
          <Card className="gap-0 rounded-lg py-0 shadow-none">
            <CardContent className="grid gap-4 py-5">
              <div className="grid gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {m.common.status}
                </span>
                <Badge
                  className="w-fit"
                  variant={getStatusVariant(user.status)}
                >
                  {m.common.statusLabels[user.status]}
                </Badge>
              </div>

              <div className="grid gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {m.users.columns.roles}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {roles.map((role) => (
                    <Badge key={role} variant="outline">
                      {getRoleLabel(role)}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {canManage && !isCurrentUser ? (
            <Card className="gap-0 rounded-lg py-0 shadow-none">
              <CardContent className="grid gap-2 py-5">
                {nextStatus && user.accountType === "saas" ? (
                  <Button
                    onClick={() => {
                      setStatusReason(
                        nextStatus === "disabled"
                          ? m.users.status.disableConfirm
                          : m.users.status.enableConfirm,
                      );
                      setStatusError(null);
                      setStatusOpen(true);
                    }}
                    type="button"
                    variant={
                      nextStatus === "disabled" ? "destructive" : "default"
                    }
                  >
                    {nextStatus === "disabled"
                      ? m.users.actions.disable
                      : m.users.actions.enable}
                  </Button>
                ) : null}
                <Button
                  onClick={() =>
                    setResetTarget({
                      userId: user.id,
                      displayName: user.displayName,
                      credential: "password",
                    })
                  }
                  type="button"
                  variant="outline"
                >
                  {m.users.actions.resetPassword}
                </Button>
                <Button
                  onClick={() =>
                    setResetTarget({
                      userId: user.id,
                      displayName: user.displayName,
                      credential: "pin",
                    })
                  }
                  type="button"
                  variant="outline"
                >
                  {m.users.actions.resetPin}
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>

      <Dialog
        onOpenChange={(open) => {
          if (!statusSubmitting) {
            setStatusOpen(open);

            if (!open) {
              setStatusReason("");
              setStatusError(null);
            }
          }
        }}
        open={statusOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {nextStatus === "disabled"
                ? m.users.status.disableTitle
                : m.users.status.enableTitle}
            </DialogTitle>
            <DialogDescription>
              {nextStatus === "disabled"
                ? m.users.status.disableConfirm
                : m.users.status.enableConfirm}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="user-status-reason">{m.users.status.reason}</Label>
            <Textarea
              disabled={statusSubmitting}
              id="user-status-reason"
              maxLength={maxStatusReasonLength}
              onChange={(event) => {
                setStatusReason(event.target.value);
                setStatusError(null);
              }}
              rows={4}
              value={statusReason}
            />
            {statusError ? (
              <p className="text-xs text-destructive">{statusError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              disabled={statusSubmitting}
              onClick={() => setStatusOpen(false)}
              type="button"
              variant="outline"
            >
              {m.common.cancel}
            </Button>
            <Button
              disabled={statusSubmitting || !statusReason.trim()}
              onClick={() => void handleStatusChange()}
              type="button"
              variant={nextStatus === "disabled" ? "destructive" : "default"}
            >
              {statusSubmitting
                ? m.common.saving
                : nextStatus === "disabled"
                  ? m.users.actions.disable
                  : m.users.actions.enable}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {resetTarget ? (
        <UserCredentialResetDialog
          target={resetTarget}
          onClose={() => setResetTarget(null)}
          key={`${resetTarget.userId}-${resetTarget.credential}`}
        />
      ) : null}
    </section>
  );
}
