"use client";

import type { AuthContext } from "@cleanhub/api-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input, Label, cn, toast } from "@cleanhub/ui";
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
    description: string;
  }[] = [
    {
      value: "tenant",
      label: auth.tenantModeLabel,
      description: auth.tenantModeDescription,
    },
    {
      value: "platform",
      label: auth.platformModeLabel,
      description: auth.platformModeDescription,
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
      className="mt-8 grid gap-5 rounded-lg border border-border bg-background p-6 shadow-sm"
      onSubmit={handleSubmit(submit)}
      noValidate
    >
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">{auth.signInAs}</legend>
        <div
          className="grid gap-2 sm:grid-cols-2"
          role="radiogroup"
          aria-label={auth.signInAs}
        >
          {loginModeOptions.map((option) => {
            const selected = loginMode === option.value;

            return (
              <button
                key={option.value}
                aria-checked={selected}
                className={cn(
                  "rounded-lg border px-3 py-3 text-left transition-colors",
                  selected
                    ? "border-foreground bg-muted/60 ring-1 ring-foreground"
                    : "border-border bg-background hover:bg-muted/40",
                )}
                onClick={() => setLoginMode(option.value)}
                role="radio"
                type="button"
              >
                <span className="block text-sm font-semibold">
                  {option.label}
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {isTenantLogin ? (
        <div className="grid gap-2">
          <Label htmlFor="tenantCode">{auth.tenantCodeLabel}</Label>
          <Input
            aria-invalid={Boolean(errors.tenantCode)}
            autoComplete="organization"
            id="tenantCode"
            placeholder={auth.tenantCodePlaceholder}
            type="text"
            {...register("tenantCode")}
          />
          <p className="text-xs text-muted-foreground">
            {auth.tenantCodeHint}
          </p>
          {errors.tenantCode ? (
            <p className="text-xs text-destructive">
              {auth.validation.tenantCodeRequired}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground">
          {auth.platformHint}
        </p>
      )}

      <div className="grid gap-2">
        <Label htmlFor="identifier">{auth.identifierLabel}</Label>
        <Input
          aria-invalid={Boolean(errors.identifier)}
          autoComplete="username"
          id="identifier"
          placeholder={auth.identifierPlaceholder}
          type="text"
          {...register("identifier")}
        />
        {errors.identifier ? (
          <p className="text-xs text-destructive">
            {auth.validation.identifierRequired}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">{auth.passwordLabel}</Label>
        <Input
          aria-invalid={Boolean(errors.password)}
          autoComplete="current-password"
          id="password"
          placeholder={auth.passwordPlaceholder}
          type="password"
          {...register("password")}
        />
        {errors.password ? (
          <p className="text-xs text-destructive">
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
        className="h-10"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? auth.submitting : auth.submit}
      </Button>
    </form>
  );
}
