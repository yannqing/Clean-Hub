"use client";

import { useTranslation } from "@cleanhub/i18n/react";
import { Button, Input, Label, toast } from "@cleanhub/ui";
import { KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";

import { changeCustomerPassword } from "@/features/customer/actions";

/**
 * The only screen a customer reaches while their account still carries the
 * starter password handed out at the counter.
 *
 * The API enforces this independently -- every other customer endpoint returns
 * PASSWORD_CHANGE_REQUIRED until the password changes -- so this screen exists
 * to make that state understandable, not to be the thing that enforces it.
 */
export function CustomerFirstPassword({
  isLoggingOut,
  onChanged,
  onLogout,
}: {
  isLoggingOut: boolean;
  onChanged: () => void | Promise<void>;
  onLogout: () => void;
}) {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError(t("customer.messages.passwordMismatch"));
      return;
    }

    setSubmitting(true);

    try {
      await changeCustomerPassword({ currentPassword, newPassword });
      toast.success(t("customer.messages.passwordChanged"));
      await onChanged();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : t("common.errors.genericAction"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mobile-page mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-8 pt-[max(28px,env(safe-area-inset-top))]">
      <header className="mb-8 flex items-start gap-3">
        <span className="mt-0.5 rounded-full bg-slate-900 p-2 text-white">
          <KeyRound aria-hidden className="size-4" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-slate-950">
            {t("customer.forms.firstLoginTitle")}
          </h1>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {t("customer.forms.firstLoginBody")}
          </p>
        </div>
      </header>

      <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
        <div className="grid gap-2">
          <Label htmlFor="first-current-password">
            {t("customer.forms.currentPassword")}
          </Label>
          <Input
            autoComplete="current-password"
            id="first-current-password"
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
            type="password"
            value={currentPassword}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="first-new-password">
            {t("customer.forms.newPassword")}
          </Label>
          <Input
            autoComplete="new-password"
            id="first-new-password"
            onChange={(event) => setNewPassword(event.target.value)}
            required
            type="password"
            value={newPassword}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="first-confirm-password">
            {t("customer.forms.confirmPassword")}
          </Label>
          <Input
            autoComplete="new-password"
            id="first-confirm-password"
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            type="password"
            value={confirmPassword}
          />
        </div>

        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <Button className="h-11 w-full" disabled={submitting} type="submit">
          {submitting ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : null}
          {t("customer.forms.firstLoginSubmit")}
        </Button>
      </form>

      <Button
        className="mt-3 h-11 w-full"
        disabled={isLoggingOut}
        onClick={onLogout}
        type="button"
        variant="ghost"
      >
        {t("auth.logout")}
      </Button>
    </main>
  );
}
