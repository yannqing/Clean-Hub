"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { isApiHttpError, type MobileAuthContext } from "@cleanhub/api-client";
import type { TranslationKey } from "@cleanhub/i18n";
import { useTranslation } from "@cleanhub/i18n/react";
import { Button, Input, Label } from "@cleanhub/ui";
import { Building2, ChevronRight, Loader2, PackageCheck, ShieldCheck } from "lucide-react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { CustomerHome } from "@/features/customer";

import { CustomerFirstPassword } from "./customer-first-password";
import { DeliveryHome } from "@/features/delivery";
import { OwnerHome } from "@/features/owner";
import { apiClient } from "@/lib/api-client";
import { mobileReleaseConfig } from "@/lib/mobile-release-config";
import { clearMobileSession } from "@/lib/token-storage";
import {
  disablePushNotifications,
  registerPushNotificationsIfPermitted,
} from "@/lib/push-notifications";
import {
  enterTenantContext,
  getCustomerTestOtp,
  loadStoredAuthState,
  loginCustomerWithPassword,
  loginDriver,
  loginOwner,
  logoutLocally,
  requestCustomerOtp,
  resetTenantContext,
  verifyCustomerOtp,
} from "../actions";
import type { LoginMode } from "../types";

type SessionView = {
  authContext: MobileAuthContext;
};

const OTP_RESEND_COOLDOWN_SECONDS = 60;

function getErrorMessage(error: unknown, fallback: string, t: ReturnType<typeof useTranslation>["t"]): string {
  if (error instanceof Error) {
    if (error.message.startsWith("auth.") || error.message.startsWith("common.")) {
      return t(error.message as TranslationKey);
    }

    return error.message;
  }

  return fallback;
}

function isUnauthorizedSessionError(error: unknown): boolean {
  return isApiHttpError(error) && error.status === 401;
}

export function MobileAuthShell() {
  const { t } = useTranslation();
  const [tenantCode, setTenantCode] = useState<string | null>(null);
  const [session, setSession] = useState<SessionView | null>(null);
  const [tenantInput, setTenantInput] = useState("");
  const [mode, setMode] = useState<LoginMode>("customer-password");
  const [customerOtpEnabled, setCustomerOtpEnabled] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [testOtp, setTestOtp] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [otpCooldownSeconds, setOtpCooldownSeconds] = useState(0);
  const [isBooting, setIsBooting] = useState(true);
  const [isPending, startTransition] = useTransition();
  const showTestOtp = mobileReleaseConfig.appEnvironment !== "prod";

  const accountRoles = useMemo(
    () =>
      [
        { value: "customer-password", label: t("auth.login.customerPassword") },
        { value: "owner", label: t("auth.login.owner") },
        { value: "driver", label: t("auth.login.driver") },
      ] satisfies { value: LoginMode; label: string }[],
    [t],
  );

  useEffect(() => {
    let mounted = true;

    loadStoredAuthState()
      .then(async (state) => {
        let nextSession = state.session
          ? { authContext: state.session.authContext }
          : null;

        if (state.session) {
          try {
            nextSession = {
              authContext: await apiClient.mobile.auth.me(),
            };
          } catch (nextError) {
            if (isUnauthorizedSessionError(nextError)) {
              await clearMobileSession();
              nextSession = null;
            }
          }
        }

        const loginOptions = state.tenantCode
          ? await apiClient.mobile.auth
              .getCustomerLoginOptions({ tenantCode: state.tenantCode })
              .catch(() => null)
          : null;

        if (!mounted) {
          return;
        }

        setTenantCode(state.tenantCode);
        setTenantInput(state.tenantCode ?? "");
        setCustomerOtpEnabled(loginOptions?.customerOtpEnabled ?? false);
        setSession(nextSession);
        if (nextSession) {
          // Best effort: never blocks session restore.
          void registerPushNotificationsIfPermitted(apiClient);
        }
      })
      .catch(() => {
        if (mounted) {
          setError(t("auth.login.sessionReadFailed"));
        }
      })
      .finally(() => {
        if (mounted) {
          setIsBooting(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [t]);

  useEffect(() => {
    if (otpCooldownSeconds <= 0) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setOtpCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1_000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [otpCooldownSeconds]);

  const activeLoginTitle = useMemo(() => {
    switch (mode) {
      case "customer-password":
        return t("auth.login.customerTitle");
      case "driver":
        return t("auth.login.driverTitle");
      case "owner":
        return t("auth.login.ownerTitle");
      default:
        return t("auth.login.otpTitle");
    }
  }, [mode, t]);

  function runAction(action: () => Promise<void>) {
    setError(null);
    setMessage(null);
    startTransition(() => {
      void action().catch((nextError: unknown) => {
        setError(getErrorMessage(nextError, t("common.errors.genericAction"), t));
      });
    });
  }

  function handleTenantSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runAction(async () => {
      const requestedTenantCode = tenantInput.trim();
      const loginOptions = await apiClient.mobile.auth.getCustomerLoginOptions({
        tenantCode: requestedTenantCode,
      });
      const nextTenantCode = await enterTenantContext(requestedTenantCode);
      setTenantCode(nextTenantCode);
      setCustomerOtpEnabled(loginOptions.customerOtpEnabled);
      setMode("customer-password");
      setMessage(t("auth.tenant.saved"));
    });
  }

  function handleOtpRequest() {
    if (!tenantCode || !customerOtpEnabled || otpCooldownSeconds > 0) {
      return;
    }

    runAction(async () => {
      const response = await requestCustomerOtp({ tenantCode, phone });
      setTestOtp(response.code ?? null);
      setOtpCooldownSeconds(OTP_RESEND_COOLDOWN_SECONDS);
      setMessage(t("auth.login.otpSent"));
    });
  }

  function handleOtpTestFetch() {
    if (!tenantCode) {
      return;
    }

    runAction(async () => {
      const response = await getCustomerTestOtp({ tenantCode, phone });
      setTestOtp(response.code ?? null);
      setMessage(t("auth.login.testCodeFetched"));
    });
  }

  function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tenantCode) {
      setError(t("auth.login.chooseTenant"));
      return;
    }

    runAction(async () => {
      const nextSession =
        mode === "customer-otp"
          ? await verifyCustomerOtp({ tenantCode, phone, code: otp })
          : mode === "customer-password"
            ? await loginCustomerWithPassword({ tenantCode, identifier, password })
            : mode === "driver"
              ? await loginDriver({ tenantCode, identifier, password })
              : await loginOwner({ tenantCode, identifier, password });

      setSession(nextSession);
      setMessage(t("auth.login.success"));
      // Best effort: never blocks login.
      void registerPushNotificationsIfPermitted(apiClient);
    });
  }

  function handleLogout() {
    runAction(async () => {
      // Unregister the device token while the session is still valid.
      await disablePushNotifications(apiClient);
      await logoutLocally();
      setSession(null);
      setPassword("");
      setOtp("");
      setMessage(t("auth.login.logoutSuccess"));
    });
  }

  function handleTenantReset() {
    runAction(async () => {
      await disablePushNotifications(apiClient);
      await resetTenantContext();
      setTenantCode(null);
      setTenantInput("");
      setSession(null);
      setCustomerOtpEnabled(false);
      setMode("customer-password");
      setTestOtp(null);
      setOtpCooldownSeconds(0);
      setMessage(t("auth.tenant.reset"));
    });
  }

  if (isBooting) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <div className="flex items-center gap-3 rounded-md border bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
          <Loader2 className="size-4 animate-spin text-blue-600" />
          {t("auth.loading")}
        </div>
      </main>
    );
  }

  // An account still on the starter password can only choose a new one. The API
  // refuses everything else, so showing the normal home would be a screen full
  // of failed requests.
  if (
    tenantCode &&
    session &&
    session.authContext.role === "customer" &&
    session.authContext.mustChangePassword
  ) {
    return (
      <CustomerFirstPassword
        isLoggingOut={isPending}
        onChanged={async () => {
          // Re-read the context so the cleared flag is picked up; the password
          // change revokes refresh tokens, so a failure here means the session
          // is gone and signing out is the honest outcome.
          try {
            setSession({ authContext: await apiClient.mobile.auth.me() });
          } catch {
            handleLogout();
          }
        }}
        onLogout={handleLogout}
      />
    );
  }

  if (tenantCode && session) {
    return session.authContext.role === "driver" ? (
      <DeliveryHome
        currency={session.authContext.currency}
        driverName={session.authContext.displayName}
        isLoggingOut={isPending}
        onLogout={handleLogout}
      />
    ) : session.authContext.role === "owner" ? (
      <OwnerHome
        currency={session.authContext.currency}
        isLoggingOut={isPending}
        onLogout={handleLogout}
      />
    ) : (
      <CustomerHome
        initialAuthContext={session.authContext}
        isLoggingOut={isPending}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <main className="mobile-page mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-8 pt-[max(28px,env(safe-area-inset-top))]">
      <header className="mb-12 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-md bg-blue-600 text-white shadow-lg shadow-blue-600/20">
            <PackageCheck className="size-6" aria-hidden="true" />
          </div>
          <p className="text-lg font-bold uppercase text-blue-700">CleanHub</p>
        </div>
        <LanguageSwitcher />
      </header>

      <div className="mb-7">
        <h1 className="text-[36px] font-bold leading-tight text-slate-950">
          {tenantCode ? activeLoginTitle : t("auth.tenant.title")}
        </h1>
        <p className="mt-3 text-lg leading-7 text-slate-600">
          {tenantCode ? t("auth.tenant.active", { tenantCode }) : t("auth.tenant.prompt")}
        </p>
      </div>

      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 items-center justify-center rounded-md bg-blue-50 text-blue-700">
            <Building2 className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-950">{t("auth.tenant.title")}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {tenantCode
                ? t("auth.tenant.active", { tenantCode })
                : t("auth.tenant.prompt")}
            </p>
          </div>
        </div>

        {!tenantCode ? (
          <form className="mt-4 space-y-3" onSubmit={handleTenantSubmit}>
            <div className="space-y-2">
              <Label htmlFor="tenant-code">{t("auth.tenant.codeLabel")}</Label>
              <Input
                id="tenant-code"
                autoCapitalize="characters"
                autoComplete="organization"
                className="h-12 text-base"
                inputMode="text"
                placeholder="CLEAN-001"
                value={tenantInput}
                onChange={(event) => setTenantInput(event.target.value)}
              />
            </div>
            <Button className="h-12 w-full" disabled={isPending} type="submit">
              {t("common.continue")}
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </form>
        ) : (
          <div className="mt-4 flex gap-2">
            <Button className="h-11 flex-1" disabled={isPending || Boolean(session)} variant="secondary" onClick={handleTenantReset}>
              {t("common.change")}
            </Button>
          </div>
        )}

        {!tenantCode && error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </section>

      {message ? (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}

      {tenantCode && !session ? (
        <section className="mt-5 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-600">{t("auth.login.identifier")}</p>

          {error ? (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="mt-4 grid grid-cols-3 gap-2">
            {accountRoles.map((loginMode) => {
              const selected = loginMode.value === "customer-password"
                ? mode === "customer-password" || mode === "customer-otp"
                : mode === loginMode.value;
              return (
              <button
                className={`min-h-11 rounded-md border px-3 text-sm font-medium transition ${
                  selected
                    ? "border-blue-600 bg-blue-50 text-blue-900"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
                key={loginMode.value}
                type="button"
                onClick={() => {
                  setMode(loginMode.value);
                  setError(null);
                  setMessage(null);
                }}
              >
                {loginMode.label}
              </button>
              );
            })}
          </div>

          {customerOtpEnabled && (mode === "customer-password" || mode === "customer-otp") ? (
            <div className="mt-5 grid grid-cols-2 border-b border-slate-200" role="tablist">
              {(["customer-otp", "customer-password"] as const).map((loginMode) => (
                <button
                  aria-selected={mode === loginMode}
                  className={`min-h-11 border-b-2 text-sm font-semibold ${
                    mode === loginMode ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500"
                  }`}
                  key={loginMode}
                  role="tab"
                  type="button"
                  onClick={() => setMode(loginMode)}
                >
                  {t(loginMode === "customer-otp" ? "auth.login.customerOtp" : "auth.login.customerPassword")}
                </button>
              ))}
            </div>
          ) : null}

          <form className="mt-5 space-y-4" onSubmit={handleLogin}>
            {mode === "customer-otp" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t("auth.login.phone")}</Label>
                  <Input
                    id="phone"
                    autoComplete="tel"
                    className="h-12 text-base"
                    inputMode="tel"
                    placeholder="+33 6 12 34 56 78"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                </div>
                <div className={`grid gap-2 ${showTestOtp ? "grid-cols-2" : "grid-cols-1"}`}>
                  <Button
                    className="h-11"
                    disabled={isPending || !phone.trim() || otpCooldownSeconds > 0}
                    type="button"
                    variant="secondary"
                    onClick={handleOtpRequest}
                  >
                    {otpCooldownSeconds > 0
                      ? t("auth.login.resendIn", {
                          seconds: String(otpCooldownSeconds),
                        })
                      : t("auth.login.sendOtp")}
                  </Button>
                  {showTestOtp ? (
                    <Button className="h-11" disabled={isPending || !phone.trim()} type="button" variant="outline" onClick={handleOtpTestFetch}>
                      {t("auth.login.testCode")}
                    </Button>
                  ) : null}
                </div>
                {showTestOtp && testOtp ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {t("auth.login.recipeCode", { code: testOtp })}
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="otp">{t("auth.login.otpCode")}</Label>
                  <Input
                    id="otp"
                    autoComplete="one-time-code"
                    className="h-12 text-base"
                    inputMode="numeric"
                    maxLength={6}
                    pattern="[0-9]*"
                    placeholder="123456"
                    value={otp}
                    onChange={(event) =>
                      setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="identifier">{t("auth.login.identifier")}</Label>
                  <Input
                    id="identifier"
                    autoComplete="username"
                    className="h-12 text-base"
                    placeholder="nom@pressing.fr"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t("auth.login.password")}</Label>
                  <Input
                    id="password"
                    autoComplete="current-password"
                    className="h-12 text-base"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
              </>
            )}

            <Button className="h-12 w-full" disabled={isPending} type="submit">
              {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="size-4" aria-hidden="true" />}
              {t("auth.login.submit")}
            </Button>
          </form>
        </section>
      ) : null}
    </main>
  );
}
