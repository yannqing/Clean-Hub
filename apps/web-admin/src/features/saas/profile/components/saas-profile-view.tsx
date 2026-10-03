"use client";

import {
  isApiHttpError,
  type SaasProfile,
  type SaasUserLanguage,
} from "@cleanhub/api-client";
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
  Eye,
  EyeOff,
  KeyRound,
  LayoutDashboard,
  LoaderCircle,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { logoutAction } from "@/features/auth/actions";
import { securitySettingsDefaultValues } from "@/features/saas/security/constants";
import { getSecuritySettingsQuery } from "@/features/saas/security/queries";
import type { PasswordPolicyRules } from "@/features/saas/security/validators/password-policy.validator";
import { SaasBreadcrumbs } from "@/features/saas/shared";
import { useSaasI18n } from "@/i18n";
import {
  changeSaasProfilePasswordAction,
  updateSaasProfileAction,
} from "../actions";
import { dispatchSaasProfileUpdated } from "../events";
import { getSaasProfileQuery } from "../queries";

type ProfileForm = {
  displayName: string;
  email: string;
  phone: string;
  language: SaasUserLanguage;
  timezone: string;
};
type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};
type ProfileErrors = Partial<Record<keyof ProfileForm, string>>;
type PasswordErrors = Partial<Record<keyof PasswordForm, string>>;

const EMPTY_PASSWORD: PasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};
const PREFERRED_TIMEZONES = [
  "UTC",
  "Africa/Dakar",
  "Africa/Abidjan",
  "Africa/Bamako",
  "Africa/Lagos",
  "Africa/Accra",
  "Europe/Paris",
  "Asia/Shanghai",
];
const TIMEZONES = [
  ...PREFERRED_TIMEZONES,
  ...Intl.supportedValuesOf("timeZone")
    .filter((timezone) => !PREFERRED_TIMEZONES.includes(timezone))
    .sort((left, right) => left.localeCompare(right)),
];

function profileToForm(profile: SaasProfile): ProfileForm {
  return {
    displayName: profile.displayName,
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    language:
      profile.language === "fr" || profile.language === "zh-CN"
        ? profile.language
        : "en",
    timezone: profile.timezone,
  };
}

function validTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p className="text-xs text-destructive" id={id} role="alert">
      {message}
    </p>
  ) : null;
}

function PasswordInput(props: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete: string;
  showLabel: string;
  hideLabel: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="grid gap-2">
      <Label htmlFor={props.id}>{props.label}</Label>
      <div className="relative">
        <Input
          aria-describedby={props.error ? `${props.id}-error` : undefined}
          aria-invalid={Boolean(props.error)}
          autoComplete={props.autoComplete}
          className="pr-11"
          id={props.id}
          maxLength={128}
          onChange={(event) => props.onChange(event.target.value)}
          type={visible ? "text" : "password"}
          value={props.value}
        />
        <button
          aria-label={visible ? props.hideLabel : props.showLabel}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          <Icon aria-hidden icon={visible ? EyeOff : Eye} size={16} />
        </button>
      </div>
      <FieldError id={`${props.id}-error`} message={props.error} />
    </div>
  );
}

export function SaasProfileView() {
  const { m, formatDateTime } = useSaasI18n();
  const copy = m.profile;
  const router = useRouter();
  const [profile, setProfile] = useState<SaasProfile | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [profileErrors, setProfileErrors] = useState<ProfileErrors>({});
  const [password, setPassword] = useState<PasswordForm>(EMPTY_PASSWORD);
  const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({});
  const [policy, setPolicy] = useState<PasswordPolicyRules>(
    securitySettingsDefaultValues,
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.allSettled([getSaasProfileQuery(), getSecuritySettingsQuery()])
      .then(([profileResult, settingsResult]) => {
        if (!active) return;
        if (profileResult.status === "rejected") throw profileResult.reason;
        setProfile(profileResult.value);
        setForm(profileToForm(profileResult.value));
        setLoadError(null);
        if (settingsResult.status === "fulfilled")
          setPolicy(settingsResult.value);
      })
      .catch(() => {
        if (active) setLoadError(m.common.loadErrorDescription);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload, m.common.loadErrorDescription]);

  const dirty = useMemo(
    () =>
      Boolean(
        profile &&
        form &&
        JSON.stringify(form) !== JSON.stringify(profileToForm(profile)),
      ),
    [profile, form],
  );
  const passwordHint = copy.passwordHint
    .replace("{count}", String(policy.passwordMinLength))
    .replace(
      "{number}",
      policy.passwordRequiresNumber ? copy.numberRequirement : "",
    )
    .replace(
      "{symbol}",
      policy.passwordRequiresSymbol ? copy.symbolRequirement : "",
    );

  function setProfileField<K extends keyof ProfileForm>(
    key: K,
    value: ProfileForm[K],
  ) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setProfileErrors((current) => ({ ...current, [key]: undefined }));
  }
  function setPasswordField<K extends keyof PasswordForm>(
    key: K,
    value: PasswordForm[K],
  ) {
    setPassword((current) => ({ ...current, [key]: value }));
    setPasswordErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !dirty || savingProfile) return;
    const errors: ProfileErrors = {};
    const displayName = form.displayName.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    const timezone = form.timezone.trim();
    if (!displayName || displayName.length > 120)
      errors.displayName = copy.required;
    if (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 320
    )
      errors.email = copy.invalidEmail;
    if (
      phone &&
      (phone.length < 3 ||
        phone.length > 32 ||
        !/^\+?[0-9][0-9\s().-]*$/.test(phone))
    )
      errors.phone = copy.invalidPhone;
    if (!timezone || timezone.length > 64 || !validTimezone(timezone))
      errors.timezone = copy.invalidTimezone;
    if (Object.keys(errors).length) {
      setProfileErrors(errors);
      return;
    }
    setSavingProfile(true);
    setProfileErrors({});
    try {
      const updated = await updateSaasProfileAction({
        displayName,
        email,
        phone: phone || null,
        language: form.language,
        timezone,
      });
      setProfile(updated);
      setForm(profileToForm(updated));
      dispatchSaasProfileUpdated({
        displayName: updated.displayName,
        language: form.language,
      });
      toast.success(copy.saved);
    } catch (error) {
      if (isApiHttpError(error)) {
        if (error.code === "SAAS_USER_EMAIL_CONFLICT")
          setProfileErrors({ email: copy.emailConflict });
        if (error.code === "SAAS_USER_PHONE_CONFLICT")
          setProfileErrors({ phone: copy.phoneConflict });
      }
      toast.error(copy.saveFailed);
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingPassword) return;
    const errors: PasswordErrors = {};
    if (!password.currentPassword) errors.currentPassword = copy.required;
    if (!password.newPassword) errors.newPassword = copy.required;
    else if (password.newPassword === password.currentPassword)
      errors.newPassword = copy.passwordSame;
    else if (
      password.newPassword.length < policy.passwordMinLength ||
      password.newPassword.length > 128 ||
      (policy.passwordRequiresNumber && !/\d/.test(password.newPassword)) ||
      (policy.passwordRequiresSymbol &&
        !/[^A-Za-z0-9]/.test(password.newPassword))
    )
      errors.newPassword = passwordHint;
    if (
      !password.confirmPassword ||
      password.confirmPassword !== password.newPassword
    )
      errors.confirmPassword = copy.passwordMismatch;
    if (Object.keys(errors).length) {
      setPasswordErrors(errors);
      return;
    }
    setSavingPassword(true);
    setPasswordErrors({});
    try {
      await changeSaasProfilePasswordAction({
        currentPassword: password.currentPassword,
        newPassword: password.newPassword,
      });
      setPassword(EMPTY_PASSWORD);
      toast.success(copy.passwordChanged);
      await logoutAction();
      router.replace(webAdminRoutes.login);
      router.refresh();
    } catch (error) {
      if (isApiHttpError(error)) {
        if (error.code === "CURRENT_PASSWORD_INCORRECT")
          setPasswordErrors({ currentPassword: copy.currentPasswordIncorrect });
        if (error.code === "NEW_PASSWORD_UNCHANGED")
          setPasswordErrors({ newPassword: copy.passwordSame });
        if (error.code === "PASSWORD_POLICY_VIOLATION")
          setPasswordErrors({ newPassword: error.message });
      }
      toast.error(copy.passwordFailed);
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading)
    return (
      <section
        aria-busy="true"
        className="mx-auto w-full max-w-5xl space-y-5 pb-20"
      >
        <div className="h-8 w-44 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-xl border bg-background" />
        <div className="h-72 animate-pulse rounded-xl border bg-background" />
      </section>
    );
  if (loadError || !profile || !form)
    return (
      <section className="mx-auto flex min-h-[55vh] w-full max-w-xl items-center justify-center">
        <div className="w-full rounded-xl border bg-background px-6 py-10 text-center">
          <Icon
            aria-hidden
            className="mx-auto text-muted-foreground"
            icon={UserRound}
            size={24}
          />
          <h1 className="mt-4 text-lg font-semibold">
            {m.placeholders.profile.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {loadError ?? m.common.loadErrorDescription}
          </p>
          <Button
            className="mt-5"
            onClick={() => {
              setLoading(true);
              setReload((current) => current + 1);
            }}
            variant="outline"
          >
            {m.common.tryAgain}
          </Button>
        </div>
      </section>
    );

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
  const timezoneOptions = [
    form.timezone,
    ...TIMEZONES.filter((timezone) => timezone !== form.timezone),
  ].filter(Boolean);
  return (
    <section
      className="mx-auto w-full max-w-5xl space-y-6 pb-20"
      data-testid="saas-profile-view"
    >
      <SaasBreadcrumbs
        ariaLabel={m.placeholders.profile.title}
        items={[{ label: m.placeholders.profile.title }]}
        rootHref={webAdminRoutes.saas.home}
        rootIcon={LayoutDashboard}
        rootLabel={m.overview.title}
      />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {m.placeholders.profile.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{copy.intro}</p>
      </div>
      <Card className="gap-0 rounded-xl py-0 shadow-none">
        <CardContent className="flex flex-wrap items-center gap-4 py-5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
            {profile.displayName.trim().charAt(0).toUpperCase() || "C"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{profile.displayName}</p>
            <p className="truncate text-sm text-muted-foreground">
              {profile.email ?? m.common.notSet}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <Badge variant="secondary">{roleLabel}</Badge>
            <span>
              {m.users.columns.lastLogin}:{" "}
              {profile.lastLoginAt
                ? formatDateTime(profile.lastLoginAt)
                : m.common.never}
            </span>
          </div>
        </CardContent>
      </Card>

      <form className="space-y-5" noValidate onSubmit={saveProfile}>
        <fieldset disabled={savingProfile} className="space-y-5">
          <Card className="gap-0 rounded-xl py-0 shadow-none">
            <CardContent className="space-y-5 py-6">
              <div className="border-b pb-5">
                <h2 className="font-semibold">{copy.identityTitle}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {copy.identityDescription}
                </p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="profile-name">{copy.displayName}</Label>
                  <Input
                    id="profile-name"
                    autoComplete="name"
                    maxLength={120}
                    aria-invalid={Boolean(profileErrors.displayName)}
                    aria-describedby={
                      profileErrors.displayName
                        ? "profile-name-error"
                        : undefined
                    }
                    value={form.displayName}
                    onChange={(event) =>
                      setProfileField("displayName", event.target.value)
                    }
                  />
                  <FieldError
                    id="profile-name-error"
                    message={profileErrors.displayName}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="profile-email">{copy.email}</Label>
                  <Input
                    id="profile-email"
                    type="email"
                    autoComplete="email"
                    maxLength={320}
                    aria-invalid={Boolean(profileErrors.email)}
                    aria-describedby={
                      profileErrors.email ? "profile-email-error" : undefined
                    }
                    value={form.email}
                    onChange={(event) =>
                      setProfileField("email", event.target.value)
                    }
                  />
                  <FieldError
                    id="profile-email-error"
                    message={profileErrors.email}
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="profile-phone">{copy.phone}</Label>
                  <Input
                    id="profile-phone"
                    type="tel"
                    autoComplete="tel"
                    maxLength={32}
                    aria-invalid={Boolean(profileErrors.phone)}
                    aria-describedby={
                      profileErrors.phone ? "profile-phone-error" : undefined
                    }
                    value={form.phone}
                    onChange={(event) =>
                      setProfileField("phone", event.target.value)
                    }
                  />
                  <FieldError
                    id="profile-phone-error"
                    message={profileErrors.phone}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="gap-0 rounded-xl py-0 shadow-none">
            <CardContent className="space-y-5 py-6">
              <div className="border-b pb-5">
                <h2 className="font-semibold">{copy.preferencesTitle}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {copy.preferencesDescription}
                </p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="profile-language">{copy.language}</Label>
                  <Select
                    value={form.language}
                    onValueChange={(value) =>
                      setProfileField("language", value as SaasUserLanguage)
                    }
                  >
                    <SelectTrigger id="profile-language">
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
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="profile-timezone">{copy.timezone}</Label>
                  <Select
                    value={form.timezone}
                    onValueChange={(value) =>
                      setProfileField("timezone", value)
                    }
                  >
                    <SelectTrigger
                      id="profile-timezone"
                      className="w-full"
                      aria-invalid={Boolean(profileErrors.timezone)}
                      aria-describedby={
                        profileErrors.timezone
                          ? "profile-timezone-error"
                          : "profile-timezone-hint"
                      }
                    >
                      <SelectValue placeholder="UTC" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {timezoneOptions.map((zone) => (
                        <SelectItem key={zone} value={zone}>
                          {zone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p
                    id="profile-timezone-hint"
                    className="text-xs text-muted-foreground"
                  >
                    {copy.timezoneHint}
                  </p>
                  <FieldError
                    id="profile-timezone-error"
                    message={profileErrors.timezone}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </fieldset>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!dirty || savingProfile}
            onClick={() => {
              setForm(profileToForm(profile));
              setProfileErrors({});
            }}
          >
            {copy.discard}
          </Button>
          <Button
            type="submit"
            disabled={!dirty || savingProfile}
            className="min-w-32 gap-2"
          >
            {savingProfile ? (
              <Icon
                aria-hidden
                className="animate-spin"
                icon={LoaderCircle}
                size={16}
              />
            ) : (
              <Icon aria-hidden icon={Check} size={16} />
            )}
            {savingProfile ? m.common.saving : m.common.saveChanges}
          </Button>
        </div>
      </form>

      <form noValidate onSubmit={changePassword}>
        <Card className="gap-0 rounded-xl py-0 shadow-none">
          <CardContent className="space-y-5 py-6">
            <div className="border-b pb-5">
              <div className="flex items-center gap-2">
                <Icon aria-hidden icon={KeyRound} size={18} />
                <h2 className="font-semibold">{copy.securityTitle}</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {copy.securityDescription}
              </p>
            </div>
            <fieldset
              disabled={savingPassword}
              className="grid gap-5 sm:grid-cols-2"
            >
              <div className="sm:col-span-2 sm:max-w-[calc(50%-0.625rem)]">
                <PasswordInput
                  id="current-password"
                  label={copy.currentPassword}
                  value={password.currentPassword}
                  onChange={(value) =>
                    setPasswordField("currentPassword", value)
                  }
                  error={passwordErrors.currentPassword}
                  autoComplete="current-password"
                  showLabel={copy.showPassword}
                  hideLabel={copy.hidePassword}
                />
              </div>
              <PasswordInput
                id="new-password"
                label={copy.newPassword}
                value={password.newPassword}
                onChange={(value) => setPasswordField("newPassword", value)}
                error={passwordErrors.newPassword}
                autoComplete="new-password"
                showLabel={copy.showPassword}
                hideLabel={copy.hidePassword}
              />
              <PasswordInput
                id="confirm-password"
                label={copy.confirmPassword}
                value={password.confirmPassword}
                onChange={(value) => setPasswordField("confirmPassword", value)}
                error={passwordErrors.confirmPassword}
                autoComplete="new-password"
                showLabel={copy.showPassword}
                hideLabel={copy.hidePassword}
              />
            </fieldset>
            <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              <p>{passwordHint}</p>
              <p className="mt-1">{copy.passwordReauth}</p>
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={savingPassword}
                className="min-w-32 gap-2"
              >
                {savingPassword ? (
                  <Icon
                    aria-hidden
                    className="animate-spin"
                    icon={LoaderCircle}
                    size={16}
                  />
                ) : (
                  <Icon aria-hidden icon={KeyRound} size={16} />
                )}
                {savingPassword ? m.common.saving : copy.changePassword}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </section>
  );
}
