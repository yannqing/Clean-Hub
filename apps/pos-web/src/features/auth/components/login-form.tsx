"use client";

import { useTranslation } from "@cleanhub/i18n/react";
import { isApiHttpError } from "@cleanhub/api-client";
import { posToast as toast } from "@/lib/pos-toast";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { posApi } from "@/lib/api-client";
import { getPosApiErrorMessage } from "@/lib/api-error-message";

import { getOrCreatePosDeviceId } from "../utils/device-id";
import {
  POS_PIN_LENGTH,
  validateLoginForm,
  type LoginFormFieldErrors,
  type LoginFormValues,
} from "../validators/login-form.validator";

const initialState: LoginFormValues = {
  pin: "",
};

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
      const deviceId = await getOrCreatePosDeviceId();
      await posApi.auth.posPinLogin({
        pin,
        deviceId,
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
    const pin = value.replace(/\D/g, "").slice(0, POS_PIN_LENGTH);

    setFormState({ pin });
    setErrorMessage(null);

    if (fieldErrors.pin) {
      setFieldErrors({});
    }

    if (pin.length < POS_PIN_LENGTH) {
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
    <form className="grid gap-3 login-desktop:gap-4" onSubmit={handleSubmit}>
      <div className="login-desktop:hidden">
        <label className="sr-only" htmlFor="pin-mobile">
          {t("pos.auth.pin")}
        </label>
        <div className="relative mx-auto flex h-10 w-fit items-center justify-center gap-4">
          <input
            aria-invalid={Boolean(fieldErrors.pin)}
            autoComplete="one-time-code"
            className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0 disabled:cursor-wait"
            disabled={submitting}
            id="pin-mobile"
            inputMode="numeric"
            maxLength={POS_PIN_LENGTH}
            name="pin-mobile"
            onChange={(event) => updatePin(event.target.value)}
            pattern="[0-9]*"
            type="password"
            value={formState.pin}
          />
          {Array.from({ length: POS_PIN_LENGTH }, (_, index) => (
            <span
              aria-hidden="true"
              className={`size-3 rounded-full border transition-colors ${
                index < formState.pin.length
                  ? "border-foreground bg-foreground"
                  : fieldErrors.pin || errorMessage
                    ? "border-destructive/70"
                    : "border-muted-foreground/45"
              }`}
              key={index}
            />
          ))}
        </div>
        <p
          aria-live="polite"
          className={`mt-0.5 min-h-5 text-center text-xs font-medium ${
            fieldErrors.pin || errorMessage
              ? "text-destructive"
              : "text-muted-foreground"
          }`}
        >
          {submitting
            ? t("pos.auth.submitting")
            : fieldErrors.pin || errorMessage || ""}
        </p>
      </div>

      <div className="hidden gap-2 login-desktop:grid">
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
          maxLength={POS_PIN_LENGTH}
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

      <div className="mx-auto grid w-full max-w-[15.5rem] grid-cols-3 gap-x-7 gap-y-2.5 md:max-w-[18rem] md:gap-x-8 md:gap-y-3 login-desktop:max-w-none login-desktop:gap-2">
        {KEYPAD_KEYS.map((digit) => (
          <button
            className="flex size-[60px] items-center justify-center justify-self-center rounded-full bg-muted/80 text-2xl font-medium text-foreground transition-colors hover:bg-muted active:scale-95 active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:size-16 md:text-[26px] login-desktop:h-12 login-desktop:w-full login-desktop:rounded-xl login-desktop:border login-desktop:border-border login-desktop:bg-background login-desktop:text-lg login-desktop:font-semibold login-desktop:hover:bg-muted login-desktop:active:scale-100 login-desktop:active:bg-muted/80"
            disabled={submitting || formState.pin.length >= POS_PIN_LENGTH}
            key={digit}
            onClick={() => appendDigit(digit)}
            type="button"
          >
            {digit}
          </button>
        ))}
        <button
          className="flex size-[60px] items-center justify-center justify-self-center rounded-full px-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-30 md:size-16 login-desktop:h-12 login-desktop:w-full login-desktop:rounded-xl login-desktop:border login-desktop:border-border login-desktop:bg-muted/60 login-desktop:hover:bg-muted login-desktop:active:scale-100"
          disabled={submitting || formState.pin.length === 0}
          onClick={clearPin}
          type="button"
        >
          {t("pos.auth.clearPin")}
        </button>
        <button
          className="flex size-[60px] items-center justify-center justify-self-center rounded-full bg-muted/80 text-2xl font-medium text-foreground transition-colors hover:bg-muted active:scale-95 active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:size-16 md:text-[26px] login-desktop:h-12 login-desktop:w-full login-desktop:rounded-xl login-desktop:border login-desktop:border-border login-desktop:bg-background login-desktop:text-lg login-desktop:font-semibold login-desktop:hover:bg-muted login-desktop:active:scale-100 login-desktop:active:bg-muted/80"
          disabled={submitting || formState.pin.length >= POS_PIN_LENGTH}
          onClick={() => appendDigit("0")}
          type="button"
        >
          0
        </button>
        <button
          aria-label={t("pos.auth.deleteDigit")}
          className="flex size-[60px] items-center justify-center justify-self-center rounded-full px-2 text-xl font-medium text-muted-foreground transition-colors hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-30 md:size-16 login-desktop:h-12 login-desktop:w-full login-desktop:rounded-xl login-desktop:border login-desktop:border-border login-desktop:bg-muted/60 login-desktop:text-xs login-desktop:font-semibold login-desktop:hover:bg-muted login-desktop:active:scale-100"
          disabled={submitting || formState.pin.length === 0}
          onClick={removeLastDigit}
          type="button"
        >
          <span aria-hidden="true" className="login-desktop:hidden">
            ⌫
          </span>
          <span className="hidden login-desktop:inline">
            {t("pos.auth.deleteDigit")}
          </span>
        </button>
      </div>

      <button
        className="hidden h-12 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 login-desktop:flex"
        disabled={submitting || formState.pin.length !== POS_PIN_LENGTH}
        type="submit"
      >
        {submitting ? t("pos.auth.submitting") : t("pos.auth.submit")}
      </button>

      {errorMessage ? (
        <p className="hidden rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive login-desktop:block">
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}
