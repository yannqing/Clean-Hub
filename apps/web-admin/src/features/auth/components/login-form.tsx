"use client";

import { Button, Input, Label, cn, toast } from "@cleanhub/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { webAdminApi } from "@/lib/api-client";

import { getOrCreateWebAdminDeviceId } from "../utils";
import {
  validateLoginForm,
  type LoginFormFieldErrors,
  type LoginFormValues,
  type LoginMode,
} from "../validators/login-form.validator";

const initialState: LoginFormValues = {
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
  const [formState, setFormState] = useState<LoginFormValues>(initialState);
  const [fieldErrors, setFieldErrors] = useState<LoginFormFieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isTenantLogin = formState.loginMode === "tenant";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const validationErrors = validateLoginForm(formState);
    if (validationErrors) {
      setFieldErrors(validationErrors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    try {
      const tenantCode = isTenantLogin
        ? formState.tenantCode.trim()
        : undefined;

      const result = await webAdminApi.auth.login({
        identifier: formState.identifier,
        password: formState.password,
        tenantCode,
        deviceId: getOrCreateWebAdminDeviceId(),
      });

      toast.success("Signed in successfully.");
      router.replace(resolvePostLoginPath(result.authContext.role));
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to sign in.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  function updateField<K extends keyof LoginFormValues>(
    field: K,
    value: LoginFormValues[K],
  ) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));

    if (fieldErrors[field]) {
      setFieldErrors((current) => {
        const next = { ...current };
        delete next[field];
        return next;
      });
    }
  }

  function setLoginMode(mode: LoginMode) {
    setFormState((current) => ({
      ...current,
      loginMode: mode,
      tenantCode: mode === "platform" ? "" : current.tenantCode,
    }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.tenantCode;
      return next;
    });
    setErrorMessage(null);
  }

  return (
    <form
      className="mt-8 grid gap-5 rounded-lg border border-border bg-background p-6 shadow-sm"
      onSubmit={handleSubmit}
    >
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Sign in as</legend>
        <div
          className="grid gap-2 sm:grid-cols-2"
          role="radiogroup"
          aria-label="Sign in as"
        >
          {LOGIN_MODE_OPTIONS.map((option) => {
            const selected = formState.loginMode === option.value;

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
            aria-invalid={Boolean(fieldErrors.tenantCode)}
            autoComplete="organization"
            id="tenantCode"
            name="tenantCode"
            onChange={(event) => updateField("tenantCode", event.target.value)}
            placeholder="e.g. SN-0042"
            required
            type="text"
            value={formState.tenantCode}
          />
          <p className="text-xs text-muted-foreground">
            The store code assigned by CleanHub. Required for store administrators.
          </p>
          {fieldErrors.tenantCode ? (
            <p className="text-xs text-destructive">{fieldErrors.tenantCode}</p>
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
          aria-invalid={Boolean(fieldErrors.identifier)}
          autoComplete="username"
          id="identifier"
          name="identifier"
          onChange={(event) => updateField("identifier", event.target.value)}
          placeholder="admin@cleanhub.local"
          required
          type="text"
          value={formState.identifier}
        />
        {fieldErrors.identifier ? (
          <p className="text-xs text-destructive">{fieldErrors.identifier}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          aria-invalid={Boolean(fieldErrors.password)}
          autoComplete="current-password"
          id="password"
          name="password"
          onChange={(event) => updateField("password", event.target.value)}
          placeholder="Enter password"
          required
          type="password"
          value={formState.password}
        />
        {fieldErrors.password ? (
          <p className="text-xs text-destructive">{fieldErrors.password}</p>
        ) : null}
      </div>

      {errorMessage ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <Button className="w-full" disabled={submitting} type="submit">
        {submitting ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
