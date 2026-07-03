"use client";

import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from "@cleanhub/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { useTenantI18n } from "@/i18n";

import { createBranchAction } from "../actions";
import {
  branchLanguageValues,
  emptyBranchFormValues,
} from "../constants";
import type {
  BranchFormValues,
  BranchLanguage,
  BranchStatus,
} from "../types";

export type BranchCreateViewProps = {
  defaultsWarning?: string;
  initialDefaultCurrency?: string;
  initialDefaultLanguage?: BranchLanguage;
};

export function BranchCreateView({
  defaultsWarning,
  initialDefaultCurrency,
  initialDefaultLanguage,
}: BranchCreateViewProps = {}) {
  const router = useRouter();
  const { m } = useTenantI18n();
  const [formValues, setFormValues] = useState<BranchFormValues>(() => ({
    ...emptyBranchFormValues,
    defaultCurrency:
      initialDefaultCurrency ?? emptyBranchFormValues.defaultCurrency,
    defaultLanguage:
      initialDefaultLanguage ?? emptyBranchFormValues.defaultLanguage,
  }));
  const [errors, setErrors] = useState<
    Partial<Record<keyof BranchFormValues, string>>
  >({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function updateForm<K extends keyof BranchFormValues>(
    key: K,
    value: BranchFormValues[K],
  ): void {
    setFormValues((current) => ({
      ...current,
      [key]: value,
    }));
    setErrors((current) => ({
      ...current,
      [key]: undefined,
    }));
    setFormError(null);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      const result = await createBranchAction(formValues);

      if (!result.ok) {
        setErrors(result.errors);
        setFormError(result.message);
        toast.error(result.message);
        return;
      }

      toast.success(m.branches.create.created);
      router.push(`${webAdminRoutes.tenant.branches}/${result.data.id}`);
      router.refresh();
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : m.common.requestFailed;
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="grid gap-6 p-5">
      <div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">{m.branches.create.badge}</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            {m.branches.create.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {m.branches.create.description}
          </p>
        </div>

        <Button asChild type="button" variant="outline">
          <Link href={webAdminRoutes.tenant.branches}>
            {m.common.backToList}
          </Link>
        </Button>
      </div>

      <form
        className="grid gap-5 rounded-md border bg-background p-5"
        onSubmit={handleCreate}
      >
        {defaultsWarning ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-foreground">
            {defaultsWarning}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[1fr_180px_160px]">
          <div className="grid gap-2">
            <Label htmlFor="branch-name">{m.branches.create.fields.name}</Label>
            <Input
              aria-invalid={Boolean(errors.name)}
              id="branch-name"
              onChange={(event) => updateForm("name", event.target.value)}
              value={formValues.name}
            />
            {errors.name ? (
              <p className="text-xs text-destructive">{errors.name}</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="branch-phone">
              {m.branches.create.fields.phone}
            </Label>
            <Input
              aria-invalid={Boolean(errors.phone)}
              id="branch-phone"
              onChange={(event) => updateForm("phone", event.target.value)}
              value={formValues.phone}
            />
            {errors.phone ? (
              <p className="text-xs text-destructive">{errors.phone}</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="branch-currency">
              {m.branches.create.fields.currency}
            </Label>
            <Input
              aria-invalid={Boolean(errors.defaultCurrency)}
              id="branch-currency"
              maxLength={3}
              onChange={(event) =>
                updateForm("defaultCurrency", event.target.value.toUpperCase())
              }
              value={formValues.defaultCurrency}
            />
            {errors.defaultCurrency ? (
              <p className="text-xs text-destructive">
                {errors.defaultCurrency}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="branch-language">
              {m.branches.create.fields.defaultLanguage}
            </Label>
            <Select
              onValueChange={(value) =>
                updateForm("defaultLanguage", value as BranchLanguage)
              }
              value={formValues.defaultLanguage}
            >
              <SelectTrigger id="branch-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {branchLanguageValues.map((value) => (
                  <SelectItem key={value} value={value}>
                    {m.common.languageLabels[value]}
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
            <Label htmlFor="branch-form-status">
              {m.branches.create.fields.status}
            </Label>
            <Select
              onValueChange={(value) =>
                updateForm("status", value as BranchStatus)
              }
              value={formValues.status}
            >
              <SelectTrigger id="branch-form-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">
                  {m.common.statusLabels.active}
                </SelectItem>
                <SelectItem value="inactive">
                  {m.common.statusLabels.inactive}
                </SelectItem>
              </SelectContent>
            </Select>
            {errors.status ? (
              <p className="text-xs text-destructive">{errors.status}</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="branch-logo-url">
              {m.branches.create.fields.logoUrl}
            </Label>
            <Input
              aria-invalid={Boolean(errors.logoUrl)}
              id="branch-logo-url"
              onChange={(event) => updateForm("logoUrl", event.target.value)}
              value={formValues.logoUrl}
            />
            {errors.logoUrl ? (
              <p className="text-xs text-destructive">{errors.logoUrl}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="branch-receipt-name">
              {m.branches.create.fields.receiptName}
            </Label>
            <Input
              aria-invalid={Boolean(errors.receiptName)}
              id="branch-receipt-name"
              onChange={(event) => updateForm("receiptName", event.target.value)}
              value={formValues.receiptName}
            />
            {errors.receiptName ? (
              <p className="text-xs text-destructive">{errors.receiptName}</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="branch-receipt-phone">
              {m.branches.create.fields.receiptPhone}
            </Label>
            <Input
              aria-invalid={Boolean(errors.receiptPhone)}
              id="branch-receipt-phone"
              onChange={(event) =>
                updateForm("receiptPhone", event.target.value)
              }
              value={formValues.receiptPhone}
            />
            {errors.receiptPhone ? (
              <p className="text-xs text-destructive">{errors.receiptPhone}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="branch-address">
            {m.branches.create.fields.address}
          </Label>
          <Textarea
            aria-invalid={Boolean(errors.address)}
            id="branch-address"
            onChange={(event) => updateForm("address", event.target.value)}
            value={formValues.address}
          />
          {errors.address ? (
            <p className="text-xs text-destructive">{errors.address}</p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="branch-receipt-address">
            {m.branches.create.fields.receiptAddress}
          </Label>
          <Textarea
            aria-invalid={Boolean(errors.receiptAddress)}
            id="branch-receipt-address"
            onChange={(event) =>
              updateForm("receiptAddress", event.target.value)
            }
            value={formValues.receiptAddress}
          />
          {errors.receiptAddress ? (
            <p className="text-xs text-destructive">{errors.receiptAddress}</p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="branch-business-hours">
            {m.branches.create.fields.businessHoursJson}
          </Label>
          <Textarea
            aria-invalid={Boolean(errors.businessHoursJson)}
            id="branch-business-hours"
            onChange={(event) =>
              updateForm("businessHoursJson", event.target.value)
            }
            placeholder={m.branches.create.businessHoursPlaceholder}
            value={formValues.businessHoursJson}
          />
          {errors.businessHoursJson ? (
            <p className="text-xs text-destructive">
              {errors.businessHoursJson}
            </p>
          ) : null}
        </div>

        {formError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {formError}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center">
          <Button disabled={saving} type="submit">
            {saving ? m.common.saving : m.branches.create.createButton}
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href={webAdminRoutes.tenant.branches}>{m.common.cancel}</Link>
          </Button>
        </div>
      </form>
    </section>
  );
}
