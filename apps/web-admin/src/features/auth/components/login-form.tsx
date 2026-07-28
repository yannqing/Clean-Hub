"use client";

import type { AuthContext } from "@cleanhub/api-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Icon, Input, Label, cn, toast } from "@cleanhub/ui";
import {
  Building2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { getWebAdminHomePath } from "@/config/auth-routing";
import { webAdminRoutes } from "@/config/routes";
import { useWebAdminLocale } from "@/i18n";

import { loginAction } from "../actions/login.action";
import { getOrCreateWebAdminDeviceId } from "../utils";
import {
  createLoginFormSchema,
  type LoginFormField,
  type LoginFormValues,
  type LoginMode,
} from "../validators/login-form.validator";

const defaultValues: LoginFormValues = {
  loginMode: "tenant",
  identifier: "",
  password: "",
  tenantCode: "",
};

function isSafeInternalPath(path: string | null): path is string {
  return Boolean(path) && path!.startsWith("/") && !path!.startsWith("//");
}

function isPathAllowedForHome(path: string, homePath: "/saas" | "/tenant") {
  return (
    path === homePath ||
    path.startsWith(`${homePath}/`)
  );
}

function resolvePostLoginPath(
  authContext: Pick<AuthContext, "role" | "tenantId">,
): string {
  const defaultPath = getWebAdminHomePath(authContext);

  if (!defaultPath) {
    return webAdminRoutes.login;
  }

  if (typeof window === "undefined") {
    return defaultPath;
  }

  const nextPath = new URLSearchParams(window.location.search).get("next");

  if (
    isSafeInternalPath(nextPath) &&
    isPathAllowedForHome(nextPath, defaultPath)
  ) {
    return nextPath;
  }

  return defaultPath;
}

export function LoginForm() {
  const router = useRouter();
  const { messages } = useWebAdminLocale();
  const auth = messages.auth;
  const [errorCode, setErrorCode] = useState<
    "invalidForm" | "accessDenied" | "signInFailed" | null
  >(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const errorMessage =
    errorCode === "invalidForm"
      ? auth.errors.checkForm
      : errorCode === "accessDenied"
        ? auth.errors.accessDenied
        : errorCode === "signInFailed"
          ? auth.errors.signInFailed
          : null;
  const localizedLoginFormSchema = useMemo(
    () => createLoginFormSchema(auth.validation),
    [auth.validation],
  );
  const loginModeOptions: {
    value: LoginMode;
    label: string;
  }[] = [
    {
      value: "tenant",
      label: auth.tenantModeLabel,
    },
    {
      value: "platform",
      label: auth.platformModeLabel,
    },
  ];
  const localizedFieldErrors: Partial<Record<LoginFormField, string>> = {
    identifier: auth.validation.identifierRequired,
    password: auth.validation.passwordRequired,
    tenantCode: auth.validation.tenantCodeRequired,
  };

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    defaultValues,
    resolver: zodResolver(localizedLoginFormSchema),
    mode: "onSubmit",
  });

  // `useWatch` returns a stable subscription value (unlike `watch()`, which
  // returns a fresh function each render and trips React Compiler's
  // incompatible-library check).
  const loginMode = useWatch({ control, name: "loginMode" });
  const isTenantLogin = loginMode === "tenant";

  function setLoginMode(mode: LoginMode) {
    setValue("loginMode", mode, { shouldValidate: false });

    // `tenantCode` is only relevant for store login; clear it when switching
    // away so a stale value cannot satisfy the schema after the field is hidden.
    if (mode === "platform") {
      setValue("tenantCode", "", { shouldValidate: false });
    }

    setErrorCode(null);
  }

  async function submit(values: LoginFormValues) {
    setErrorCode(null);

    const result = await loginAction({
      ...values,
      deviceId: getOrCreateWebAdminDeviceId(),
    });

    if (!result.ok) {
      const localizedMessage =
        result.errorCode === "invalidForm"
          ? auth.errors.checkForm
          : result.errorCode === "accessDenied"
            ? auth.errors.accessDenied
            : auth.errors.signInFailed;

      // Map server-side field errors back onto react-hook-form so the inline
      // messages stay consistent with the resolver-driven ones.
      for (const [field, message] of Object.entries(result.errors)) {
        if (typeof message === "string") {
          setError(field as LoginFormField, {
            message:
              localizedFieldErrors[field as LoginFormField] ?? message,
          });
        }
      }

      setErrorCode(result.errorCode);
      toast.error(localizedMessage);
      return;
    }

    toast.success(auth.signedIn);
    router.replace(resolvePostLoginPath(result.data));
    router.refresh();
  }

  return (
    <form
      className="mt-7 grid gap-4 rounded-2xl border border-zinc-950/10 bg-white/[0.96] p-5 shadow-[0_28px_80px_-34px_rgba(0,0,0,0.58)] backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-950/[0.88] dark:shadow-[0_24px_70px_-32px_rgba(0,0,0,0.8)] sm:p-6"
      onSubmit={handleSubmit(submit)}
      noValidate
    >
      <fieldset>
        <legend className="sr-only">{auth.signInAs}</legend>
        <div
          className="grid gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900 sm:grid-cols-2"
          role="radiogroup"
          aria-label={auth.signInAs}
        >
          {loginModeOptions.map((option) => {
            const selected = loginMode === option.value;
            const ModeIcon = option.value === "tenant" ? Building2 : ShieldCheck;

            return (
              <button
                key={option.value}
                aria-checked={selected}
                className={cn(
                  "flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-[background-color,box-shadow,color]",
                  selected
                    ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-zinc-600 hover:bg-white/70 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-50",
                )}
                onClick={() => setLoginMode(option.value)}
                role="radio"
                type="button"
              >
                <Icon aria-hidden icon={ModeIcon} size={16} />
                <span className="block text-sm font-semibold">{option.label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {isTenantLogin ? (
        <div>
          <Label className="sr-only" htmlFor="tenantCode">
            {auth.tenantCodeLabel}
          </Label>
          <div className="relative">
            <Icon
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              icon={Building2}
              size={17}
            />
            <Input
              aria-invalid={Boolean(errors.tenantCode)}
              autoComplete="organization"
              className="h-11 rounded-lg bg-zinc-50 pl-10 dark:bg-zinc-900"
              id="tenantCode"
              placeholder={auth.tenantCodePlaceholder}
              type="text"
              {...register("tenantCode")}
            />
          </div>
          {errors.tenantCode ? (
            <p className="mt-1.5 text-xs text-destructive">
              {auth.validation.tenantCodeRequired}
            </p>
          ) : null}
        </div>
      ) : null}

      <div>
        <Label className="sr-only" htmlFor="identifier">
          {auth.identifierLabel}
        </Label>
        <div className="relative">
          <Icon
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
            icon={Mail}
            size={17}
          />
          <Input
            aria-invalid={Boolean(errors.identifier)}
            autoComplete="username"
            className="h-11 rounded-lg bg-zinc-50 pl-10 dark:bg-zinc-900"
            id="identifier"
            placeholder={auth.identifierPlaceholder}
            type="text"
            {...register("identifier")}
          />
        </div>
        {errors.identifier ? (
          <p className="mt-1.5 text-xs text-destructive">
            {auth.validation.identifierRequired}
          </p>
        ) : null}
      </div>

      <div>
        <Label className="sr-only" htmlFor="password">
          {auth.passwordLabel}
        </Label>
        <div className="relative">
          <Icon
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
            icon={KeyRound}
            size={17}
          />
          <Input
            aria-invalid={Boolean(errors.password)}
            autoComplete="current-password"
            className="h-11 rounded-lg bg-zinc-50 pl-10 pr-11 dark:bg-zinc-900"
            id="password"
            placeholder={auth.passwordPlaceholder}
            type={passwordVisible ? "text" : "password"}
            {...register("password")}
          />
          <Button
            aria-label={
              passwordVisible ? auth.passwordHide : auth.passwordShow
            }
            className="absolute right-1 top-1/2 size-9 -translate-y-1/2 text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
            onClick={() => setPasswordVisible((visible) => !visible)}
            size="icon-sm"
            title={passwordVisible ? auth.passwordHide : auth.passwordShow}
            type="button"
            variant="ghost"
          >
            <Icon
              aria-hidden
              icon={passwordVisible ? EyeOff : Eye}
              size={16}
            />
          </Button>
        </div>
        {errors.password ? (
          <p className="mt-1.5 text-xs text-destructive">
            {auth.validation.passwordRequired}
          </p>
        ) : null}
      </div>

      {errorMessage ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <Button
        className="h-11 rounded-lg bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? (
          <Icon aria-hidden className="animate-spin" icon={LoaderCircle} size={16} />
        ) : null}
        {isSubmitting ? auth.submitting : auth.submit}
      </Button>
    </form>
  );
}
