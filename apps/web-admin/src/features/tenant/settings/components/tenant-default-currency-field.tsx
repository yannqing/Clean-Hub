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

import { tenantSettingsCurrencyOptions } from "../constants";

type TenantDefaultCurrencyFieldProps = {
  disabled?: boolean;
  error?: string;
  id: string;
  onChange: (value: string) => void;
  value: string;
};

export function TenantDefaultCurrencyField({
  disabled = false,
  error,
  id,
  onChange,
  value,
}: TenantDefaultCurrencyFieldProps) {
  const { m } = useTenantI18n();
  const currencyOptions = Array.from(
    new Set([value, ...tenantSettingsCurrencyOptions]),
  ).filter(Boolean);

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{m.settings.labels.defaultCurrency}</Label>
      <Select disabled={disabled} onValueChange={onChange} value={value}>
        <SelectTrigger
          aria-invalid={Boolean(error)}
          className="bg-white font-medium uppercase"
          id={id}
        >
          <SelectValue placeholder="CNY" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {currencyOptions.map((currency) => (
            <SelectItem className="font-medium" key={currency} value={currency}>
              {currency}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs leading-5 text-slate-500">
        {m.settings.pricingHub.defaultCurrencyHint}
      </p>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
