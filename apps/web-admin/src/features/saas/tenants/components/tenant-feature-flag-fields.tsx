"use client";

import { Checkbox } from "@cleanhub/ui";

import { useSaasI18n } from "@/i18n";

import { tenantFeatureFlagOptions } from "../constants";
import type { TenantFeatureFlagsFormValues } from "../types";

type TenantFeatureFlagFieldsProps = {
  disabled: boolean;
  values: TenantFeatureFlagsFormValues;
  onChange: (key: keyof TenantFeatureFlagsFormValues, enabled: boolean) => void;
};

export function TenantFeatureFlagFields({
  disabled,
  values,
  onChange,
}: TenantFeatureFlagFieldsProps) {
  const { m } = useSaasI18n();

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {tenantFeatureFlagOptions.map((option) => (
        <label
          className="flex min-h-24 items-start gap-3 rounded-lg bg-muted/45 px-3 py-3 text-sm transition-colors hover:bg-muted/70"
          key={option.key}
        >
          <Checkbox
            checked={values[option.key]}
            disabled={disabled}
            onCheckedChange={(checked) => onChange(option.key, checked === true)}
          />
          <span className="grid gap-1">
            <span className="font-medium leading-none">
              {m.tenants.settings.featureFlagOptions[option.key].label}
            </span>
            <span className="text-muted-foreground">
              {m.tenants.settings.featureFlagOptions[option.key].description}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}
