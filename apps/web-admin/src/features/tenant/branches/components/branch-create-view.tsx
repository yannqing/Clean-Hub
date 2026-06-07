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
  return error instanceof Error ? error.message : "Branch request failed.";
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
  const [formValues, setFormValues] = useState<BranchFormValues>(() => ({
    ...emptyBranchFormValues,
    defaultCurrency: initialDefaultCurrency ?? emptyBranchFormValues.defaultCurrency,
    defaultLanguage: initialDefaultLanguage ?? emptyBranchFormValues.defaultLanguage,
  }));
  const [errors, setErrors] = useState<Partial<Record<keyof BranchFormValues, string>>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function updateForm<K extends keyof BranchFormValues>(key: K, value: BranchFormValues[K]): void {
    setFormValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
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
      toast.success("Branch created.");
      router.push(`${webAdminRoutes.tenant.branches}/${result.data.id}`);
      router.refresh();
    } catch (submitError) {
      const message = getErrorMessage(submitError);
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
          <Badge variant="secondary">New branch</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">Create branch</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Add an operating location for the current tenant. Tenant and Manager branch scope are enforced by the API.
          </p>
        </div>
        <Button asChild type="button" variant="outline">
          <Link href={webAdminRoutes.tenant.branches}>Back to list</Link>
        </Button>
      </div>

      <form className="grid gap-5 rounded-md border bg-background p-5" onSubmit={handleCreate}>
        {defaultsWarning ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-foreground">
            {defaultsWarning}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[1fr_180px_160px]">
          <div className="grid gap-2">
            <Label htmlFor="branch-name">Name</Label>
            <Input aria-invalid={Boolean(errors.name)} id="branch-name" onChange={(e) => updateForm("name", e.target.value)} value={formValues.name} />
            {errors.name ? <p className="text-xs text-destructive">{errors.name}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="branch-phone">Phone</Label>
            <Input aria-invalid={Boolean(errors.phone)} id="branch-phone" onChange={(e) => updateForm("phone", e.target.value)} value={formValues.phone} />
            {errors.phone ? <p className="text-xs text-destructive">{errors.phone}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="branch-currency">Currency</Label>
            <Input aria-invalid={Boolean(errors.defaultCurrency)} id="branch-currency" maxLength={3} onChange={(e) => updateForm("defaultCurrency", e.target.value.toUpperCase())} value={formValues.defaultCurrency} />
            {errors.defaultCurrency ? <p className="text-xs text-destructive">{errors.defaultCurrency}</p> : null}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="branch-language">Default language</Label>
            <Select onValueChange={(v) => updateForm("defaultLanguage", v as BranchLanguage)} value={formValues.defaultLanguage}>
              <SelectTrigger id="branch-language"><SelectValue /></SelectTrigger>
              <SelectContent>{branchLanguageOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
            {errors.defaultLanguage ? <p className="text-xs text-destructive">{errors.defaultLanguage}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="