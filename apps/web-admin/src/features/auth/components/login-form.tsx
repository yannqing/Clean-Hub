"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input, Label, cn, toast } from "@cleanhub/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { webAdminRoutes } from "@/config/routes";

import { loginBrowserSessionAction } from "../actions/browser-session.action";
import { getOrCreateWebAdminDeviceId } from "../utils";
import {
  loginFormSchema,
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

function resolveHomePath(role: string): string {
  if (role === "super_admin" || role === "support") {
    return webAdminRoutes.saas.home;
  }

  return webAdminRoutes.tenant.home;
}

function isSafeInternalPath(path: string | null): path is string {
  return Boolean(path) && path!.startsWith("/") && !path!.startsWith("//");
}

function isPathAllowedForRole(path: string, role: string): boolean {
  if (role === "super_admin" || role === "support") {
    return (
      path === webAdminRoutes.saas.home ||
      path.startsWith(`${webAdminRoutes.saas.home}/`)
    );
  }

  return (
    path === webAdminRoutes.tenant.home ||
    path.startsWith(`${webAdminRoutes.tenant.home}/`)
  );
}

function resolvePostLoginPath(role: string): string {
  const defaultPath = resolveHomePath(role);

  if (typeof window === "undefined") {
    return defaultPath;
  }

  const nextPath = new URLSearchParams(window.location.search).get("next");

  if (isSafeInternalPath(nextPath) && isPathAllowedForRole(nextPath, role)) {
    return nextPath;
  }

  return defaultPath;
}

const LOGIN_MODE_OPTIONS: {
  value: LoginMode;
  label: string;
  description: string;
}[] = [
  {
    value: "tenant",
    label: "Store admin",
    description: "Owner or manager for a laundry / pressing business",
  },
  {
    value: "platform",
    label: "Platform admin",
    description: "CleanHub SaaS operations (super admin / support)",
  },
];

export function LoginForm() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    defaultValues,
    resolver: zodResolver(loginFormSchema),
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

    setErrorMessage(null);
  }

  async function submit(values: LoginFormValues) {
    setErrorMessage(null);

    const result = await loginAction({
      ...values,
      deviceId: getOrCreateWebAdminDeviceId(),
    });

    if (!result.ok) {
      // Map server-side field errors back onto react-hook-form so the inline
      // messages stay consistent with the resolver-driven ones.
      for (const [field, message] of Object.entries(result.errors)) {
        if (typeof message === "string") {
          setError(field as LoginFormField, { message });
        }
      }

      setErrorMessage(result.message);
      toast.error(result.message);
      return;
    }

    toast.success("Signed in successfully.");
    router.replace(resolvePostLoginPath(result.data.role));
    router.refresh();
  }

  return (
    <form
      className="mt-8 grid gap-5 rounded-lg border border-border bg-background p-6 shadow-sm"
      onSubmit={handleSubmit(submit)}
      noValidate
    >
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Sign in as</legend>
        <div
          className="grid gap-2 sm:grid-cols-2"
          role="radiogroup"
          aria-label="Sign in as"
        >
          {LOGIN_MODE_OPTIONS.map((option) => {
            const selected = loginMode === option.value;

            return (
              <button
                key={option.value}
                aria-checked={selected}
                className={cn(
                  "rounded-lg border px-3 py-3 text-left transition-colors",
                  selected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
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
          <Label htmlFor="tenantCode">Pressing code</Label>
          <Input
            aria-invalid={Boolean(errors.tenantCode)}
            autoComplete="organization"
            id="tenantCode"
            placeholder="e.g. SN-0042"
            type="text"
            {...register("tenantCode")}
          />
          <p className="text-xs text-muted-foreground">
            The store code assigned by CleanHub. Required for store administrators.
          </p>
          {errors.tenantCode ? (
            <p className="text-xs text-destructive">{errors.tenantCode.message}</p>
          ) : null}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground">
          Platform administrators sign in with email and password only. Do not
          enter a pressing code.
        </p>
      )}

      <div className="grid gap-2">
        <Label htmlFor="identifier">Email or phone</Label>
        <Input
          aria-invalid={Boolean(errors.identifier)}
          autoComplete="username"
          id="identifier"
          placeholder="admin@cleanhub.local"
          type="text"
          {...register("identifier")}
        />
        {errors.identifier ? (
          <p className="text-xs text-destructive">{errors.identifier.message}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          aria-invalid={Boolean(errors.password)}
          autoComplete="current-password"
          id="password"
          placeholder="Enter password"
          type="password"
          {...register("password")}
        />
        {errors.password ? (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        ) : null}
      </div>

      {errorMessage ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <Button disabled={isSubmitting} type="submit">
        {isSubmitting ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
