"use client";

import type { SaasUserDetail, SaasUserLanguage } from "@cleanhub/api-client";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Icon,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@cleanhub/ui";
import {
  Check,
  Clock3,
  LayoutDashboard,
  LoaderCircle,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { getAuthSessionQuery } from "@/features/auth/queries";
import { SaasBreadcrumbs } from "@/features/saas/shared";
import { updateSaasUserAction } from "@/features/saas/users/actions";
import { getSaasUserDetailQuery } from "@/features/saas/users/queries";
import type {
  UpdateSaasUserFormErrors,
  UpdateSaasUserFormInput,
} from "@/features/saas/users/validators";
import { useSaasI18n } from "@/i18n";

import { dispatchSaasProfileUpdated } from "../events";

const LANGUAGE_VALUES: SaasUserLanguage[] = ["en", "fr", "zh-CN"];

function toFormValues(profile: SaasUserDetail): UpdateSaasUserFormInput {
  return {
    displayName: profile.displayName,
    email: profile.email ?? "",
    language: LANGUAGE_VALUES.includes(profile.language as SaasUserLanguage)
      ? (profile.language as SaasUserLanguage)
      : "en",
    phone: profile.phone ?? "",
    timezone: profile.timezone,
  };
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-xs text-destructive" role="alert">
      {message}
    </p>
  ) : null;
}

export function SaasProfileView() {
  const { m, formatDateTime } = useSaasI18n();
  const copy = m.placeholders.profile;
  const [profile, setProfile] = useState<SaasUserDetail | null>(null);
  const [form, setForm] = useState<UpdateSaasUserFormInput | null>(null);
  const [errors, setErrors] = useState<UpdateSaasUserFormErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getAuthSessionQuery()
      .then(async (session) => {
        if (!session) {
          throw new Error(m.common.loadErrorDescription);
        }

        setCanEdit(session.role === "super_admin");
        return getSaasUserDetailQuery(session.userId);
      })
      .then((data) => {
        if (!active) {
          return;
        }

        setProfile(data);
        setForm(toFormValues(data));
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(
            error instanceof Error
              ? error.message
              : m.common.loadErrorDescription,
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [m.common.loadErrorDescription]);

  const dirty = useMemo(() => {
    if (!profile || !form) {
      return false;
    }

    return JSON.stringify(form) !== JSON.stringify(toFormValues(profile));
  }, [form, profile]);

  function updateField<K extends keyof UpdateSaasUserFormInput>(
    key: K,
    value: UpdateSaasUserFormInput[K],
  ) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile || !form) {
      return;
    }

    setSaving(true);
    setErrors({});

    try {
      const result = await updateSaasUserAction(profile.id, form);

      if (!result.ok) {
        setErrors(result.errors);
        toast.error(m.users.edit.failed);
        return;
      }

      setProfile(result.data);
      setForm(toFormValues(result.data));
      dispatchSaasProfileUpdated({ displayName: result.data.displayName });
      toast.success(m.users.edit.success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : m.users.edit.failed);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section
        aria-busy="true"
        className="mx-auto w-full max-w-[960px] space-y-3 pb-20"
      >
        <div className="h-8 w-44 animate-pulse rounded-md bg-muted" />
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-h-96 animate-pulse rounded-lg border bg-background" />
          <div className="min-h-64 animate-pulse rounded-lg border bg-background" />
        </div>
      </section>
    );
  }

  if (loadError || !profile || !form) {
    return (
      <section className="mx-auto flex min-h-[55vh] w-full max-w-xl items-center justify-center">
        <div className="w-full border-y bg-background px-6 py-10 text-center">
          <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Icon aria-hidden icon={UserRound} size={18} />
          </span>
          <h1 className="mt-4 text-base font-semibold">{copy.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {loadError ?? m.common.loadErrorDescription}
          </p>
        </div>
      </section>
    );
  }

  const roleLabel =
    profile.roles
      .map((role) =>
        role === "super_admin"
          ? m.common.roleLabels.superAdmin
          : role === "support"
            ? m.common.roleLabels.support
            : role,
      )
      .join("、") || m.common.roleLabels.unassigned;

  return (
    <section
      className="mx-auto w-full max-w-[960px] space-y-3 pb-20"
      data-testid="saas-profile-view"
    >
      <h1 className="sr-only">{copy.title}</h1>
      <SaasBreadcrumbs
        ariaLabel={copy.title}
        items={[{ label: copy.title }]}
        rootHref={webAdminRoutes.saas.home}
        rootIcon={LayoutDashboard}
        rootLabel={m.overview.title}
      />

      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        {!canEdit ? (
          <p className="rounded-md border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
            {m.users.readOnlyHint}
          </p>
        ) : null}

        <fieldset className="contents" disabled={saving || !canEdit}>
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="grid gap-5">
              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardContent className="grid gap-4 py-5">
                  <div className="grid gap-2">
                    <Label htmlFor="saas-profile-display-name">
                      {m.users.invite.displayName}
                    </Label>
                    <Input
                      aria-invalid={Boolean(errors.displayName)}
                      id="saas-profile-display-name"
                      onChange={(event) =>
                        updateField("displayName", event.target.value)
                      }
                      value={form.displayName}
                    />
                    <FieldError message={errors.displayName} />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="saas-profile-email">
                        {m.users.invite.email}
                      </Label>
                      <Input
                        aria-invalid={Boolean(errors.email)}
                        id="saas-profile-email"
                        onChange={(event) =>
                          updateField("email", event.target.value)
                        }
                        type="email"
                        value={form.email}
                      />
                      <FieldError message={errors.email} />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="saas-profile-phone">
                        {m.users.invite.phone}
                      </Label>
                      <Input
                        aria-invalid={Boolean(errors.phone)}
                        id="saas-profile-phone"
                        onChange={(event) =>
                          updateField("phone", event.target.value)
                        }
                        value={form.phone ?? ""}
                      />
                      <FieldError message={errors.phone} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardContent className="grid gap-4 py-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="saas-profile-language">
                        {m.users.invite.language}
                      </Label>
                      <Select
                        onValueChange={(value) =>
                          updateField("language", value as SaasUserLanguage)
                        }
                        value={form.language}
                      >
                        <SelectTrigger id="saas-profile-language">
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
                      <FieldError message={errors.language} />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="saas-profile-timezone">
                        {m.users.edit.timezone}
                      </Label>
                      <Input
                        aria-invalid={Boolean(errors.timezone)}
                        id="saas-profile-timezone"
                        onChange={(event) =>
                          updateField("timezone", event.target.value)
                        }
                        value={form.timezone}
                      />
                      <FieldError message={errors.timezone} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <aside className="grid self-start gap-5 lg:sticky lg:top-20">
              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardContent className="grid gap-4 py-5">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Icon aria-hidden icon={UserRound} size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {profile.displayName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {profile.email ?? m.common.notSet}
                      </p>
                    </div>
                  </div>

                  <dl className="grid gap-3 border-t pt-4 text-xs">
                    <div className="flex items-start gap-2">
                      <Icon
                        aria-hidden
                        className="mt-0.5 text-muted-foreground"
                        icon={ShieldCheck}
                        size={14}
                      />
                      <div className="min-w-0">
                        <dt className="text-muted-foreground">
                          {m.users.columns.roles}
                        </dt>
                        <dd className="mt-0.5 font-medium">{roleLabel}</dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Icon
                        aria-hidden
                        className="mt-0.5 text-muted-foreground"
                        icon={Check}
                        size={14}
                      />
                      <div>
                        <dt className="text-muted-foreground">
                          {m.common.status}
                        </dt>
                        <dd className="mt-0.5">
                          <Badge
                            className="px-1.5 py-px text-[11px]"
                            variant={
                              profile.status === "active"
                                ? "default"
                                : "outline"
                            }
                          >
                            {m.common.statusLabels[profile.status]}
                          </Badge>
                        </dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Icon
                        aria-hidden
                        className="mt-0.5 text-muted-foreground"
                        icon={Clock3}
                        size={14}
                      />
                      <div>
                        <dt className="text-muted-foreground">
                          {m.users.columns.lastLogin}
                        </dt>
                        <dd className="mt-0.5 font-medium">
                          {profile.lastLoginAt
                            ? formatDateTime(profile.lastLoginAt)
                            : m.common.never}
                        </dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Icon
                        aria-hidden
                        className="mt-0.5 text-muted-foreground"
                        icon={Mail}
                        size={14}
                      />
                      <div className="min-w-0">
                        <dt className="text-muted-foreground">
                          {m.users.invite.email}
                        </dt>
                        <dd className="mt-0.5 break-all font-medium">
                          {profile.email ?? m.common.notSet}
                        </dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Icon
                        aria-hidden
                        className="mt-0.5 text-muted-foreground"
                        icon={Phone}
                        size={14}
                      />
                      <div className="min-w-0">
                        <dt className="text-muted-foreground">
                          {m.users.invite.phone}
                        </dt>
                        <dd className="mt-0.5 break-all font-medium">
                          {profile.phone ?? m.common.notSet}
                        </dd>
                      </div>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </aside>
          </div>
        </fieldset>

        <div className="pointer-events-none sticky bottom-4 z-30 flex justify-end px-1">
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-xl border border-border/80 bg-background/90 p-1.5 shadow-[0_14px_40px_-16px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <Button
              className="min-w-28 gap-2 rounded-lg"
              disabled={!canEdit || !dirty || saving}
              size="sm"
              type="submit"
            >
              {saving ? (
                <Icon
                  aria-hidden
                  className="animate-spin"
                  icon={LoaderCircle}
                  size={15}
                />
              ) : (
                <Icon aria-hidden icon={Check} size={15} />
              )}
              {saving ? m.common.saving : m.common.saveChanges}
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}
