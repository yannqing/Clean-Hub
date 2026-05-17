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

import { tenantDefaultValues, tenantLanguageOptions } from "../constants";
import type { TenantDetail, TenantFormValues } from "../types";

type TenantFormResult =
  | {
      ok: true;
      data: TenantDetail;
    }
  | {
      ok: false;
      errors: Partial<Record<keyof TenantFormValues, string>>;
    };

type TenantFormProps = {
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Tenant request failed.";
}

export function TenantForm({
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
  const [submitting, setSubmitting] = useState(false);

  function updateValue(key: keyof TenantFormValues, value: string): void {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
    setErrors((current) => ({
      ...current,
      [key]: undefined,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const result = await onSubmit(values);

      if (!result.ok) {
        setErrors(result.errors);
        return;
      }

      toast.success(
        mode === "create" ? "Tenant created." : "Tenant updated.",
      );
      onSuccess?.(result.data);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-6" onSubmit={handleSubmit}>
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
              id="tenant-city"
              onChange={(event) => updateValue("city", event.target.value)}
              value={values.city}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 border-b p-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">Defaults</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="default-language">Default language</Label>
            <Select
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
                {tenantLanguageOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="default-currency">Default currency</Label>
            <Input
              aria-invalid={Boolean(errors.defaultCurrency)}
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

      <section className="grid gap-4 p-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">Contact</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="contact-name">Contact name</Label>
            <Input
              id="contact-name"
              onChange={(event) =>
                updateValue("contactName", event.target.value)
              }
              value={values.contactName}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="contact-phone">Contact phone</Label>
            <Input
              id="contact-phone"
              onChange={(event) =>
                updateValue("contactPhone", event.target.value)
              }
              value={values.contactPhone}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="contact-email">Contact email</Label>
            <Input
              aria-invalid={Boolean(errors.contactEmail)}
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
        <Button disabled={submitting} type="submit">
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
