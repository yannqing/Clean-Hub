"use client";

import { RESET_USER_PASSWORD, RESET_USER_PIN } from "@cleanhub/domain/initial-owner-credentials";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
  toast,
} from "@cleanhub/ui";
import { useId, useState } from "react";
import { useSaasI18n } from "@/i18n";
import { interpolate } from "@/i18n/messages/saas";
import { resetUserCredentialAction } from "../actions/reset-user-credential.action";

export type UserCredentialResetTarget = {
  userId: string;
  displayName: string;
  credential: "password" | "pin";
};

export function UserCredentialResetDialog({
  target,
  onClose,
}: {
  target: UserCredentialResetTarget;
  onClose: () => void;
}) {
  const { m } = useSaasI18n();
  const reasonId = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [value, setValue] = useState<string | null>(null);
  const copy =
    target.credential === "pin" ? m.users.resetPin : m.users.resetPassword;
  const defaultValue = target.credential === "pin" ? RESET_USER_PIN : RESET_USER_PASSWORD;

  async function handleReset() {
    if (submitting) return;
    if (!reason.trim()) {
      setError(copy.reasonRequired);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await resetUserCredentialAction(
        target.userId,
        target.credential,
        reason,
      );
      if (!result.ok) {
        setError(
          "code" in result && result.code === "SAAS_USER_PIN_CONFLICT"
            ? interpolate(m.users.resetPin.conflict, { value: RESET_USER_PIN })
            : result.error,
        );
        return;
      }
      setValue(result.value);
      setReason("");
      toast.success(copy.success);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !submitting) onClose();
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        onEscapeKeyDown={(event) => {
          if (submitting) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (submitting) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {value === null ? copy.title : copy.resultTitle}
          </DialogTitle>
          <DialogDescription>
            {interpolate(value === null ? copy.description : copy.resultWarning, {
              value: defaultValue,
            })}
          </DialogDescription>
        </DialogHeader>
        <p className="break-words text-sm font-medium">{target.displayName}</p>
        {value === null ? (
          <div className="grid gap-2">
            <Label htmlFor={reasonId}>{copy.reason}</Label>
            <Textarea
              id={reasonId}
              aria-invalid={Boolean(error)}
              disabled={submitting}
              maxLength={500}
              rows={4}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setError(null);
              }}
            />
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        ) : (
          <p
            className="break-all rounded-md border bg-muted/30 p-4 text-center font-mono text-xl font-semibold"
            aria-live="polite"
          >
            {value}
          </p>
        )}
        <DialogFooter>
          {value === null ? (
            <>
              <Button
                disabled={submitting}
                type="button"
                variant="outline"
                onClick={onClose}
              >
                {m.common.cancel}
              </Button>
              <Button
                disabled={submitting || !reason.trim()}
                type="button"
                variant="destructive"
                onClick={() => {
                  void handleReset();
                }}
              >
                {submitting ? m.common.saving : copy.submit}
              </Button>
            </>
          ) : (
            <Button type="button" onClick={onClose}>
              {copy.done}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
