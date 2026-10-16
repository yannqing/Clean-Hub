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

import { inviteSaasUserAction } from "../actions";
import type { SaasRoleSummary, SaasUserRoleCode } from "../types";
import type {
  InviteSaasUserFormErrors,
  InviteSaasUserFormInput,
} from "../validators";

type SaasUserCreateViewProps = {
  canManage: boolean;
  roleLoadFailed: boolean;
  roles: SaasRoleSummary[];
};

const initialValues: InviteSaasUserFormInput = {
  displayName: "",
  email: "",
  language: "en",
  password: "",
  phone: "",
  roleCode: "support",
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

export function SaasUserCreateView({
  canManage,
  roleLoadFailed,
  roles,
}: SaasUserCreateViewProps) {
  const { m } = useSaasI18n();
  const router = useRouter();
  const [values, setValues] = useState<InviteSaasUserFormInput>(initialValues);
  const [errors, setErrors] = useState<InviteSaasUserFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const roleCodes = useMemo<SaasUserRoleCode[]>(() => {
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

  function updateValue<Field extends keyof InviteSaasUserFormInput>(
    field: Field,
    value: InviteSaasUserFormInput[Field],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManage || submitting) {
      return;
    }

    setSubmitting(true);
    setErrors({});
    setFormError(null);

    try {
      const result = await inviteSaasUserAction(values);

      if (!result.ok) {
        setErrors(result.errors);
        setFormError(Object.values(result.errors)[0] ?? m.users.invite.failed);
        return;
      }

      toast.success(m.users.invite.success);
      router.push(webAdminRoutes.saas.user(result.data.id));
      router.refresh();
    } catch (error) {
      const message = getErrorMessage(error) || m.users.invite.failed;
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto min-h-[560px] w-full max-w-[960px] space-y-3 pb-20">
      <h1 className="sr-only">{m.users.invite.title}</h1>
      <SaasBreadcrumbs
        ariaLabel={m.users.invite.title}
        items={[{ label: m.users.invite.title }]}
        rootHref={webAdminRoutes.saas.users}
        rootIcon={Users}
        rootLabel={m.users.title}
      />

      {!canManage ? (
        <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
          {m.users.readOnlyHint}
        </div>
      ) : null}

      <form className="grid gap-5" noValidate onSubmit={handleSubmit}>
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <Card className="gap-0 rounded-lg py-0 shadow-none">
            <CardContent className="grid gap-4 py-5">
              <h2 className="text-sm font-semibold">
                {m.users.detail.account}
              </h2>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="create-user-display-name">
                    {m.users.invite.displayName}
                  </Label>
                  <Input
                    aria-invalid={Boolean(errors.displayName)}
                    disabled={!canManage || submitting}
                    id="create-user-display-name"
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
                  <Label htmlFor="create-user-email">
                    {m.users.invite.email}
                  </Label>
                  <Input
                    aria-invalid={Boolean(errors.email)}
                    autoComplete="email"
                    disabled={!canManage || submitting}
                    id="create-user-email"
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
                  <Label htmlFor="create-user-phone">
                    {m.users.invite.phone}
                  </Label>
                  <Input
                    aria-invalid={Boolean(errors.phone)}
                    autoComplete="tel"
                    disabled={!canManage || submitting}
                    id="create-user-phone"
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

                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="create-user-password">
                    {m.users.invite.temporaryPassword}
                  </Label>
                  <Input
                    aria-invalid={Boolean(errors.password)}
                    autoComplete="new-password"
                    disabled={!canManage || submitting}
                    id="create-user-password"
                    onChange={(event) =>
                      updateValue("password", event.target.value)
                    }
                    required
                    type="password"
                    value={values.password}
                  />
                  {errors.password ? (
                    <p className="text-xs text-destructive">
                      {errors.password}
                    </p>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <aside className="grid gap-5">
            <Card className="gap-0 rounded-lg py-0 shadow-none">
              <CardContent className="grid gap-4 py-5">
                <h2 className="text-sm font-semibold">
                  {m.users.columns.roles}
                </h2>

                <div className="grid gap-2">
                  <Label htmlFor="create-user-role">
                    {m.users.invite.role}
                  </Label>
                  <Select
                    disabled={!canManage || submitting}
                    onValueChange={(value) =>
                      updateValue(
                        "roleCode",
                        value as InviteSaasUserFormInput["roleCode"],
                      )
                    }
                    value={values.roleCode}
                  >
                    <SelectTrigger className="w-full" id="create-user-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roleCodes.map((roleCode) => (
                        <SelectItem key={roleCode} value={roleCode}>
                          {roleCode === "support"
                            ? m.common.roleLabels.support
                            : m.common.roleLabels.superAdmin}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.roleCode ? (
                    <p className="text-xs text-destructive">
                      {errors.roleCode}
                    </p>
                  ) : null}
                  {roleLoadFailed ? (
                    <p className="text-xs text-amber-700">
                      {m.users.roles.fallbackHint}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="create-user-language">
                    {m.users.invite.language}
                  </Label>
                  <Select
                    disabled={!canManage || submitting}
                    onValueChange={(value) =>
                      updateValue(
                        "language",
                        value as InviteSaasUserFormInput["language"],
                      )
                    }
                    value={values.language}
                  >
                    <SelectTrigger className="w-full" id="create-user-language">
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
              </CardContent>
            </Card>
          </aside>
        </div>

        {formError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {formError}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button asChild type="button" variant="outline">
            <Link href={webAdminRoutes.saas.users}>{m.common.cancel}</Link>
          </Button>
          <Button disabled={!canManage || submitting} type="submit">
            {submitting ? m.users.invite.sending : m.users.invite.submit}
          </Button>
        </div>
      </form>
    </section>
  );
}
