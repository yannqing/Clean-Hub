"use client";

import {
  Badge,
  Button,
  Input,
  Label,
  toast,
} from "@cleanhub/ui";
import { useCallback, useEffect, useState } from "react";

import { interpolate, useTenantI18n } from "@/i18n";

import { saveWhatsAppCredentialsAction } from "../actions";
import { emptyWhatsAppCredentialsForm } from "../constants";
import { getWhatsAppCredentialsQuery } from "../queries";
import { sendTestNotificationAction } from "../actions/send-test-notification.action";
import type {
  SendTestMessageResult,
  WhatsAppCredentialsFormValues,
  WhatsAppCredentialsState,
} from "../types";

const TOKEN_TAIL_LENGTH = 4;

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function toFormValues(
  state: WhatsAppCredentialsState | null,
): WhatsAppCredentialsFormValues {
  // The API never returns the access token — start the form with it blank so
  // the user must paste a new value to (re)save. Other fields are seeded from
  // the stored state when present.
  return {
    wabaId: state?.wabaId ?? "",
    phoneNumberId: state?.phoneNumberId ?? "",
    accessToken: "",
    templateNamespace: state?.templateNamespace ?? "",
  };
}

export function WhatsAppCredentialsForm() {
  const { m } = useTenantI18n();
  const [state, setState] = useState<WhatsAppCredentialsState | null>(null);
  const [form, setForm] = useState<WhatsAppCredentialsFormValues>(
    emptyWhatsAppCredentialsForm,
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof WhatsAppCredentialsFormValues, string>>
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [testResult, setTestResult] = useState<SendTestMessageResult | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadCredentials = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const next = await getWhatsAppCredentialsQuery();
      setState(next);
      setForm(toFormValues(next));
    } catch (error) {
      setLoadError(
        getErrorMessage(error, m.notifications.credentials.requestFailed),
      );
    } finally {
      setLoading(false);
    }
  }, [m.notifications.credentials.requestFailed]);

  useEffect(() => {
    let isCurrent = true;

    getWhatsAppCredentialsQuery()
      .then((next) => {
        if (!isCurrent) return;
        setState(next);
        setForm(toFormValues(next));
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        setLoadError(
          getErrorMessage(error, m.notifications.credentials.requestFailed),
        );
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [m.notifications.credentials.requestFailed]);

  function updateField<K extends keyof WhatsAppCredentialsFormValues>(
    key: K,
    value: WhatsAppCredentialsFormValues[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function handleSave() {
    setSaving(true);

    const result = await saveWhatsAppCredentialsAction(form);

    setSaving(false);

    if (!result.ok) {
      setErrors(result.errors);
      toast.error(result.message);
      return;
    }

    setState(result.data);
    setForm(toFormValues(result.data));
    setErrors({});
    setTestResult(null);
    toast.success(m.notifications.credentials.saveSuccess);
  }

  async function handleTest() {
    if (!testRecipient.trim()) {
      return;
    }

    setTesting(true);
    setTestResult(null);

    const result = await sendTestNotificationAction({
      channel: "whatsapp",
      recipient: testRecipient.trim(),
    });

    setTesting(false);

    if (!result.ok) {
      setTestResult({ ok: false, error: result.message });
      toast.error(m.notifications.credentials.testFailed);
      return;
    }

    setTestResult(result.data);
    toast.success(m.notifications.credentials.testSuccess);
  }

  if (loading) {
    return (
      <section className="grid gap-4 rounded-md border p-4">
        <div className="h-6 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-32 animate-pulse rounded-md bg-muted" />
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="grid gap-3 rounded-md border p-4">
        <p className="text-sm text-destructive">{loadError}</p>
        <Button
          className="w-fit"
          onClick={loadCredentials}
          type="button"
          variant="outline"
        >
          {m.common.retry}
        </Button>
      </section>
    );
  }

  const connected = state?.connected ?? false;
  const maskedTail = state?.accessTokenMasked?.slice(-TOKEN_TAIL_LENGTH) ?? "";

  return (
    <section className="grid gap-4 rounded-md border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">
            {m.notifications.credentials.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {m.notifications.credentials.description}
          </p>
        </div>
        <Badge variant={connected ? "default" : "outline"}>
          {connected
            ? m.notifications.credentials.statusConnected
            : m.notifications.credentials.statusNotConnected}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="whatsapp-waba-id">
            {m.notifications.credentials.fields.wabaId} *
          </Label>
          <Input
            aria-invalid={Boolean(errors.wabaId)}
            id="whatsapp-waba-id"
            onChange={(event) => updateField("wabaId", event.target.value)}
            placeholder={m.notifications.credentials.fields.wabaIdPlaceholder}
            value={form.wabaId}
          />
          {errors.wabaId ? (
            <p className="text-xs text-destructive">{errors.wabaId}</p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="whatsapp-phone-id">
            {m.notifications.credentials.fields.phoneNumberId} *
          </Label>
          <Input
            aria-invalid={Boolean(errors.phoneNumberId)}
            id="whatsapp-phone-id"
            onChange={(event) =>
              updateField("phoneNumberId", event.target.value)
            }
            placeholder={
              m.notifications.credentials.fields.phoneNumberIdPlaceholder
            }
            value={form.phoneNumberId}
          />
          {errors.phoneNumberId ? (
            <p className="text-xs text-destructive">{errors.phoneNumberId}</p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="whatsapp-access-token">
            {m.notifications.credentials.fields.accessToken} *
          </Label>
          <Input
            aria-invalid={Boolean(errors.accessToken)}
            autoComplete="off"
            id="whatsapp-access-token"
            onChange={(event) =>
              updateField("accessToken", event.target.value)
            }
            placeholder={
              connected
                ? m.notifications.credentials.tokenPlaceholder
                : m.notifications.credentials.fields.accessTokenPlaceholder
            }
            type="password"
            value={form.accessToken}
          />
          {connected && maskedTail ? (
            <p className="text-xs text-muted-foreground">
              {interpolate(m.notifications.credentials.tokenMasked, {
                tail: maskedTail,
              })}
            </p>
          ) : null}
          {connected && !form.accessToken ? (
            <p className="text-xs text-muted-foreground">
              {m.notifications.credentials.tokenHidden}
            </p>
          ) : null}
          {errors.accessToken ? (
            <p className="text-xs text-destructive">{errors.accessToken}</p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="whatsapp-namespace">
            {m.notifications.credentials.fields.templateNamespace}
          </Label>
          <Input
            aria-invalid={Boolean(errors.templateNamespace)}
            id="whatsapp-namespace"
            onChange={(event) =>
              updateField("templateNamespace", event.target.value)
            }
            placeholder={
              m.notifications.credentials.fields.templateNamespacePlaceholder
            }
            value={form.templateNamespace}
          />
          {errors.templateNamespace ? (
            <p className="text-xs text-destructive">
              {errors.templateNamespace}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
        <Button disabled={saving} onClick={handleSave} type="button">
          {saving
            ? m.notifications.credentials.saving
            : m.notifications.credentials.saveButton}
        </Button>
      </div>

      <div className="grid gap-2 rounded-md border bg-muted/30 p-3">
        <Label htmlFor="whatsapp-test-recipient">
          {m.notifications.credentials.testRecipientLabel}
        </Label>
        <div className="flex flex-wrap gap-2">
          <Input
            className="max-w-xs"
            id="whatsapp-test-recipient"
            onChange={(event) => setTestRecipient(event.target.value)}
            placeholder={m.notifications.credentials.testRecipientPlaceholder}
            value={testRecipient}
          />
          <Button
            disabled={testing || !testRecipient.trim()}
            onClick={handleTest}
            type="button"
            variant="outline"
          >
            {testing
              ? m.notifications.credentials.testing
              : m.notifications.credentials.testConnection}
          </Button>
        </div>
        {testResult ? (
          <p
            className={`text-xs ${
              testResult.ok ? "text-muted-foreground" : "text-destructive"
            }`}
          >
            {testResult.ok
              ? interpolate(m.notifications.credentials.testResultOk, {
                  messageId: testResult.messageId ?? "",
                })
              : testResult.error ?? m.notifications.credentials.testFailed}
          </p>
        ) : null}
      </div>
    </section>
  );
}
