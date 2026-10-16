"use client";

import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cleanhub/ui";

import { useTenantI18n } from "@/i18n";

import { tenantSettingsTimezoneOptions } from "../constants";

type TenantTimezoneFieldProps = {
  disabled?: boolean;
  error?: string;
  id: string;
  onChange: (value: string) => void;
  value: string;
};

export function TenantTimezoneField({
  disabled = false,
  error,
  id,
  onChange,
  value,
}: TenantTimezoneFieldProps) {
  const { m } = useTenantI18n();
  const timezoneOptions = Array.from(
    new Set([value, ...tenantSettingsTimezoneOptions]),
  ).filter(Boolean);

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{m.settings.labels.timezone}</Label>
      <Select disabled={disabled} onValueChange={onChange} value={value}>
        <SelectTrigger
          aria-invalid={Boolean(error)}
          className="w-full bg-white"
          id={id}
        >
          <SelectValue placeholder="UTC" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {timezoneOptions.map((timezone) => (
            <SelectItem key={timezone} value={timezone}>
              {timezone}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs leading-5 text-slate-500">
        {m.settings.general.timezoneHint}
      </p>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
