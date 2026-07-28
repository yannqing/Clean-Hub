"use client";

import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@cleanhub/ui";
import { useState, type ReactNode } from "react";

import { useSaasI18n } from "@/i18n";

import {
  tenantCreateLanguageOptions,
  tenantDefaultValues,
  tenantLanguageOptions,
} from "../constants";
import type { TenantDetail, TenantFormValues } from "../types";
import { getTenantLoadErrorMessage } from "../actions/tenant-action-errors";

type TenantFormResult =
  | {
      ok: true;
      data: TenantDetail;
    }
  | {
      ok: false;
      errors: Partial<Record<keyof TenantFormValues, string>>;
      message?: string;
    };

type TenantFormProps = {
  aside?: ReactNode;
  disabled?: boolean;
  initialValues?: Partial<TenantFormValues>;
  mode: "create" | "edit";
  onSubmit: (values: TenantFormValues) => Promise<TenantFormResult>;
  onSuccess?: (tenant: TenantDetail) => void;
};

function getInitialValues(
  values: Partial<TenantFormValues> | undefined,
): TenantFormValues {
  return {
    ...tenantDefaultValues,
    ...values,
  };
}

export function TenantForm({
  aside,
  disabled = false,
  initialValues,
  mode,
  onSubmit,
  onSuccess,
}: TenantFormProps) {
  const { m } = useSaasI18n();
  const [values, setValues] = useState<TenantFormValues>(() =>
    getInitialValues(initialValues),
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof TenantFormValues, string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const showDefaults = mode === "create";
  const languageOptions = showDefaults
    ? tenantCreateLanguageOptions
    : tenantLanguageOptions;
  const getLanguageLabel = (value: string) => {
    if (value === "platform-default") {
      return m.common.languageLabels.platformDefault;
    }
    if (value === "en") {
      return m.common.languageLabels.en;
    }
    if (value === "fr") {
      return m.common.languageLabels.fr;
    }
    return m.common.languageLabels.zhCN;
  };

  function updateValue(key: keyof TenantFormValues, value: string): void {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
    setErrors((current) => ({
      ...current,
      [key]: undefined,
    }));
    setFormError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (disabled) {
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const result = await onSubmit(values);

      if (!result.ok) {
        setErrors(result.errors);
        const message =
          result.message ??
          Object.values(result.errors)[0] ??
          m.tenants.detail.loadError;
        setFormError(message);
        toast.error(message);
        return;
      }

      setErrors({});
      toast.success(
        mode === "create"
          ? m.tenants.form.createdToast
          : m.tenants.form.updatedToast,
      );
      onSuccess?.(result.data);
    } catch (error) {
      const message = getTenantLoadErrorMessage(
        error,
        m.tenants.detail.loadError,
      );
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={handleSubmit}>
      {formError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {formError}
        </div>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-5">
          <Card className="gap-0 rounded-lg py-0 shadow-none">
            <CardContent className="grid gap-4 py-5">
              <h2 className="text-sm font-semibold text-foreground">
                {m.tenants.form.profileSection}
              </h2>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="tenant-name">
                    {m.tenants.form.fields.name}
                  </Label>
                  <Input
                    aria-invalid={Boolean(errors.name)}
                    disabled={disabled || submitting}
                    id="tenant-name"
                    onChange={(event) =>
                      updateValue("name", event.target.value)
                    }
                    value={values.name}
                  />
                  {errors.name ? (
                    <p className="text-xs text-destructive">{errors.name}</p>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="pressing-code">
                    {m.tenants.form.fields.pressingCode}
                  </Label>
                  <Input
                    aria-invalid={Boolean(errors.pressingCode)}
                    disabled={disabled || submitting}
                    id="pressing-code"
                    onChange={(event) =>
                      updateValue("pressingCode", event.target.value)
                    }
                    value={values.pressingCode}
                  />
                  {errors.pressingCode ? (
                    <p className="text-xs text-destructive">
                      {errors.pressingCode}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="tenant-country">
                    {m.tenants.form.fields.country}
                  </Label>
                  <Input
                    aria-invalid={Boolean(errors.country)}
                    disabled={disabled || submitting}
                    id="tenant-country"
                    onChange={(event) =>
                      updateValue("country", event.target.value)
                    }
                    value={values.country}
                  />
                  {errors.country ? (
                    <p className="text-xs text-destructive">{errors.country}</p>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="tenant-city">
                    {m.tenants.form.fields.city}
                  </Label>
                  <Input
                    aria-invalid={Boolean(errors.city)}
                    disabled={disabled || submitting}
                    id="tenant-city"
                    onChange={(event) =>
                      updateValue("city", event.target.value)
                    }
                    value={values.city}
                  />
                  {errors.city ? (
                    <p className="text-xs text-destructive">{errors.city}</p>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          {showDefaults ? (
            <Card className="gap-0 rounded-lg py-0 shadow-none">
              <CardContent className="grid gap-4 py-5">
                <h2 className="text-sm font-semibold text-foreground">
                  {m.tenants.form.ownerSection}
                </h2>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="initial-owner-name">
                      {m.tenants.form.fields.ownerName}
                    </Label>
                    <Input
                      aria-invalid={Boolean(errors.initialOwnerDisplayName)}
                      disabled={disabled || submitting}
                      id="initial-owner-name"
                      onChange={(event) =>
                        updateValue(
                          "initialOwnerDisplayName",
                          event.target.value,
                        )
                      }
                      value={values.initialOwnerDisplayName}
                    />
                    {errors.initialOwnerDisplayName ? (
                      <p className="text-xs text-destructive">
                        {errors.initialOwnerDisplayName}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="initial-owner-email">
                      {m.tenants.form.fields.ownerEmail}
                    </Label>
                    <Input
                      aria-invalid={Boolean(errors.initialOwnerEmail)}
                      disabled={disabled || submitting}
                      id="initial-owner-email"
                      onChange={(event) =>
                        updateValue("initialOwnerEmail", event.target.value)
                      }
                      type="email"
                      value={values.initialOwnerEmail}
                    />
                    {errors.initialOwnerEmail ? (
                      <p className="text-xs text-destructive">
                        {errors.initialOwnerEmail}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="initial-owner-phone">
                      {m.tenants.form.fields.ownerPhone}
                    </Label>
                    <Input
                      aria-invalid={Boolean(errors.initialOwnerPhone)}
                      disabled={disabled || submitting}
                      id="initial-owner-phone"
                      onChange={(event) =>
                        updateValue("initialOwnerPhone", event.target.value)
                      }
                      value={values.initialOwnerPhone}
                    />
                    {errors.initialOwnerPhone ? (
                      <p className="text-xs text-destructive">
                        {errors.initialOwnerPhone}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="initial-owner-pin">
                      {m.tenants.form.fields.ownerPin}
                    </Label>
                    <Input
                      aria-invalid={Boolean(errors.initialOwnerPin)}
                      disabled={disabled || submitting}
                      id="initial-owner-pin"
                      inputMode="numeric"
                      maxLength={6}
                      onChange={(event) =>
                        updateValue("initialOwnerPin", event.target.value)
                      }
                      value={values.initialOwnerPin}
                    />
                    {errors.initialOwnerPin ? (
                      <p className="text-xs text-destructive">
                        {errors.initialOwnerPin}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-2 md:col-span-2">
                    <Label htmlFor="initial-owner-password">
                      {m.tenants.form.fields.ownerPassword}
                    </Label>
                    <Input
                      aria-invalid={Boolean(errors.initialOwnerPassword)}
                      disabled={disabled || submitting}
                      id="initial-owner-password"
                      onChange={(event) =>
                        updateValue("initialOwnerPassword", event.target.value)
                      }
                      type="password"
                      value={values.initialOwnerPassword}
                    />
                    {errors.initialOwnerPassword ? (
                      <p className="text-xs text-destructive">
                        {errors.initialOwnerPassword}
                      </p>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card className="gap-0 rounded-lg py-0 shadow-none">
            <CardContent className="grid gap-4 py-5">
              <h2 className="text-sm font-semibold text-foreground">
                {m.tenants.form.contactSection}
              </h2>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="contact-name">
                    {m.tenants.form.fields.contactName}
                  </Label>
                  <Input
                    aria-invalid={Boolean(errors.contactName)}
                    disabled={disabled || submitting}
                    id="contact-name"
                    onChange={(event) =>
                      updateValue("contactName", event.target.value)
                    }
                    value={values.contactName}
                  />
                  {errors.contactName ? (
                    <p className="text-xs text-destructive">
                      {errors.contactName}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="contact-phone">
                    {m.tenants.form.fields.contactPhone}
                  </Label>
                  <Input
                    aria-invalid={Boolean(errors.contactPhone)}
                    disabled={disabled || submitting}
                    id="contact-phone"
                    onChange={(event) =>
                      updateValue("contactPhone", event.target.value)
                    }
                    value={values.contactPhone}
                  />
                  {errors.contactPhone ? (
                    <p className="text-xs text-destructive">
                      {errors.contactPhone}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="contact-email">
                    {m.tenants.form.fields.contactEmail}
                  </Label>
                  <Input
                    aria-invalid={Boolean(errors.contactEmail)}
                    disabled={disabled || submitting}
                    id="contact-email"
                    onChange={(event) =>
                      updateValue("contactEmail", event.target.value)
                    }
                    type="email"
                    value={values.contactEmail}
                  />
                  {errors.contactEmail ? (
                    <p className="text-xs text-destructive">
                      {errors.contactEmail}
                    </p>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="grid gap-5">
          {showDefaults ? (
            <Card className="gap-0 rounded-lg py-0 shadow-none">
              <CardContent className="grid gap-4 py-5">
                <h2 className="text-sm font-semibold text-foreground">
                  {m.tenants.form.defaultsSection}
                </h2>

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="default-language">
                      {m.tenants.form.fields.defaultLanguage}
                    </Label>
                    <Select
                      disabled={disabled || submitting}
                      onValueChange={(value) =>
                        updateValue(
                          "defaultLanguage",
                          value as TenantFormValues["defaultLanguage"],
                        )
                      }
                      value={values.defaultLanguage}
                    >
                      <SelectTrigger className="w-full" id="default-language">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {languageOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {getLanguageLabel(option.value)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.defaultLanguage ? (
                      <p className="text-xs text-destructive">
                        {errors.defaultLanguage}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="default-currency">
                      {m.tenants.form.fields.defaultCurrency}
                    </Label>
                    <Input
                      aria-invalid={Boolean(errors.defaultCurrency)}
                      disabled={disabled || submitting}
                      id="default-currency"
                      maxLength={3}
                      onChange={(event) =>
                        updateValue("defaultCurrency", event.target.value)
                      }
                      value={values.defaultCurrency}
                    />
                    {errors.defaultCurrency ? (
                      <p className="text-xs text-destructive">
                        {errors.defaultCurrency}
                      </p>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
          {aside}
        </aside>
      </div>

      <div className="flex justify-end pt-1">
        <Button disabled={disabled || submitting} type="submit">
          {submitting
            ? mode === "create"
              ? m.common.creating
              : m.common.saving
            : mode === "create"
              ? m.tenants.form.createTenant
              : m.common.saveChanges}
        </Button>
      </div>
    </form>
  );
}
