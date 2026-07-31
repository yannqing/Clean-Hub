"use client";

import { useTranslation } from "@cleanhub/i18n/react";
import { isApiHttpError } from "@cleanhub/api-client";
import { posToast as toast } from "@/lib/pos-toast";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { posTenantCode } from "@/config/tenant";
import { posApi } from "@/lib/api-client";
import { getPosApiErrorMessage } from "@/lib/api-error-message";

import { getOrCreatePosDeviceId } from "../utils/device-id";
import {
  validateLoginForm,
  type LoginFormFieldErrors,
  type LoginFormValues,
} from "../validators/login-form.validator";

const initialState: LoginFormValues = {
  pin: "",
};

const PIN_LENGTH = 6;
const KEYPAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

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
  const { t } = useTranslation();
  const [formState, setFormState] = useState<LoginFormValues>(initialState);
  const [fieldErrors, setFieldErrors] = useState<LoginFormFieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittedPinRef = useRef<string | null>(null);

  async function submitPin(pin: string) {
    if (submitting || submittedPinRef.current === pin) {
      return;
    }

    submittedPinRef.current = pin;
    setErrorMessage(null);

    if (!posTenantCode) {
      const message = t("pos.auth.missingTenantCode");
      submittedPinRef.current = null;
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    const validationErrors = validateLoginForm(
      { pin },
      {
        pinRequired: t("pos.auth.validation.pinRequired"),
        pinInvalid: t("pos.auth.validation.pinInvalid"),
      },
    );
    if (validationErrors) {
      submittedPinRef.current = null;
      setFieldErrors(validationErrors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    try {
      await posApi.auth.posPinLogin({
        pin,
        tenantCode: posTenantCode,
        deviceId: getOrCreatePosDeviceId(),
      });

      toast.success(t("pos.auth.loginSuccess"));
      router.replace(resolvePostLoginPath());
      router.refresh();
    } catch (error) {
      const fallback = t("pos.auth.loginFailed");
      const message = isApiHttpError(error)
        ? getPosApiErrorMessage(error, fallback)
        : fallback;
      setErrorMessage(message);
      setFormState(initialState);
      submittedPinRef.current = null;
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitPin(formState.pin);
  }

  function updatePin(value: string) {
    const pin = value.replace(/\D/g, "").slice(0, PIN_LENGTH);

    setFormState({ pin });
    setErrorMessage(null);

    if (fieldErrors.pin) {
      setFieldErrors({});
    }

    if (pin.length < PIN_LENGTH) {
      submittedPinRef.current = null;
      return;
    }

    void submitPin(pin);
  }

  function appendDigit(digit: string) {
    updatePin(`${formState.pin}${digit}`);
  }

  function removeLastDigit() {
    updatePin(formState.pin.slice(0, -1));
  }

  function clearPin() {
    updatePin("");
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <label className="text-sm font-semibold text-foreground" htmlFor="pin">
          {t("pos.auth.pin")}
        </label>
        <input
          aria-invalid={Boolean(fieldErrors.pin)}
          autoComplete="one-time-code"
          className="h-12 w-full rounded-xl border border-border bg-muted/50 px-3 text-center text-xl font-semibold tracking-[0.16em] text-foreground outline-none transition-colors placeholder:text-sm placeholder:font-medium placeholder:tracking-normal placeholder:text-muted-foreground focus:border-ring focus:bg-background focus:ring-2 focus:ring-ring/20 aria-invalid:border-destructive disabled:cursor-wait disabled:opacity-60"
          disabled={submitting}
          id="pin"
          inputMode="numeric"
          maxLength={PIN_LENGTH}
          name="pin"
          onChange={(event) => updatePin(event.target.value)}
          pattern="[0-9]*"
          placeholder={t("pos.auth.pinPlaceholder")}
          required
          type="password"
          value={formState.pin}
        />
        {fieldErrors.pin ? (
          <p className="text-xs text-destructive">{fieldErrors.pin}</p>
        ) : null}
        {submitting ? (
          <p className="text-center text-xs font-medium text-muted-foreground">
            {t("pos.auth.submitting")}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {KEYPAD_KEYS.map((digit) => (
          <button
            className="flex h-12 items-center justify-center rounded-xl border border-border bg-background text-lg font-semibold text-foreground transition-colors hover:bg-muted active:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            disabled={submitting}
            key={digit}
            onClick={() => appendDigit(digit)}
            type="button"
          >
            {digit}
          </button>
        ))}
        <button
          className="flex h-12 items-center justify-center rounded-xl border border-border bg-muted/60 px-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          disabled={submitting || formState.pin.length === 0}
          onClick={clearPin}
          type="button"
        >
          {t("pos.auth.clearPin")}
        </button>
        <button
          className="flex h-12 items-center justify-center rounded-xl border border-border bg-background text-lg font-semibold text-foreground transition-colors hover:bg-muted active:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          disabled={submitting}
          onClick={() => appendDigit("0")}
          type="button"
        >
          0
        </button>
        <button
          className="flex h-12 items-center justify-center rounded-xl border border-border bg-muted/60 px-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          disabled={submitting || formState.pin.length === 0}
          onClick={removeLastDigit}
          type="button"
        >
          {t("pos.auth.deleteDigit")}
        </button>
      </div>

      {errorMessage ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      {posTenantCode ? (
        <p className="border-t border-border pt-3 text-center text-xs text-muted-foreground">
          {t("pos.auth.currentStore")}
          <span className="font-semibold text-foreground">{posTenantCode}</span>
        </p>
      ) : null}
    </form>
  );
}
