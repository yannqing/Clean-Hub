"use client";

import {
  Button,
  Card,
  CardContent,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@cleanhub/ui";
import { useId, useState } from "react";

import { useSaasI18n } from "@/i18n";

import { updateTenantSettingsAction } from "../actions";
import { tenantLanguageOptions } from "../constants";
import type { TenantLanguage, TenantSettings } from "../types";

export function TenantDefaultsPanel({
  disabled,
  defaultCurrency,
  defaultLanguage,
  onSaved,
  tenantId,
}: {
  disabled: boolean;
  defaultCurrency: string;
  defaultLanguage: TenantLanguage;
  onSaved: (settings: TenantSettings) => void;
  tenantId: string;
}) {
  const { m } = useSaasI18n();
  const languageId = useId();
  const currencyHintId = useId();
  const [language, setLanguage] = useState(defaultLanguage);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (disabled || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await updateTenantSettingsAction(tenantId, {
        defaultLanguage: language,
      });
      if (!result.ok) {
        const message =
          result.errors.defaultLanguage ??
          result.message ??
          m.tenants.settings.defaultsSaveFailed;
        setError(message);
        toast.error(message);
        return;
      }
      setLanguage(result.data.defaultLanguage);
      onSaved(result.data);
      toast.success(m.tenants.settings.defaultsSaved);
    } catch {
      setError(m.tenants.settings.defaultsSaveFailed);
      toast.error(m.tenants.settings.defaultsSaveFailed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card
      className="gap-0 rounded-lg py-0 shadow-none"
      data-testid="saas-tenant-defaults"
    >
      <CardContent className="grid gap-4 py-5">
        <h2 className="text-sm font-semibold">
          {m.tenants.settings.defaultsSection}
        </h2>
        <div className="grid gap-2">
          <Label htmlFor={languageId}>
            {m.tenants.detail.fields.defaultLanguage}
          </Label>
          <Select
            disabled={disabled || submitting}
            onValueChange={(value) => {
              setLanguage(value as TenantLanguage);
              setError(null);
            }}
            value={language}
          >
            <SelectTrigger
              aria-invalid={Boolean(error)}
              className="w-full"
              id={languageId}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tenantLanguageOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.value === "zh-CN"
                    ? m.common.languageLabels.zhCN
                    : m.common.languageLabels[option.value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <span className="text-sm font-medium">
            {m.tenants.detail.fields.defaultCurrency}
          </span>
          <p
            aria-describedby={currencyHintId}
            className="flex min-h-9 items-center rounded-md border bg-muted/30 px-3 text-sm"
            data-testid="saas-tenant-default-currency"
          >
            {defaultCurrency}
          </p>
          <p
            className="text-xs leading-5 text-muted-foreground"
            id={currencyHintId}
          >
            {m.tenants.settings.currencyHint}
          </p>
        </div>
        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          disabled={disabled || submitting || language === defaultLanguage}
          onClick={() => {
            void save();
          }}
          type="button"
          variant="outline"
        >
          {submitting ? m.common.saving : m.tenants.settings.saveDefaults}
        </Button>
      </CardContent>
    </Card>
  );
}
