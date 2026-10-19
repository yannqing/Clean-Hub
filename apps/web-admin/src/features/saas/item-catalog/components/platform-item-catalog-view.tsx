"use client";

import type {
  CatalogTranslations,
  PlatformServiceItemGroup,
  SavePlatformItemGroupRequest,
} from "@cleanhub/api-client";
import { ApiHttpError } from "@cleanhub/api-client";
import { serviceCatalogText } from "@cleanhub/domain/service-item-catalog";
import {
  Button,
  Card,
  CardContent,
  Checkbox,
  Input,
  Label,
  Textarea,
  toast,
} from "@cleanhub/ui";
import { Loader2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { getCurrentAuthQuery } from "@/features/auth/queries";
import { useSaasI18n } from "@/i18n";
import { savePlatformItemGroupAction } from "../actions";
import { itemCatalogCopy } from "../copy";
import { getPlatformItemCatalogQuery } from "../queries";

const languages = ["zh-CN", "en", "fr"] as const;
const emptyText = (): CatalogTranslations => ({ en: "", fr: "", "zh-CN": "" });

function TranslationFields({
  label,
  values,
  onChange,
  disabled,
  descriptions,
  locale,
}: {
  label: string;
  values: CatalogTranslations;
  onChange: (next: CatalogTranslations) => void;
  disabled: boolean;
  descriptions?: boolean;
  locale: string;
}) {
  const c = itemCatalogCopy(locale);
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {languages.map((language) => (
        <label
          key={language}
          className="grid content-start gap-1.5 text-xs text-muted-foreground"
        >
          {label} · {c.languages[language]}
          {descriptions ? (
            <Textarea
              rows={2}
              maxLength={1000}
              disabled={disabled}
              value={values[language]}
              onChange={(event) =>
                onChange({ ...values, [language]: event.target.value })
              }
            />
          ) : (
            <Input
              required
              maxLength={80}
              disabled={disabled}
              value={values[language]}
              onChange={(event) =>
                onChange({ ...values, [language]: event.target.value })
              }
            />
          )}
        </label>
      ))}
    </div>
  );
}

export function PlatformItemCatalogView() {
  const { locale } = useSaasI18n();
  const c = itemCatalogCopy(locale);
  const [groups, setGroups] = useState<PlatformServiceItemGroup[]>([]);
  const [draft, setDraft] = useState<
    (SavePlatformItemGroupRequest & { id: string }) | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"load" | "save" | "conflict" | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([getPlatformItemCatalogQuery(), getCurrentAuthQuery()])
      .then(([catalog, auth]) => {
        if (!active) return;
        setGroups(catalog.data);
        setDraft(catalog.data[0] ?? null);
        setCanEdit(auth.role === "super_admin");
        setDirty(false);
        setError(null);
      })
      .catch(() => {
        if (active) setError("load");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const disabled = busy || !canEdit;
  function change(next: typeof draft) {
    setDraft(next);
    setDirty(true);
  }
  function refresh() {
    if (!dirty || window.confirm(c.leave)) {
      setLoading(true);
      setRefreshKey((key) => key + 1);
    }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || disabled) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await savePlatformItemGroupAction(draft.id, {
        version: draft.version,
        names: draft.names,
        descriptions: draft.descriptions,
        enabled: draft.enabled,
        sortOrder: draft.sortOrder,
        items: draft.items.map((item, index) => ({
          id: item.id,
          names: item.names,
          descriptions: item.descriptions,
          enabled: item.enabled,
          sortOrder: index,
        })),
      });
      setGroups((current) =>
        current.map((group) => (group.id === updated.id ? updated : group)),
      );
      setDraft(updated);
      setDirty(false);
      toast.success(c.saved);
    } catch (failure) {
      setError(
        failure instanceof ApiHttpError && failure.status === 409
          ? "conflict"
          : "save",
      );
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <p role="status" className="flex items-center gap-2 p-6 text-sm">
        <Loader2 className="size-4 animate-spin" />
        {c.loading}
      </p>
    );
  if (!draft)
    return (
      <div role="alert" className="space-y-3 rounded-lg border p-5">
        <p>{c.failed}</p>
        <Button type="button" onClick={refresh}>
          {c.retry}
        </Button>
      </div>
    );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{c.description}</p>
      {!canEdit ? (
        <p className="rounded-lg border bg-muted/30 p-3 text-sm">
          {c.readonly}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {groups.map((group) => (
          <Button
            key={group.id}
            type="button"
            variant={draft.id === group.id ? "default" : "outline"}
            disabled={busy}
            onClick={() => {
              if (
                group.id !== draft.id &&
                (!dirty || window.confirm(c.leave))
              ) {
                setDraft(group);
                setDirty(false);
                setError(null);
              }
            }}
          >
            {serviceCatalogText(group.names, locale)} ·{" "}
            {group.items.filter((item) => item.enabled).length}
          </Button>
        ))}
      </div>
      <form onSubmit={save} className="space-y-4">
        <Card>
          <CardContent className="space-y-4 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Label className="flex items-center gap-2">
                <Checkbox
                  checked={draft.enabled}
                  disabled={disabled}
                  onCheckedChange={(value) =>
                    change({ ...draft, enabled: value === true })
                  }
                />
                {c.enabled}
              </Label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                {c.order}
                <Input
                  className="w-20"
                  type="number"
                  min={0}
                  max={1000}
                  disabled={disabled}
                  value={draft.sortOrder}
                  onChange={(event) =>
                    change({ ...draft, sortOrder: Number(event.target.value) })
                  }
                />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">{c.namesHint}</p>
            <TranslationFields
              locale={locale}
              label={c.groupName}
              values={draft.names}
              disabled={disabled}
              onChange={(names) => change({ ...draft, names })}
            />
            <TranslationFields
              locale={locale}
              label={c.descriptionLabel}
              values={draft.descriptions}
              descriptions
              disabled={disabled}
              onChange={(descriptions) => change({ ...draft, descriptions })}
            />
          </CardContent>
        </Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">
            {c.articles} ({draft.items.length})
          </h2>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || draft.items.length >= 200}
            onClick={() =>
              change({
                ...draft,
                items: [
                  ...draft.items,
                  {
                    names: emptyText(),
                    descriptions: emptyText(),
                    enabled: true,
                    sortOrder: draft.items.length,
                  },
                ],
              })
            }
          >
            <Plus className="size-4" />
            {c.add}
          </Button>
        </div>
        {draft.items.length === 0 ? (
          <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
            {c.empty}
          </p>
        ) : null}
        {draft.items.map((item, index) => (
          <Card key={item.id ?? `new-${index}`}>
            <CardContent className="space-y-3 pt-5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {index + 1}.{" "}
                  {serviceCatalogText(item.names, locale) || c.article}
                </span>
                <Label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={item.enabled}
                    disabled={disabled}
                    onCheckedChange={(value) =>
                      change({
                        ...draft,
                        items: draft.items.map((entry, at) =>
                          at === index
                            ? { ...entry, enabled: value === true }
                            : entry,
                        ),
                      })
                    }
                  />
                  {item.enabled ? c.enabled : c.inactive}
                </Label>
              </div>
              <TranslationFields
                locale={locale}
                label={c.article}
                values={item.names}
                disabled={disabled}
                onChange={(names) =>
                  change({
                    ...draft,
                    items: draft.items.map((entry, at) =>
                      at === index ? { ...entry, names } : entry,
                    ),
                  })
                }
              />
              {!item.id ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={disabled}
                  onClick={() =>
                    change({
                      ...draft,
                      items: draft.items.filter((_, at) => at !== index),
                    })
                  }
                >
                  {c.removeDraft}
                </Button>
              ) : null}
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer py-2">
                  {c.descriptionLabel}
                </summary>
                <TranslationFields
                  locale={locale}
                  label={c.descriptionLabel}
                  values={item.descriptions}
                  descriptions
                  disabled={disabled}
                  onChange={(descriptions) =>
                    change({
                      ...draft,
                      items: draft.items.map((entry, at) =>
                        at === index ? { ...entry, descriptions } : entry,
                      ),
                    })
                  }
                />
              </details>
            </CardContent>
          </Card>
        ))}
        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          >
            {error === "load"
              ? c.failed
              : error === "conflict"
                ? c.conflict
                : c.saveFailed}
          </div>
        ) : null}
        <p className="text-xs leading-5 text-muted-foreground">
          {c.historical}
        </p>
        <div className="sticky bottom-3 z-10 flex justify-end gap-2 rounded-lg border bg-background/95 p-3 shadow-sm">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={refresh}
          >
            {c.refresh}
          </Button>
          <Button type="submit" disabled={disabled || !dirty}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {busy ? c.saving : c.save}
          </Button>
        </div>
      </form>
    </div>
  );
}
