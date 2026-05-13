"use client";

import { Button, Input, Label, toast } from "@cleanhub/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { webAdminApi } from "@/lib/api-client";

import { getOrCreateWebAdminDeviceId } from "../utils";

type LoginFormState = {
  identifier: string;
  password: string;
  tenantCode: string;
};

const initialState: LoginFormState = {
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

export function LoginForm() {
  const router = useRouter();
  const [formState, setFormState] = useState<LoginFormState>(initialState);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      const result = await webAdminApi.auth.login({
        identifier: formState.identifier,
        password: formState.password,
        tenantCode: formState.tenantCode.trim() || undefined,
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

  function updateField(field: keyof LoginFormState, value: string) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  }

  return (
    <form
      className="mt-8 grid gap-5 rounded-lg border border-border bg-background p-6 shadow-sm"
      onSubmit={handleSubmit}
    >
      <div className="grid gap-2">
        <Label htmlFor="identifier">Email or phone</Label>
        <Input
          autoComplete="username"
          id="identifier"
          name="identifier"
          onChange={(event) => updateField("identifier", event.target.value)}
          placeholder="admin@cleanhub.local"
          required
          type="text"
          value={formState.identifier}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          autoComplete="current-password"
          id="password"
          name="password"
          onChange={(event) => updateField("password", event.target.value)}
          placeholder="Enter password"
          required
          type="password"
          value={formState.password}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="tenantCode">Tenant code</Label>
        <Input
          autoComplete="organization"
          id="tenantCode"
          name="tenantCode"
          onChange={(event) => updateField("tenantCode", event.target.value)}
          placeholder="Optional for SaaS Admin"
          type="text"
          value={formState.tenantCode}
        />
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
