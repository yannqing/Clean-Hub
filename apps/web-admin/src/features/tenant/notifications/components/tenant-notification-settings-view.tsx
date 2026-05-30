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

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Notification settings request failed.";
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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function TenantNotificationSettingsView() {
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
          setLoadError(getErrorMessage(error));
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
  }, []);

  async function reloadSettings() {
    setLoading(true);
    setLoadError(null);

    try {
      const data = await getNotificationSettingsQuery();
      setSettings(data);
      setForm(toFormValues(data));
    } catch (error) {
      setLoadError(getErrorMessage(error));
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
      toast.success("Notification settings updated.");
    } catch (error) {
      toast.error(getErrorMessage(error));
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
          {loadError ?? "Notification settings are unavailable."}
        </div>
        <Button className="w-fit" onClick={reloadSettings} type="button" variant="outline">
          Try again
        </Button>
      </section>
    );
  }

  return (
    <section className="grid gap-6 p-5">
      <div className="flex flex-col gap-3 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">Tenant communications</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            Notification settings
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Configure channel preferences and operational template keys.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">v{settings.version}</Badge>
          <Badge variant="outline">Updated {formatDate(settings.updatedAt)}</Badge>
        </div>
      </div>

      <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="font-semibold">Delivery providers are not connected.</p>
        <p className="mt-1">
          These settings are saved for setup only. This phase does not send
          messages or store provider credentials.
        </p>
      </div>

      <form className="grid gap-6" onSubmit={handleSubmit}>
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          <div className="grid content-start gap-2">
            <Label htmlFor="notification-language">Default language</Label>
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
            <h2 className="text-sm font-semibold">Channels</h2>
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
            <h2 className="text-sm font-semibold">Templates</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Template keys identify the content that future delivery
              integrations will use.
            </p>
          </div>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead className="w-28">Enabled</TableHead>
                  <TableHead>Template key</TableHead>
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
          <h2 className="text-sm font-semibold">Sending history</h2>
          <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            No messages have been sent. Sending records will appear here after
            a delivery provider is integrated.
          </div>
        </div>

        <div className="flex justify-end border-t pt-5">
          <Button disabled={saving} type="submit">
            {saving ? "Saving..." : "Save settings"}
          </Button>
        </div>
      </form>
    </section>
  );
}
