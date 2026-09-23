"use client";

import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cleanhub/ui";
import Link from "next/link";

import { webAdminRoutes } from "@/config/routes";
import { interpolate, useTenantI18n } from "@/i18n";

import { formatTaxRatePercent } from "../percent";
import type { TaxRateOptions } from "../types";

// Radix Select reserves the empty string, so "no rate of its own" needs a token.
const DEFAULT_RATE_VALUE = "__default__";

/**
 * Picks the tax rate a service or product is sold at. `value` is the rate id,
 * or "" for the tenant default.
 *
 * Only active rates are offered, but an item that already carries an archived
 * rate still shows it, so saving the form without touching the field keeps it.
 */
export function TaxRateSelect({
  id,
  value,
  onChange,
  options,
  disabled,
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: TaxRateOptions;
  disabled?: boolean;
  error?: string;
}) {
  const { m } = useTenantI18n();
  const text = m.taxRates.field;
  const offered = options.rates.filter((rate) => !rate.archived || rate.id === value);
  const defaultLabel = options.defaultRate
    ? interpolate(text.useDefault, { rate: formatTaxRatePercent(options.defaultRate) })
    : text.useDefaultUnknown;

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{text.label}</Label>
      <Select
        disabled={disabled || options.loadFailed}
        onValueChange={(next) => onChange(next === DEFAULT_RATE_VALUE ? "" : next)}
        value={value || DEFAULT_RATE_VALUE}
      >
        <SelectTrigger aria-invalid={Boolean(error)} className="w-full" id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT_RATE_VALUE}>{defaultLabel}</SelectItem>
          {offered.map((rate) => (
            <SelectItem key={rate.id} value={rate.id}>
              {rate.name} · {formatTaxRatePercent(rate.rate)}
              {rate.archived ? ` ${text.archivedSuffix}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <p className="text-xs leading-5 text-muted-foreground">
        {options.loadFailed
          ? text.loadFailed
          : options.taxEnabled
            ? text.hint
            : text.taxDisabled}{" "}
        <Link
          className="underline underline-offset-2"
          href={webAdminRoutes.tenant.system.settingsSections.pricing}
        >
          {text.manage}
        </Link>
      </p>
    </div>
  );
}
