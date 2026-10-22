"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { Building2, Upload } from "lucide-react";
import { Button, Input, Label, toast } from "@cleanhub/ui";
import { useTenantI18n } from "@/i18n";
import {
  requestTenantPosLogoUploadAction,
  updateTenantPosBrandingAction,
} from "../actions/update-pos-branding.action";
import { useTenantSettingsWorkspace } from "./tenant-settings-workspace";

export function TenantPosBrandingSection() {
  const { m } = useTenantI18n();
  const copy = m.settings.branding;
  const { settings, authLoaded, canUpdateSettings, updateSettings } =
    useTenantSettingsWorkspace();
  const [name, setName] = useState(settings.posDisplayName);
  const [objectKey, setObjectKey] = useState(settings.posLogoObjectKey);
  const [selected, setSelected] = useState<{ file: File; url: string } | null>(
    null,
  );
  const file = selected?.file ?? null;
  const preview =
    selected?.url ??
    (objectKey === settings.posLogoObjectKey ? settings.posLogoUrl : null);
  const [imageFailed, setImageFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const disabled = saving || !authLoaded || !canUpdateSettings;
  const valid = Boolean(name.trim() || objectKey || file);
  const changed =
    name.trim() !== settings.posDisplayName ||
    objectKey !== settings.posLogoObjectKey ||
    file !== null;

  useEffect(
    () => () => {
      if (selected) URL.revokeObjectURL(selected.url);
    },
    [selected],
  );

  function selectFile(selected: File | undefined) {
    if (!selected) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(selected.type) ||
      selected.size <= 0 ||
      selected.size > 5 * 1024 * 1024
    ) {
      setError(copy.logoHint);
      return;
    }
    setError(null);
    setImageFailed(false);
    setSelected({ file: selected, url: URL.createObjectURL(selected) });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    if (!valid) {
      setError(copy.required);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let key = objectKey;
      if (file) {
        const ticket = await requestTenantPosLogoUploadAction({
          contentType: file.type,
          sizeBytes: file.size,
        });
        if (!ticket.ok) throw new Error(copy.uploadFailed);
        // Storage uploads use the short-lived signed URL; API calls use the shared client.
        const response = await fetch(ticket.ticket.uploadUrl, {
          method: "PUT",
          headers: ticket.ticket.headers,
          body: file,
        });
        if (!response.ok) throw new Error(copy.uploadFailed);
        key = ticket.ticket.objectKey;
      }
      const result = await updateTenantPosBrandingAction({
        posDisplayName: name.trim(),
        posLogoObjectKey: key,
      });
      if (!result.ok) throw new Error(copy.saveFailed);
      updateSettings(result.data);
      setName(result.data.posDisplayName);
      setObjectKey(result.data.posLogoObjectKey);
      setSelected(null);
      setImageFailed(false);
      toast.success(copy.saved);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : copy.saveFailed;
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
      data-testid="tenant-pos-branding"
    >
      <div className="border-b border-black/10 px-4 py-4 sm:px-5">
        <h2 className="text-sm font-semibold text-slate-950">{copy.title}</h2>
        <p className="mt-1 text-[13px] leading-5 text-slate-500">
          {copy.description}
        </p>
      </div>
      <form onSubmit={save}>
        <div className="grid gap-5 p-4 sm:p-5">
          <div className="grid gap-2">
            <Label htmlFor="pos-display-name">{copy.nameLabel}</Label>
            <Input
              id="pos-display-name"
              value={name}
              maxLength={160}
              disabled={disabled}
              placeholder={copy.namePlaceholder}
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
            />
            <p className="text-xs text-slate-500">{copy.required}</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pos-logo-file">{copy.logoLabel}</Label>
            <input
              ref={input}
              id="pos-logo-file"
              className="sr-only"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={disabled}
              onChange={(event) => {
                selectFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={() => input.current?.click()}
              >
                <Upload className="mr-2 size-4" aria-hidden />
                {copy.upload}
              </Button>
              {objectKey || file ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => {
                    setSelected(null);
                    setImageFailed(false);
                    setObjectKey(null);
                    setError(null);
                  }}
                >
                  {copy.remove}
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-slate-500">{copy.logoHint}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-xs text-slate-500">{copy.preview}</p>
            <div className="flex min-h-12 min-w-0 items-center gap-3">
              {preview && !imageFailed ? (
                <Image
                  src={preview}
                  alt={copy.logoLabel}
                  width={48}
                  height={48}
                  unoptimized
                  onError={() => {
                    setImageFailed(true);
                    if (file) setError(copy.uploadFailed);
                  }}
                  className="size-12 shrink-0 rounded-lg bg-white object-contain"
                />
              ) : null}
              {!preview && !name.trim() ? (
                <Building2 className="size-6 text-slate-400" aria-hidden />
              ) : null}
              {name.trim() ? (
                <span className="min-w-0 truncate text-base font-semibold text-slate-950">
                  {name.trim()}
                </span>
              ) : !preview ? (
                <span className="text-sm text-slate-400">
                  {copy.namePlaceholder}
                </span>
              ) : null}
            </div>
          </div>
          {error || !valid ? (
            <p className="text-sm text-destructive" role="alert">
              {error ?? copy.required}
            </p>
          ) : null}
          <p className="text-xs leading-5 text-slate-500">{copy.syncHint}</p>
        </div>
        <div className="flex justify-end border-t border-black/10 px-4 py-3 sm:px-5">
          <Button
            type="submit"
            disabled={
              disabled || !valid || !changed || Boolean(file && imageFailed)
            }
          >
            {saving ? copy.saving : copy.save}
          </Button>
        </div>
      </form>
    </section>
  );
}
