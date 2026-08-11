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
  cn,
  toast,
} from "@cleanhub/ui";
import {
  Building2,
  Check,
  Clock3,
  Eye,
  EyeOff,
  KeyRound,
  LaptopMinimal,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import { webAdminRoutes } from "@/config/routes";
import { logoutAction } from "@/features/auth/actions";
import { useTenantI18n } from "@/i18n";

import {
  changeTenantProfilePasswordAction,
  revokeTenantLoginSessionAction,
  updateTenantProfileAction,
} from "../actions";
import { dispatchTenantProfileUpdated } from "../events";
import { getTenantLoginSessionsQuery } from "../queries";
import type {
  TenantPasswordFormErrorCode,
  TenantPasswordFormErrors,
  TenantPasswordFormValues,
  TenantLoginSession,
  TenantProfile,
  TenantProfileActionErrorCode,
  TenantProfileFormErrorCode,
  TenantProfileFormErrors,
  TenantProfileFormValues,
} from "../types";
import {
  validateTenantPasswordForm,
  validateTenantProfileForm,
} from "../validators";

type TenantProfileViewProps = {
  initialProfile: TenantProfile | null;
  initialSessions: TenantLoginSession[] | null;
};

type LoginSessionDevice = {
  browser: string;
  operatingSystem: string;
  mobile: boolean;
};

const DEFAULT_VISIBLE_LOGIN_SESSIONS = 5;

function describeLoginSessionDevice(
  userAgent: string | null,
  unknownBrowser: string,
  unknownOperatingSystem: string,
): LoginSessionDevice {
  if (!userAgent) {
    return {
      browser: unknownBrowser,
      operatingSystem: unknownOperatingSystem,
      mobile: false,
    };
  }

  const browser = /Edg\//.test(userAgent)
    ? "Microsoft Edge"
    : /(?:Chrome|CriOS)\//.test(userAgent)
      ? "Google Chrome"
      : /(?:Firefox|FxiOS)\//.test(userAgent)
        ? "Mozilla Firefox"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : unknownBrowser;
  const operatingSystem = /iPad|iPhone|iPod/.test(userAgent)
    ? "iOS"
    : /Android/.test(userAgent)
      ? "Android"
      : /Windows/.test(userAgent)
        ? "Windows"
        : /Macintosh|Mac OS X/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : unknownOperatingSystem;

  return {
    browser,
    operatingSystem,
    mobile: /Android|iPad|iPhone|iPod|Mobile/.test(userAgent),
  };
}

const EMPTY_PASSWORD_FORM: TenantPasswordFormValues = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function getProfileForm(profile: TenantProfile): TenantProfileFormValues {
  return {
    displayName: profile.displayName,
    email: profile.email ?? "",
    phone: profile.phone ?? "",
  };
}

function getInitials(displayName: string): string {
  const initials = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "CH";
}

function ProfileSection({
  children,
  description,
  icon,
  title,
}: {
  children: ReactNode;
  description?: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-background shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex gap-3 border-b px-4 py-4 sm:px-5">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function ReadOnlyField({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 py-3">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-1 break-words text-sm font-medium">{value}</dd>
      </div>
    </div>
  );
}

export function TenantProfileView({
  initialProfile,
  initialSessions,
}: TenantProfileViewProps) {
  const router = useRouter();
  const { m, formatDate, formatDateTime } = useTenantI18n();
  const copy = m.profile;
  const [profile, setProfile] = useState(initialProfile);
  const [profileForm, setProfileForm] = useState<TenantProfileFormValues | null>(
    () => (initialProfile ? getProfileForm(initialProfile) : null),
  );
  const [profileErrors, setProfileErrors] =
    useState<TenantProfileFormErrors>({});
  const [passwordForm, setPasswordForm] =
    useState<TenantPasswordFormValues>(EMPTY_PASSWORD_FORM);
  const [passwordErrors, setPasswordErrors] =
    useState<TenantPasswordFormErrors>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loginSessions, setLoginSessions] =
    useState<TenantLoginSession[] | null>(initialSessions);
  const [showAllLoginSessions, setShowAllLoginSessions] = useState(false);
  const [sessionToRevoke, setSessionToRevoke] =
    useState<TenantLoginSession | null>(null);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(
    null,
  );

  const profileDirty = useMemo(() => {
    if (!profile || !profileForm) {
      return false;
    }

    return (
      profileForm.displayName.trim() !== profile.displayName ||
      profileForm.email.trim().toLowerCase() !== (profile.email ?? "") ||
      profileForm.phone.trim() !== (profile.phone ?? "")
    );
  }, [profile, profileForm]);

  useEffect(() => {
    let active = true;

    void getTenantLoginSessionsQuery()
      .then((sessions) => {
        if (active) {
          setLoginSessions(sessions);
        }
      })
      .catch(() => {
        // Keep the server-rendered list when the browser refresh request fails.
      });

    return () => {
      active = false;
    };
  }, []);

  if (!profile || !profileForm) {
    return (
      <div className="mx-auto flex min-h-[55vh] w-full max-w-xl items-center justify-center">
        <div className="w-full rounded-xl border bg-background px-6 py-10 text-center">
          <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <UserRound aria-hidden className="size-5" />
          </span>
          <h1 className="mt-4 text-base font-semibold">{copy.loadErrorTitle}</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            {copy.loadErrorDescription}
          </p>
          <Button
            className="mt-5"
            onClick={() => router.refresh()}
            type="button"
            variant="outline"
          >
            <RefreshCw aria-hidden />
            {copy.retry}
          </Button>
        </div>
      </div>
    );
  }

  const loadedProfile = profile;
  const loadedProfileForm = profileForm;

  function getProfileErrorMessage(code: TenantProfileFormErrorCode): string {
    return copy.validation[code];
  }

  function getPasswordErrorMessage(
    code: TenantPasswordFormErrorCode,
  ): string {
    if (code === "passwordTooShort") {
      return copy.validation.passwordTooShort.replace(
        "{count}",
        String(loadedProfile.passwordPolicy.passwordMinLength),
      );
    }

    return copy.validation[code];
  }

  function getActionErrorMessage(code: TenantProfileActionErrorCode): string {
    if (code in copy.validation) {
      const validationCode = code as
        | TenantProfileFormErrorCode
        | TenantPasswordFormErrorCode;

      if (validationCode === "passwordTooShort") {
        return getPasswordErrorMessage(validationCode);
      }

      return copy.validation[validationCode];
    }

    switch (code) {
      case "CURRENT_PASSWORD_INCORRECT":
        return copy.feedback.currentPasswordIncorrect;
      case "NEW_PASSWORD_UNCHANGED":
        return copy.feedback.passwordUnchanged;
      case "PASSWORD_POLICY_VIOLATION":
        return copy.feedback.passwordPolicyViolation;
      case "TENANT_PROFILE_CONFLICT":
        return copy.feedback.conflict;
      case "TENANT_PROFILE_EMAIL_CONFLICT":
        return copy.feedback.emailConflict;
      case "TENANT_PROFILE_NOT_FOUND":
        return copy.feedback.notFound;
      default:
        return copy.feedback.requestFailed;
    }
  }

  function updateProfileForm<K extends keyof TenantProfileFormValues>(
    field: K,
    value: TenantProfileFormValues[K],
  ) {
    setProfileForm((current) =>
      current ? { ...current, [field]: value } : current,
    );
    setProfileErrors((current) => ({ ...current, [field]: undefined }));
  }

  function updatePasswordForm<K extends keyof TenantPasswordFormValues>(
    field: K,
    value: TenantPasswordFormValues[K],
  ) {
    setPasswordForm((current) => ({ ...current, [field]: value }));
    setPasswordErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validateTenantProfileForm(loadedProfileForm);

    if (!validation.ok) {
      setProfileErrors(validation.errors);
      toast.error(copy.feedback.checkForm);
      return;
    }

    if (!profileDirty) {
      toast.success(copy.feedback.upToDate);
      return;
    }

    setSavingProfile(true);

    try {
      const result = await updateTenantProfileAction(validation.data);

      if (!result.ok) {
        setProfileErrors(result.errors);
        toast.error(getActionErrorMessage(result.code));
        return;
      }

      setProfile(result.data);
      setProfileForm(getProfileForm(result.data));
      setProfileErrors({});
      dispatchTenantProfileUpdated({ displayName: result.data.displayName });
      toast.success(copy.feedback.profileSaved);
    } catch {
      toast.error(copy.feedback.requestFailed);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validateTenantPasswordForm(
      passwordForm,
      loadedProfile.passwordPolicy,
    );

    if (!validation.ok) {
      setPasswordErrors(validation.errors);
      toast.error(copy.feedback.checkPassword);
      return;
    }

    setSavingPassword(true);

    try {
      const result = await changeTenantProfilePasswordAction(validation.data);

      if (!result.ok) {
        toast.error(getActionErrorMessage(result.code));
        return;
      }

      setPasswordErrors({});
      setPasswordForm(EMPTY_PASSWORD_FORM);
      toast.success(copy.feedback.passwordChanged);
      await logoutAction();
      router.replace(webAdminRoutes.login);
      router.refresh();
    } catch {
      toast.error(copy.feedback.requestFailed);
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleSessionRevoke() {
    if (!sessionToRevoke || sessionToRevoke.current) {
      return;
    }

    setRevokingSessionId(sessionToRevoke.id);

    try {
      const result = await revokeTenantLoginSessionAction(sessionToRevoke.id);

      if (!result.ok) {
        if (result.code === "TENANT_LOGIN_SESSION_NOT_FOUND") {
          setLoginSessions((current) =>
            current?.filter((session) => session.id !== sessionToRevoke.id) ??
            current,
          );
          setSessionToRevoke(null);
          toast.error(copy.devices.sessionNotFound);
          return;
        }

        if (result.code === "TENANT_CURRENT_SESSION_REVOKE_FORBIDDEN") {
          toast.error(copy.devices.currentSessionForbidden);
          return;
        }

        toast.error(copy.devices.revokeFailed);
        return;
      }

      setLoginSessions((current) =>
        current?.filter((session) => session.id !== result.sessionId) ??
        current,
      );
      setSessionToRevoke(null);
      toast.success(copy.devices.revokeSuccess);
    } catch {
      toast.error(copy.devices.revokeFailed);
    } finally {
      setRevokingSessionId(null);
    }
  }

  const statusLabel = copy.statusLabels[profile.status];
  const branchNameById = new Map(
    profile.accessibleBranches.map((branch) => [branch.id, branch.name]),
  );

  return (
    <div className="mx-auto w-full max-w-[1100px] pb-10">
      <div className="mb-5 flex items-center gap-3">
        <UserRound aria-hidden className="size-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{copy.title}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {copy.description}
          </p>
        </div>
      </div>

      <section className="mb-4 flex flex-col gap-4 rounded-xl border bg-background px-4 py-4 sm:flex-row sm:items-center sm:px-5">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-foreground text-base font-semibold text-background">
          {getInitials(profile.displayName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold">
              {profile.displayName}
            </h2>
            <Badge
              variant={profile.status === "active" ? "secondary" : "outline"}
            >
              {statusLabel}
            </Badge>
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {profile.tenant.name}
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-1 text-xs sm:text-right">
          <span className="text-muted-foreground">{copy.tenantCode}</span>
          <span className="font-medium">{profile.tenant.pressingCode}</span>
          <span className="text-muted-foreground">{copy.branchCount}</span>
          <span className="font-medium">
            {profile.accessibleBranches.length}
          </span>
        </div>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.75fr)]">
        <div className="grid gap-4">
          <ProfileSection
            description={copy.personal.description}
            icon={<UserRound aria-hidden className="size-4" />}
            title={copy.personal.title}
          >
            <form onSubmit={handleProfileSubmit}>
              <div className="grid gap-5 p-4 sm:p-5">
                <div className="grid gap-2">
                  <Label htmlFor="tenant-profile-display-name">
                    {copy.personal.displayName}
                  </Label>
                  <Input
                    aria-invalid={Boolean(profileErrors.displayName)}
                    autoComplete="name"
                    disabled={savingProfile}
                    id="tenant-profile-display-name"
                    maxLength={120}
                    onChange={(event) =>
                      updateProfileForm("displayName", event.target.value)
                    }
                    value={profileForm.displayName}
                  />
                  {profileErrors.displayName ? (
                    <p className="text-xs text-destructive">
                      {getProfileErrorMessage(profileErrors.displayName)}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {copy.personal.displayNameHint}
                    </p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="tenant-profile-email">
                      {copy.personal.email}
                    </Label>
                    <Input
                      aria-invalid={Boolean(profileErrors.email)}
                      autoComplete="email"
                      disabled={savingProfile}
                      id="tenant-profile-email"
                      maxLength={320}
                      onChange={(event) =>
                        updateProfileForm("email", event.target.value)
                      }
                      type="email"
                      value={profileForm.email}
                    />
                    {profileErrors.email ? (
                      <p className="text-xs text-destructive">
                        {getProfileErrorMessage(profileErrors.email)}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {copy.personal.emailHint}
                      </p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="tenant-profile-phone">
                      {copy.personal.phone}
                    </Label>
                    <Input
                      aria-invalid={Boolean(profileErrors.phone)}
                      autoComplete="tel"
                      disabled={savingProfile}
                      id="tenant-profile-phone"
                      maxLength={32}
                      onChange={(event) =>
                        updateProfileForm("phone", event.target.value)
                      }
                      type="tel"
                      value={profileForm.phone}
                    />
                    {profileErrors.phone ? (
                      <p className="text-xs text-destructive">
                        {getProfileErrorMessage(profileErrors.phone)}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {copy.personal.phoneHint}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end border-t px-4 py-3 sm:px-5">
                <Button
                  disabled={savingProfile || !profileDirty}
                  size="sm"
                  type="submit"
                >
                  {savingProfile ? copy.saving : copy.saveProfile}
                </Button>
              </div>
            </form>
          </ProfileSection>

          <ProfileSection
            description={copy.security.description}
            icon={<KeyRound aria-hidden className="size-4" />}
            title={copy.security.title}
          >
            <form onSubmit={handlePasswordSubmit}>
              <div className="grid gap-5 p-4 sm:p-5">
                <div className="grid gap-2">
                  <Label htmlFor="tenant-profile-current-password">
                    {copy.security.currentPassword}
                  </Label>
                  <div className="relative">
                    <Input
                      aria-invalid={Boolean(passwordErrors.currentPassword)}
                      autoComplete="current-password"
                      className="pr-10"
                      disabled={savingPassword}
                      id="tenant-profile-current-password"
                      onChange={(event) =>
                        updatePasswordForm(
                          "currentPassword",
                          event.target.value,
                        )
                      }
                      type={showCurrentPassword ? "text" : "password"}
                      value={passwordForm.currentPassword}
                    />
                    <button
                      aria-label={
                        showCurrentPassword
                          ? copy.security.hidePassword
                          : copy.security.showPassword
                      }
                      className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() =>
                        setShowCurrentPassword((current) => !current)
                      }
                      type="button"
                    >
                      {showCurrentPassword ? (
                        <EyeOff aria-hidden className="size-4" />
                      ) : (
                        <Eye aria-hidden className="size-4" />
                      )}
                    </button>
                  </div>
                  {passwordErrors.currentPassword ? (
                    <p className="text-xs text-destructive">
                      {getPasswordErrorMessage(
                        passwordErrors.currentPassword,
                      )}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="tenant-profile-new-password">
                      {copy.security.newPassword}
                    </Label>
                    <div className="relative">
                      <Input
                        aria-invalid={Boolean(passwordErrors.newPassword)}
                        autoComplete="new-password"
                        className="pr-10"
                        disabled={savingPassword}
                        id="tenant-profile-new-password"
                        onChange={(event) =>
                          updatePasswordForm("newPassword", event.target.value)
                        }
                        type={showNewPassword ? "text" : "password"}
                        value={passwordForm.newPassword}
                      />
                      <button
                        aria-label={
                          showNewPassword
                            ? copy.security.hidePassword
                            : copy.security.showPassword
                        }
                        className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() =>
                          setShowNewPassword((current) => !current)
                        }
                        type="button"
                      >
                        {showNewPassword ? (
                          <EyeOff aria-hidden className="size-4" />
                        ) : (
                          <Eye aria-hidden className="size-4" />
                        )}
                      </button>
                    </div>
                    {passwordErrors.newPassword ? (
                      <p className="text-xs text-destructive">
                        {getPasswordErrorMessage(passwordErrors.newPassword)}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="tenant-profile-confirm-password">
                      {copy.security.confirmPassword}
                    </Label>
                    <div className="relative">
                      <Input
                        aria-invalid={Boolean(passwordErrors.confirmPassword)}
                        autoComplete="new-password"
                        className="pr-10"
                        disabled={savingPassword}
                        id="tenant-profile-confirm-password"
                        onChange={(event) =>
                          updatePasswordForm(
                            "confirmPassword",
                            event.target.value,
                          )
                        }
                        type={showConfirmPassword ? "text" : "password"}
                        value={passwordForm.confirmPassword}
                      />
                      <button
                        aria-label={
                          showConfirmPassword
                            ? copy.security.hidePassword
                            : copy.security.showPassword
                        }
                        className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() =>
                          setShowConfirmPassword((current) => !current)
                        }
                        type="button"
                      >
                        {showConfirmPassword ? (
                          <EyeOff aria-hidden className="size-4" />
                        ) : (
                          <Eye aria-hidden className="size-4" />
                        )}
                      </button>
                    </div>
                    {passwordErrors.confirmPassword ? (
                      <p className="text-xs text-destructive">
                        {getPasswordErrorMessage(
                          passwordErrors.confirmPassword,
                        )}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-lg bg-muted/55 px-3.5 py-3">
                  <p className="text-xs font-medium">
                    {copy.security.requirementsTitle}
                  </p>
                  <ul className="mt-2 grid gap-1.5 text-xs text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check aria-hidden className="size-3.5" />
                      {copy.security.minimumLength.replace(
                        "{count}",
                        String(profile.passwordPolicy.passwordMinLength),
                      )}
                    </li>
                    {profile.passwordPolicy.passwordRequiresNumber ? (
                      <li className="flex items-center gap-2">
                        <Check aria-hidden className="size-3.5" />
                        {copy.security.requiresNumber}
                      </li>
                    ) : null}
                    {profile.passwordPolicy.passwordRequiresSymbol ? (
                      <li className="flex items-center gap-2">
                        <Check aria-hidden className="size-3.5" />
                        {copy.security.requiresSymbol}
                      </li>
                    ) : null}
                  </ul>
                </div>

                <p className="text-xs leading-5 text-muted-foreground">
                  {copy.security.signOutNotice}
                </p>
              </div>

              <div className="flex justify-end border-t px-4 py-3 sm:px-5">
                <Button
                  disabled={savingPassword}
                  size="sm"
                  type="submit"
                >
                  {savingPassword
                    ? copy.security.changingPassword
                    : copy.security.changePassword}
                </Button>
              </div>
            </form>
          </ProfileSection>

          <ProfileSection
            description={copy.devices.description}
            icon={<LaptopMinimal aria-hidden className="size-4" />}
            title={copy.devices.title}
          >
            {loginSessions === null ? (
              <div className="px-4 py-8 text-center sm:px-5">
                <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <LaptopMinimal aria-hidden className="size-4" />
                </span>
                <p className="mt-3 text-sm font-medium">
                  {copy.devices.loadErrorTitle}
                </p>
                <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-muted-foreground">
                  {copy.devices.loadErrorDescription}
                </p>
                <Button
                  className="mt-4"
                  onClick={() => router.refresh()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <RefreshCw aria-hidden />
                  {copy.retry}
                </Button>
              </div>
            ) : loginSessions.length === 0 ? (
              <div className="px-4 py-8 text-center sm:px-5">
                <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <LaptopMinimal aria-hidden className="size-4" />
                </span>
                <p className="mt-3 text-sm font-medium">
                  {copy.devices.emptyTitle}
                </p>
                <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-muted-foreground">
                  {copy.devices.emptyDescription}
                </p>
              </div>
            ) : (
              <ul className="divide-y">
                {(showAllLoginSessions
                  ? loginSessions
                  : loginSessions.slice(0, DEFAULT_VISIBLE_LOGIN_SESSIONS)
                ).map((session) => {
                  const device = describeLoginSessionDevice(
                    session.userAgent,
                    copy.devices.unknownBrowser,
                    copy.devices.unknownOperatingSystem,
                  );

                  return (
                    <li
                      className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-start sm:px-5"
                      key={session.id}
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        {device.mobile ? (
                          <Smartphone aria-hidden className="size-4" />
                        ) : (
                          <LaptopMinimal aria-hidden className="size-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold">
                            {device.browser}
                          </p>
                          {session.current ? (
                            <Badge variant="secondary">
                              {copy.devices.currentDevice}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {device.operatingSystem}
                        </p>
                        <dl className="mt-3 grid gap-x-5 gap-y-2 text-xs sm:grid-cols-2">
                          <div>
                            <dt className="text-muted-foreground">
                              {copy.devices.ipAddress}
                            </dt>
                            <dd className="mt-0.5 font-medium">
                              {session.ipAddress || copy.devices.unknownIp}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">
                              {copy.devices.lastActive}
                            </dt>
                            <dd className="mt-0.5 font-medium">
                              {formatDateTime(session.lastActiveAt)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">
                              {copy.devices.signedInAt}
                            </dt>
                            <dd className="mt-0.5 font-medium">
                              {formatDateTime(session.signedInAt)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">
                              {copy.devices.expiresAt}
                            </dt>
                            <dd className="mt-0.5 font-medium">
                              {formatDateTime(session.expiresAt)}
                            </dd>
                          </div>
                        </dl>
                      </div>
                      {session.current ? null : (
                        <Button
                          className="shrink-0"
                          disabled={revokingSessionId !== null}
                          onClick={() => setSessionToRevoke(session)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          {copy.devices.revoke}
                        </Button>
                      )}
                    </li>
                  );
                })}
                {loginSessions.length > DEFAULT_VISIBLE_LOGIN_SESSIONS ? (
                  <li className="flex justify-center px-4 py-3 sm:px-5">
                    <Button
                      onClick={() =>
                        setShowAllLoginSessions((current) => !current)
                      }
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      {showAllLoginSessions
                        ? copy.devices.showLess
                        : copy.devices.showAll.replace(
                            "{count}",
                            String(loginSessions.length),
                          )}
                    </Button>
                  </li>
                ) : null}
              </ul>
            )}
          </ProfileSection>
        </div>

        <div className="grid gap-4">
          <ProfileSection
            icon={<ShieldCheck aria-hidden className="size-4" />}
            title={copy.account.title}
          >
            <dl className="divide-y px-4 sm:px-5">
              <ReadOnlyField
                icon={<Clock3 aria-hidden className="size-4" />}
                label={copy.account.lastLogin}
                value={
                  profile.lastLoginAt
                    ? formatDateTime(profile.lastLoginAt)
                    : copy.never
                }
              />
              <ReadOnlyField
                icon={<UserRound aria-hidden className="size-4" />}
                label={copy.account.createdAt}
                value={formatDate(profile.createdAt)}
              />
            </dl>
          </ProfileSection>

          <ProfileSection
            description={copy.access.description}
            icon={<Building2 aria-hidden className="size-4" />}
            title={copy.access.title}
          >
            <div className="grid gap-5 p-4 sm:p-5">
              <div>
                <h3 className="text-xs font-medium text-muted-foreground">
                  {copy.access.roles}
                </h3>
                {profile.roles.length > 0 ? (
                  <ul className="mt-2 grid gap-2">
                    {profile.roles.map((role, index) => {
                      const scopeName = role.branchId
                        ? branchNameById.get(role.branchId) ??
                          copy.access.unknownBranch
                        : copy.access.allBranches;

                      return (
                        <li
                          className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5"
                          key={`${role.code}-${role.branchId ?? "tenant"}-${index}`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">
                              {role.name}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                              {role.code}
                            </span>
                          </span>
                          <Badge className="max-w-32 truncate" variant="outline">
                            {scopeName}
                          </Badge>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {copy.access.noRoles}
                  </p>
                )}
              </div>

              <div className="border-t pt-5">
                <h3 className="text-xs font-medium text-muted-foreground">
                  {copy.access.branches}
                </h3>
                {profile.accessibleBranches.length > 0 ? (
                  <ul className="mt-2 grid gap-1">
                    {profile.accessibleBranches.map((branch) => (
                      <li
                        className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-muted/55"
                        key={branch.id}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <MapPin
                            aria-hidden
                            className="size-3.5 shrink-0 text-muted-foreground"
                          />
                          <span className="truncate text-sm">{branch.name}</span>
                        </span>
                        <span
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            branch.status === "active"
                              ? "bg-emerald-500"
                              : "bg-muted-foreground/40",
                          )}
                          title={copy.branchStatusLabels[branch.status]}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {copy.access.noBranches}
                  </p>
                )}
              </div>
            </div>
          </ProfileSection>
        </div>
      </div>

      <Dialog
        onOpenChange={(open) => {
          if (!open && revokingSessionId === null) {
            setSessionToRevoke(null);
          }
        }}
        open={Boolean(sessionToRevoke)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.devices.revokeDialogTitle}</DialogTitle>
            <DialogDescription>
              {copy.devices.revokeDialogDescription}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={revokingSessionId !== null}
              onClick={() => setSessionToRevoke(null)}
              type="button"
              variant="outline"
            >
              {copy.devices.cancel}
            </Button>
            <Button
              disabled={revokingSessionId !== null}
              onClick={() => void handleSessionRevoke()}
              type="button"
              variant="destructive"
            >
              {revokingSessionId
                ? copy.devices.revoking
                : copy.devices.confirmRevoke}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
