"use client";

import { Button, Icon, Label, toast } from "@cleanhub/ui";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { type ChangeEvent, useRef } from "react";

import { useTenantI18n } from "@/i18n";

const MAX_BRANCH_LOGO_SIZE_BYTES = 5 * 1024 * 1024;
const BRANCH_LOGO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type BranchLogoFieldProps = {
  disabled?: boolean;
  error?: string;
  onRemove: () => void;
  onSelect: (file: File) => void;
  previewUrl?: string | null;
};

export function BranchLogoField({
  disabled = false,
  error,
  onRemove,
  onSelect,
  previewUrl,
}: BranchLogoFieldProps) {
  const { m } = useTenantI18n();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!BRANCH_LOGO_TYPES.has(file.type)) {
      toast.error(m.branches.create.logoTypeInvalid);
      return;
    }

    if (file.size > MAX_BRANCH_LOGO_SIZE_BYTES) {
      toast.error(m.branches.create.logoTooLarge);
      return;
    }

    onSelect(file);
  }

  return (
    <div className="grid gap-3">
      <Label htmlFor="branch-logo-upload">
        {m.branches.create.fields.logo}
      </Label>
      <input
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={disabled}
        id="branch-logo-upload"
        onChange={handleSelection}
        ref={inputRef}
        type="file"
      />

      {previewUrl ? (
        <div className="flex items-center gap-4 rounded-lg border p-3">
          <div className="relative size-24 shrink-0 overflow-hidden rounded-lg border bg-muted">
            <Image
              alt={m.branches.create.logoPreviewAlt}
              className="object-contain p-1"
              fill
              sizes="96px"
              src={previewUrl}
              unoptimized
            />
          </div>
          <div className="grid min-w-0 flex-1 gap-2">
            <p className="text-xs leading-5 text-muted-foreground">
              {m.branches.create.logoHelp}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                className="gap-1.5"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
                size="sm"
                type="button"
                variant="outline"
              >
                <Icon aria-hidden icon={ImagePlus} size={14} />
                {m.branches.create.replaceLogo}
              </Button>
              <Button
                className="gap-1.5"
                disabled={disabled}
                onClick={onRemove}
                size="sm"
                type="button"
                variant="ghost"
              >
                <Icon aria-hidden icon={Trash2} size={14} />
                {m.branches.create.removeLogo}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 text-center text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-muted">
            <Icon aria-hidden icon={Upload} size={18} />
          </span>
          <span className="font-medium text-foreground">
            {m.branches.create.uploadLogo}
          </span>
          <span className="text-xs">{m.branches.create.logoHelp}</span>
        </button>
      )}

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
