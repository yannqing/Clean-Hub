"use client";

import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@cleanhub/ui";
import { Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { SaasBreadcrumbs } from "@/features/saas/shared";
import { useSaasI18n } from "@/i18n";

import { updateSaasUserAction, updateSaasUserRolesAction } from "../actions";
import type {
  SaasRoleSummary,
  SaasUserDetail,
  SaasUserLanguage,
  SaasUserRoleCode,
} from "../types";
import type {
  UpdateSaasUserFormErrors,
  UpdateSaasUserFormInput,
} from "../validators";

type SaasUserEditViewProps = {
  canManage: boolean;
  initialUser: SaasUserDetail;
  roleLoadFailed: boolean;
  roles: SaasRoleSummary[];
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

function normalizeLanguage(language: string): SaasUserLanguage {
  if (language === "fr" || language === "zh-CN") {
    return language;
  }

  return "en";
}

function getInitialRoleCodes(user: SaasUserDetail): SaasUserRoleCode[] {
  const roleCodes = (user.roles.length > 0 ? user.roles : [user.role]).filter(
    (role): role is SaasUserRoleCode =>
      role === "support" || role === "super_admin",
  );

  return [...new Set(roleCodes)];
}

export function SaasUserEditView({
  canManage,
  initialUser,
  roleLoadFailed,
  roles,
}: SaasUserEditViewProps) {
  const { m } = useSaasI18n();
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [values, setValues] = useState<UpdateSaasUserFormInput>({
    displayName: initialUser.displayName,
    email: initialUser.email ?? "",
    language: normalizeLanguage(initialUser.language),
    phone: initialUser.phone ?? "",
    timezone: initialUser.timezone,
  });
  const [errors, setErrors] = useState<UpdateSaasUserFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<SaasUserRoleCode[]>(
    getInitialRoleCodes(initialUser),
  );
  const [roleError, setRoleError] = useState<string | null>(null);
  const [rolesSubmitting, setRolesSubmitting] = useState(false);
  const activeRoleCodes = useMemo<SaasUserRoleCode[]>(() => {
    const activeCodes = roles
      .filter((role) => role.status === "active")
      .map((role) => role.code)
      .filter(
        (role): role is SaasUserRoleCode =>
          role === "support" || role === "super_admin",
      );

    return activeCodes.length > 0
      ? [...new Set(activeCodes)].sort()
      : ["support", "super_admin"];
  }, [roles]);

  function getRoleLabel(role: SaasUserRoleCode): string {
    return role === "support"
      ? m.common.roleLabels.support
      : m.common.roleLabels.superAdmin;
  }

  function updateValue<Field extends keyof UpdateSaasUserFormInput>(
    field: Field,
    value: UpdateSaasUserFormInput[Field],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }

  function toggleRole(role: SaasUserRoleCode) {
    setRoleError(null);
    setSelectedRoles((current) =>
      current.includes(role)
        ? current.filter((currentRole) => currentRole !== role)
        : [...current, role],
    );
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManage || submitting) {
      return;
    }

    setSubmitting(true);
    setErrors({});
    setFormError(null);

    try {
      const result = await updateSaasUserAction(user.id, values);

      if (!result.ok) {
        setErrors(result.errors);
        setFormError(Object.values(result.errors)[0] ?? m.users.edit.failed);
        return;
      }

      setUser(result.data);
      toast.success(m.users.edit.success);
      router.refresh();
    } catch (error) {
      const message = getErrorMessage(error) || m.users.edit.failed;
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRolesSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManage || rolesSubmitting) {
      return;
    }

    setRolesSubmitting(true);
    setRoleError(null);

    try {
      const result = await updateSaasUserRolesAction(user.id, {
        roleCodes: selectedRoles,
      });

      if (!result.ok) {
        setRoleError(result.errors.roleCodes ?? m.users.roles.failed);
        return;
      }

      setUser(result.data);
      setSelectedRoles(getInitialRoleCodes(result.data));
      toast.success(m.users.roles.success);
      router.refresh();
    } catch (error) {
      const message = getErrorMessage(error) || m.users.roles.failed;
      setRoleError(message);
      toast.error(message);
    } finally {
      setRolesSubmitting(false);
    }
  }

  return (
    <section className="mx-auto min-h-[560px] w-full max-w-[960px] space-y-3 pb-20">
      <h1 className="sr-only">{m.users.edit.title}</h1>
      <SaasBreadcrumbs
        ariaLabel={m.users.edit.title}
        items={[
          {
            href: webAdminRoutes.saas.user(user.id),
            label: user.displayName,
          },
          { label: m.users.actions.edit },
        ]}
        rootHref={webAdminRoutes.saas.users}
        rootIcon={Users}
        rootLabel={m.users.title}
      />

      {!canManage ? (
        <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
          {m.users.readOnlyHint}
        </div>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <form className="grid gap-3" noValidate onSubmit={handleProfileSubmit}>
          <Card className="gap-0 rounded-lg py-0 shadow-none">
            <CardContent className="grid gap-4 py-5">
              <h2 className="text-sm font-semibold">
                {m.users.detail.account}
              </h2>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="edit-user-display-name">
                    {m.users.invite.displayName}
                  </Label>
                  <Input
                    aria-invalid={Boolean(errors.displayName)}
                    disabled={!canManage || submitting}
                    id="edit-user-display-name"
                    maxLength={120}
                    onChange={(event) =>
                      updateValue("displayName", event.target.value)
                    }
                    required
                    value={values.displayName}
                  />
                  {errors.displayName ? (
                    <p className="text-xs text-destructive">
                      {errors.displayName}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-user-email">
                    {m.users.invite.email}
                  </Label>
                  <Input
                    aria-invalid={Boolean(errors.email)}
                    autoComplete="email"
                    disabled={!canManage || submitting}
                    id="edit-user-email"
                    maxLength={320}
                    onChange={(event) =>
                      updateValue("email", event.target.value)
                    }
                    required
                    type="email"
                    value={values.email}
                  />
                  {errors.email ? (
                    <p className="text-xs text-destructive">{errors.email}</p>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-user-phone">
                    {m.users.invite.phone}
                  </Label>
                  <Input
                    aria-invalid={Boolean(errors.phone)}
                    autoComplete="tel"
                    disabled={!canManage || submitting}
                    id="edit-user-phone"
                    maxLength={32}
                    onChange={(event) =>
                      updateValue("phone", event.target.value)
                    }
                    value={values.phone}
                  />
                  {errors.phone ? (
                    <p className="text-xs text-destructive">{errors.phone}</p>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-user-language">
                    {m.users.invite.language}
                  </Label>
                  <Select
                    disabled={!canManage || submitting}
                    onValueChange={(value) =>
                      updateValue(
                        "language",
                        value as UpdateSaasUserFormInput["language"],
                      )
                    }
                    value={values.language}
                  >
                    <SelectTrigger className="w-full" id="edit-user-language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">
                        {m.common.languageLabels.en}
                      </SelectItem>
                      <SelectItem value="fr">
                        {m.common.languageLabels.fr}
                      </SelectItem>
                      <SelectItem value="zh-CN">
                        {m.common.languageLabels.zhCN}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.language ? (
                    <p className="text-xs text-destructive">
                      {errors.language}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-user-timezone">
                    {m.users.edit.timezone}
                  </Label>
                  <Input
                    aria-invalid={Boolean(errors.timezone)}
                    disabled={!canManage || submitting}
                    id="edit-user-timezone"
                    maxLength={64}
                    onChange={(event) =>
                      updateValue("timezone", event.target.value)
                    }
                    required
                    value={values.timezone}
                  />
                  {errors.timezone ? (
                    <p className="text-xs text-destructive">
                      {errors.timezone}
                    </p>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          {formError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {formError}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button asChild type="button" variant="outline">
              <Link href={webAdminRoutes.saas.user(user.id)}>
                {m.common.cancel}
              </Link>
            </Button>
            <Button disabled={!canManage || submitting} type="submit">
              {submitting ? m.common.saving : m.common.saveChanges}
            </Button>
          </div>
        </form>

        <aside>
          <form noValidate onSubmit={handleRolesSubmit}>
            <Card className="gap-0 rounded-lg py-0 shadow-none">
              <CardContent className="grid gap-4 py-5">
                <h2 className="text-sm font-semibold">{m.users.roles.title}</h2>

                <div className="grid gap-2">
                  {activeRoleCodes.map((role) => (
                    <label
                      className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
                      key={role}
                    >
                      <input
                        checked={selectedRoles.includes(role)}
                        className="size-4"
                        disabled={!canManage || rolesSubmitting}
                        onChange={() => toggleRole(role)}
                        type="checkbox"
                      />
                      <span>{getRoleLabel(role)}</span>
                    </label>
                  ))}
                </div>

                {roleLoadFailed ? (
                  <p className="text-xs text-amber-700">
                    {m.users.roles.fallbackHint}
                  </p>
                ) : null}
                {roleError ? (
                  <p className="text-xs text-destructive">{roleError}</p>
                ) : null}

                <Button
                  disabled={
                    !canManage || rolesSubmitting || selectedRoles.length === 0
                  }
                  type="submit"
                >
                  {rolesSubmitting ? m.common.saving : m.users.roles.submit}
                </Button>
              </CardContent>
            </Card>
          </form>
        </aside>
      </div>
    </section>
  );
}
