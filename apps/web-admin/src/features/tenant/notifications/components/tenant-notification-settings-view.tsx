"use client";

import {
  Badge,
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from "@cleanhub/ui";
import { useEffect, useState } from "react";

import { useTenantI18n } from "@/i18n";

import { updateNotificationSettingsAction } from "../actions";
import {
  emptyNotificationSettingsForm,
  notificationChannelOptions,
  notificationEventOptions,
  notificationLanguageOptions,
} from "../constants";
import { getNotificationSettingsQuery } from "../queries";
import type {
  NotificationChannel,
  NotificationEvent,
  NotificationLanguage,
  NotificationSettingsFormValues,
  TenantNotificationSettings,
} from "../types";

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function toFormValues(
  settings: TenantNotificationSettings,
): NotificationSettingsFormValues {
  return {
    defaultLanguage: settings.defaultLanguage,
    channels: settings.channels,
    templates: settings.templates,
  };
}

export function TenantNotificationSettingsView() {
  const { m, formatDateTime } = useTenantI18n();
  const [settings, setSettings] = useState<TenantNotificationSettings | null>(
    null,
  );
  const [form, setForm] = useState<NotificationSettingsFormValues>(
    emptyNotificationSettingsForm,
  );
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    getNotificationSettingsQuery()
      .then((data) => {
        if (isCurrent) {
          setSettings(data);
          setForm(toFormValues(data));
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setLoadError(getErrorMessage(error, m.notifications.requestFailed));
        }
      })
      .finally(() => {
        if (isCurrent) {
          setLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [m.notifications.requestFailed]);

  async function reloadSettings() {
    setLoading(true);
    setLoadError(null);

    try {
      const data = await getNotificationSettingsQuery();
      setSettings(data);
      setForm(toFormValues(data));
    } catch (error) {
      setLoadError(getErrorMessage(error, m.notifications.requestFailed));
    } finally {
      setLoading(false);
    }
  }

  function updateLanguage(value: NotificationLanguage) {
    setForm((current) => ({
      ...current,
      defaultLanguage: value,
    }));
  }

  function updateChannel(channel: NotificationChannel, enabled: boolean) {
    setForm((current) => ({
      ...current,
      channels: {
        ...current.channels,
        [channel]: enabled,
      },
    }));
  }

  function updateTemplate(
    event: NotificationEvent,
    field: "enabled" | "templateKey",
    value: boolean | string,
  ) {
    setForm((current) => ({
      ...current,
      templates: {
        ...current.templates,
        [event]: {
          ...current.templates[event],
          [field]: value,
        },
      },
    }));
    setErrors((current) => ({
      ...current,
      [`templates.${event}.templateKey`]: undefined,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const result = await updateNotificationSettingsAction(form);

      if (!result.ok) {
        setErrors(result.errors);
        toast.error(result.message);
        return;
      }

      setSettings(result.data);
      setForm(toFormValues(result.data));
      setErrors({});
      toast.success(m.notifications.settingsUpdated);
    } catch (error) {
      toast.error(getErrorMessage(error, m.notifications.requestFailed));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="grid gap-5 p-5">
        <div className="h-28 animate-pulse rounded-md bg-muted" />
        <div className="h-[520px] animate-pulse rounded-md bg-muted" />
      </section>
    );
  }

  if (loadError || !settings) {
    return (
      <section className="grid gap-3 p-5">
        <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
          {loadError ?? m.notifications.unavailable}
        </div>
        <Button className="w-fit" onClick={reloadSettings} type="button" variant="outline">
          {m.common.tryAgain}
        </Button>
      </section>
    );
  }

  return (
    <section className="grid gap-6 p-5">
      <div className="flex flex-col gap-3 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">{m.notifications.eyebrow}</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            {m.notifications.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {m.notifications.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">v{settings.version}</Badge>
          <Badge variant="outline">
            {m.notifications.updatedBadge}{" "}
            {formatDateTime(settings.updatedAt)}
          </Badge>
        </div>
      </div>

      <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="font-semibold">{m.notifications.warningTitle}</p>
        <p className="mt-1">{m.notifications.warningBody}</p>
      </div>

      <form className="grid gap-6" onSubmit={handleSubmit}>
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          <div className="grid content-start gap-2">
            <Label htmlFor="notification-language">
              {m.notifications.labels.defaultLanguage}
            </Label>
            <Select
              disabled={saving}
              onValueChange={(value) =>
                updateLanguage(value as NotificationLanguage)
              }
              value={form.defaultLanguage}
            >
              <SelectTrigger className="w-full" id="notification-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {notificationLanguageOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3">
            <h2 className="text-sm font-semibold">
              {m.notifications.labels.channels}
            </h2>
            <div className="grid gap-3 md:grid-cols-3">
              {notificationChannelOptions.map((option) => (
                <label
                  className="flex gap-3 rounded-md border bg-background p-3"
                  key={option.value}
                >
                  <Checkbox
                    checked={form.channels[option.value]}
                    disabled={saving}
                    onCheckedChange={(checked) =>
                      updateChannel(option.value, checked === true)
                    }
                  />
                  <span>
                    <span className="block text-sm font-medium">
                      {option.label}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          <div>
            <h2 className="text-sm font-semibold">
              {m.notifications.labels.templates}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {m.notifications.templatesDesc}
            </p>
          </div>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{m.notifications.labels.event}</TableHead>
                  <TableHead className="w-28">
                    {m.notifications.labels.enabled}
                  </TableHead>
                  <TableHead>
                    {m.notifications.labels.templateKey}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notificationEventOptions.map((option) => {
                  const error = errors[`templates.${option.value}.templateKey`];

                  return (
                    <TableRow key={option.value}>
                      <TableCell>
                        <p className="font-medium">{option.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {option.value}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={form.templates[option.value].enabled}
                          disabled={saving}
                          onCheckedChange={(checked) =>
                            updateTemplate(option.value, "enabled", checked === true)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          aria-invalid={Boolean(error)}
                          disabled={saving}
                          onChange={(event) =>
                            updateTemplate(
                              option.value,
                              "templateKey",
                              event.target.value,
                            )
                          }
                          value={form.templates[option.value].templateKey}
                        />
                        {error ? (
                          <p className="mt-1 text-xs text-destructive">{error}</p>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="grid gap-3 border-t pt-5">
          <h2 className="text-sm font-semibold">
            {m.notifications.sendingHistory}
          </h2>
          <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            {m.notifications.sendingHistoryEmpty}
          </div>
        </div>

        <div className="flex justify-end border-t pt-5">
          <Button disabled={saving} type="submit">
            {saving ? m.common.saving : m.notifications.saveSettings}
          </Button>
        </div>
      </form>
    </section>
  );
}
