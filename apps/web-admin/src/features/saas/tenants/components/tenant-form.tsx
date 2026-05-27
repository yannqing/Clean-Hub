"use client";

import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@cleanhub/ui";
import { useState } from "react";

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
  disabled = false,
  initialValues,
  mode,
  onSubmit,
  onSuccess,
}: TenantFormProps) {
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
          "Tenant request failed.";
        setFormError(message);
        toast.error(message);
        return;
      }

      setErrors({});
      toast.success(mode === "create" ? "Tenant created." : "Tenant updated.");
      onSuccess?.(result.data);
    } catch (error) {
      const message = getTenantLoadErrorMessage(
        error,
        "Tenant request failed.",
      );
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-6" onSubmit={handleSubmit}>
      {formError ? (
        <div className="mx-5 mt-5 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {formError}
        </div>
      ) : null}

      <section className="grid gap-4 border-b p-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Tenant Profile
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="tenant-name">Tenant name</Label>
            <Input
              aria-invalid={Boolean(errors.name)}
              disabled={disabled || submitting}
              id="tenant-name"
              onChange={(event) => updateValue("name", event.target.value)}
              value={values.name}
            />
            {errors.name ? (
              <p className="text-xs text-destructive">{errors.name}</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="pressing-code">Pressing code</Label>
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
              <p className="text-xs text-destructive">{errors.pressingCode}</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tenant-country">Country</Label>
            <Input
              aria-invalid={Boolean(errors.country)}
              disabled={disabled || submitting}
              id="tenant-country"
              onChange={(event) => updateValue("country", event.target.value)}
              value={values.country}
            />
            {errors.country ? (
              <p className="text-xs text-destructive">{errors.country}</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tenant-city">City</Label>
            <Input
              aria-invalid={Boolean(errors.city)}
              disabled={disabled || submitting}
              id="tenant-city"
              onChange={(event) => updateValue("city", event.target.value)}
              value={values.city}
            />
            {errors.city ? (
              <p className="text-xs text-destructive">{errors.city}</p>
            ) : null}
          </div>
        </div>
      </section>

      {showDefaults ? (
        <section className="grid gap-4 border-b p-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Defaults
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="default-language">Default language</Label>
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
                      {option.label}
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
              <Label htmlFor="default-currency">Default currency</Label>
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
        </section>
      ) : null}

      {showDefaults ? (
        <section className="grid gap-4 border-b p-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Initial Owner
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="initial-owner-name">Owner name</Label>
              <Input
                aria-invalid={Boolean(errors.initialOwnerDisplayName)}
                disabled={disabled || submitting}
                id="initial-owner-name"
                onChange={(event) =>
                  updateValue("initialOwnerDisplayName", event.target.value)
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
              <Label htmlFor="initial-owner-email">Owner email</Label>
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
              <Label htmlFor="initial-owner-phone">Owner phone</Label>
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
              <Label htmlFor="initial-owner-pin">Owner PIN</Label>
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
              <Label htmlFor="initial-owner-password">Owner password</Label>
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
        </section>
      ) : null}

      <section className="grid gap-4 p-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">Contact</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="contact-name">Contact name</Label>
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
              <p className="text-xs text-destructive">{errors.contactName}</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="contact-phone">Contact phone</Label>
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
              <p className="text-xs text-destructive">{errors.contactPhone}</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="contact-email">Contact email</Label>
            <Input
              aria-invalid={Boolean(errors.contactEmail)}
              disabled={disabled || submitting}
              id="contact-email"
              onChange={(event) =>
                updateValue("contactEmail", event.target.value)
              }
              value={values.contactEmail}
            />
            {errors.contactEmail ? (
              <p className="text-xs text-destructive">{errors.contactEmail}</p>
            ) : null}
          </div>
        </div>
      </section>

      <div className="flex justify-end border-t bg-muted/30 px-5 py-4">
        <Button disabled={disabled || submitting} type="submit">
          {submitting
            ? mode === "create"
              ? "Creating..."
              : "Saving..."
            : mode === "create"
              ? "Create tenant"
              : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
