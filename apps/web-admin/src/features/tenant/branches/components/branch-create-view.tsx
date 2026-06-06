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

import { createBranchAction } from "../actions";
import { branchLanguageOptions, emptyBranchFormValues } from "../constants";
import type {
  BranchFormValues,
  BranchLanguage,
  BranchStatus,
} from "../types";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Branch could not be created.";
}

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
  const [form, setForm] = useState<BranchFormValues>(() => ({
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
  const [message, setMessage] = useState<string | null>(null);

  function updateForm<K extends keyof BranchFormValues>(
    key: K,
    value: BranchFormValues[K],
  ): void {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
    setErrors((current) => ({
      ...current,
      [key]: undefined,
    }));
    setMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const result = await createBranchAction(form);

      if (!result.ok) {
        setErrors(result.errors);
        setMessage(result.message);
        toast.error(result.message);
        return;
      }

      toast.success("Branch created.");
      router.push(`${webAdminRoutes.tenant.branches}/${result.data.id}`);
      router.refresh();
    } catch (error) {
      const nextMessage = getErrorMessage(error);
      setMessage(nextMessage);
      toast.error(nextMessage);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="grid gap-6 p-5">
      <div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">Tenant branches</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            Create branch
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Add a store profile for the current tenant.
          </p>
        </div>
        <Button asChild type="button" variant="outline">
          <Link href={webAdminRoutes.tenant.branches}>Back to branches</Link>
        </Button>
      </div>

      <form
        className="grid gap-5 rounded-md border bg-background p-5"
        onSubmit={handleSubmit}
      >
        {defaultsWarning ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-foreground">
            {defaultsWarning}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[1fr_180px_160px]">
          <div className="grid gap-2">
            <Label htmlFor="branch-create-name">Name</Label>
            <Input
              aria-invalid={Boolean(errors.name)}
              id="branch-create-name"
              onChange={(event) => updateForm("name", event.target.value)}
              placeholder="Downtown branch"
              value={form.name}
            />
            {errors.name ? (
              <p className="text-xs text-destructive">{errors.name}</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="branch-create-phone">Phone</Label>
            <Input
              aria-invalid={Boolean(errors.phone)}
              id="branch-create-phone"
              onChange={(event) => updateForm("phone", event.target.value)}
              value={form.phone}
            />
            {errors.phone ? (
              <p className="text-xs text-destructive">{errors.phone}</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="branch-create-currency">Currency</Label>
            <Input
              aria-invalid={Boolean(errors.defaultCurrency)}
              id="branch-create-currency"
              maxLength={3}
              onChange={(event) =>
                updateForm("defaultCurrency", event.target.value.toUpperCase())
              }
              value={form.defaultCurrency}
            />
            {errors.defaultCurrency ? (
              <p className="text-xs text-destructive">
                {errors.defaultCurrency}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="branch-create-language">Default language</Label>
            <Select
              onValueChange={(value) =>
                updateForm("defaultLanguage", value as BranchLanguage)
              }
              value={form.defaultLanguage}
            >
              <SelectTrigger id="branch-create-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {branchLanguageOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="branch-create-status">Initial status</Label>
            <Select
              onValueChange={(value) =>
                updateForm("status", value as BranchStatus)
              }
              value={form.status}
            >
              <SelectTrigger id="branch-create-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="branch-create-address">Address</Label>
          <Textarea
            aria-invalid={Boolean(errors.address)}
            id="branch-create-address"
            onChange={(event) => updateForm("address", event.target.value)}
            value={form.address}
          />
          {errors.address ? (
            <p className="text-xs text-destructive">{errors.address}</p>
          ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="branch-create-receipt-name">Receipt name</Label>
            <Input
              aria-invalid={Boolean(errors.receiptName)}
              id="branch-create-receipt-name"
              onChange={(event) =>
                updateForm("receiptName", event.target.value)
              }
              value={form.receiptName}
            />
            {errors.receiptName ? (
              <p className="text-xs text-destructive">
                {errors.receiptName}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="branch-create-receipt-phone">Receipt phone</Label>
            <Input
              aria-invalid={Boolean(errors.receiptPhone)}
              id="branch-create-receipt-phone"
              onChange={(event) =>
                updateForm("receiptPhone", event.target.value)
              }
              value={form.receiptPhone}
            />
            {errors.receiptPhone ? (
              <p className="text-xs text-destructive">
                {errors.receiptPhone}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="branch-create-receipt-address">Receipt address</Label>
          <Textarea
            aria-invalid={Boolean(errors.receiptAddress)}
            id="branch-create-receipt-address"
            onChange={(event) =>
              updateForm("receiptAddress", event.target.value)
            }
            value={form.receiptAddress}
          />
          {errors.receiptAddress ? (
            <p className="text-xs text-destructive">
              {errors.receiptAddress}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="branch-create-logo-url">Logo URL</Label>
            <Input
              aria-invalid={Boolean(errors.logoUrl)}
              id="branch-create-logo-url"
              onChange={(event) => updateForm("logoUrl", event.target.value)}
              value={form.logoUrl}
            />
            {errors.logoUrl ? (
              <p className="text-xs text-destructive">{errors.logoUrl}</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="branch-create-hours">Business hours JSON</Label>
            <Textarea
              aria-invalid={Boolean(errors.businessHoursJson)}
              id="branch-create-hours"
              onChange={(event) =>
                updateForm("businessHoursJson", event.target.value)
              }
              placeholder='{"mon":"08:00-18:00"}'
              value={form.businessHoursJson}
            />
            {errors.businessHoursJson ? (
              <p className="text-xs text-destructive">
                {errors.businessHoursJson}
              </p>
            ) : null}
          </div>
        </div>

        {message ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {message}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row">
          <Button disabled={saving} type="submit">
            {saving ? "Creating..." : "Create branch"}
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href={webAdminRoutes.tenant.branches}>Cancel</Link>
          </Button>
        </div>
      </form>
    </section>
  );
}
