"use client";

import { toast } from "@cleanhub/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { posTenantCode } from "@/config/tenant";
import { posApi } from "@/lib/api-client";

import { getOrCreatePosDeviceId } from "../utils/device-id";
import {
  validateLoginForm,
  type LoginFormFieldErrors,
  type LoginFormValues,
} from "../validators/login-form.validator";

const initialState: LoginFormValues = {
  identifier: "",
  password: "",
};

function isSafeInternalPath(path: string | null): path is string {
  return Boolean(path) && path!.startsWith("/") && !path!.startsWith("//");
}

function resolvePostLoginPath(): string {
  if (typeof window === "undefined") {
    return "/";
  }

  const nextPath = new URLSearchParams(window.location.search).get("next");
  return isSafeInternalPath(nextPath) ? nextPath : "/";
}

export function LoginForm() {
  const router = useRouter();
  const [formState, setFormState] = useState<LoginFormValues>(initialState);
  const [fieldErrors, setFieldErrors] = useState<LoginFormFieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!posTenantCode) {
      const message =
        "本终端尚未配置门店编码（POS_TENANT_CODE），请联系管理员。";
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    const validationErrors = validateLoginForm(formState);
    if (validationErrors) {
      setFieldErrors(validationErrors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    try {
      await posApi.auth.login({
        identifier: formState.identifier.trim(),
        password: formState.password,
        tenantCode: posTenantCode,
        deviceId: getOrCreatePosDeviceId(),
      });

      toast.success("登录成功");
      router.replace(resolvePostLoginPath());
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "登录失败，请重试。";
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

  return (
    <form className="grid gap-5" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <label
          className="text-sm font-semibold text-slate-700"
          htmlFor="identifier"
        >
          手机号 / 邮箱
        </label>
        <input
          aria-invalid={Boolean(fieldErrors.identifier)}
          autoComplete="username"
          className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:shadow-[0_0_0_4px_rgba(37,99,235,0.10)]"
          id="identifier"
          name="identifier"
          onChange={(event) => updateField("identifier", event.target.value)}
          placeholder="请输入手机号或邮箱"
          required
          type="text"
          value={formState.identifier}
        />
        {fieldErrors.identifier ? (
          <p className="text-xs text-red-500">{fieldErrors.identifier}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <label
          className="text-sm font-semibold text-slate-700"
          htmlFor="password"
        >
          密码
        </label>
        <input
          aria-invalid={Boolean(fieldErrors.password)}
          autoComplete="current-password"
          className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:shadow-[0_0_0_4px_rgba(37,99,235,0.10)]"
          id="password"
          name="password"
          onChange={(event) => updateField("password", event.target.value)}
          placeholder="请输入密码"
          required
          type="password"
          value={formState.password}
        />
        {fieldErrors.password ? (
          <p className="text-xs text-red-500">{fieldErrors.password}</p>
        ) : null}
      </div>

      {errorMessage ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {errorMessage}
        </p>
      ) : null}

      <button
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={submitting}
        type="submit"
      >
        {submitting ? "登录中…" : "登录"}
      </button>

      {posTenantCode ? (
        <p className="text-center text-xs text-slate-400">
          当前门店：
          <span className="font-semibold text-slate-500">
            {posTenantCode}
          </span>
        </p>
      ) : null}
    </form>
  );
}
