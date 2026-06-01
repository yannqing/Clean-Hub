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
import { useCallback, useEffect, useState } from "react";

import { webAdminRoutes } from "@/config/routes";

import { updateBranchAction, updateBranchStatusAction } from "../actions";
import { branchLanguageOptions, emptyBranchFormValues } from "../constants";
import { getBranchDetailQuery } from "../queries";
import type { BranchFormValues, BranchLanguage, BranchSummary } from "../types";

type BranchDetailViewProps = {
  branchId: string;
};
type BranchActionFailure = {
  ok: false;
  errors?: Partial<Record<keyof BranchFormValues, string>>;
  message?: string;
  code?: string;
  status?: number;
};

const VERSION_CONFLICT_MESSAGE = "门店已被他人修改，请刷新后重试";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Branch request failed.";
}

function toFormValues(branch: BranchSummary): BranchFormValues {
  return {
    name: branch.name,
    address: branch.address ?? "",
    phone: branch.phone ?? "",
    businessHours: branch.businessHours
      ? JSON.stringify(branch.businessHours, null, 2)
      : "",
    defaultLanguage: branch.defaultLanguage,
    defaultCurrency: branch.defaultCurrency,
    receiptName: branch.receiptName ?? "",
    receiptPhone: branch.receiptPhone ?? "",
    receiptAddress: branch.receiptAddress ?? "",
    logoUrl: branch.logoUrl ?? "",
    status: branch.status,
    version: branch.version,
  };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function isVersionConflict(result: BranchActionFailure): boolean {
  return result.status === 409 || result.code === "BRANCH_VERSION_CONFLICT";
}

function getActionFailureMessage(result: BranchActionFailure): string {
  if (isVersionConflict(result)) {
    return VERSION_CONFLICT_MESSAGE;
  }

  return (
    (result.errors ? Object.values(result.errors)[0] : undefined) ??
    result.message ??
    "Branch request failed."
  );
}

export function BranchDetailView({ branchId }: BranchDetailViewProps) {
  const [branch, setBranch] = useState<BranchSummary | null>(null);
  const [form, setForm] = useState<BranchFormValues>(emptyBranchFormValues);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const loadBranch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const item = await getBranchDetailQuery(branchId);
      setBranch(item);
      setForm(toFormValues(item));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    let isCurrent = true;

    getBranchDetailQuery(branchId)
      .then((item) => {
        if (isCurrent) {
          setBranch(item);
          setForm(toFormValues(item));
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (isCurrent) {
          setError(getErrorMessage(loadError));
        }
      })
      .finally(() => {
        if (isCurrent) {
          setLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [branchId]);

  function updateForm<K extends keyof BranchFormValues>(
    key: K,
    value: BranchFormValues[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!branch) {
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const result = await updateBranchAction(branchId, {
        ...form,
        version: branch.version,
      });

      if (!result.ok) {
        const message = getActionFailureMessage(result);
        setFormError(message);
        toast.error(message);
        if (isVersionConflict(result)) {
          await loadBranch();
        }
        return;
      }

      setBranch(result.data);
      setForm(toFormValues(result.data));
      toast.success("Branch profile updated.");
    } catch (submitError) {
      const message = getErrorMessage(submitError);
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange() {
    if (!branch) {
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const result = await updateBranchStatusAction(
        branchId,
        branch.status === "active" ? "inactive" : "active",
        branch.version,
      );

      if (!result.ok) {
        const message = getActionFailureMessage(result);
        setFormError(message);
        toast.error(message);
        if (isVersionConflict(result)) {
          await loadBranch();
        }
        return;
      }

      setBranch(result.data);
      setForm(toFormValues(result.data));
      toast.success(
        result.data.status === "active"
          ? "Branch activated."
          : "Branch marked inactive.",
      );
    } catch (submitError) {
      const message = getErrorMessage(submitError);
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="grid gap-5 p-5">
        <div className="h-28 animate-pulse rounded-md bg-muted" />
        <div className="h-[620px] animate-pulse rounded-md bg-muted" />
      </section>
    );
  }

  if (error || !branch) {
    return (
      <section className="grid gap-3 p-5">
        <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
          {error ?? "Branch is unavailable."}
        </div>
        <div className="flex gap-3">
          <Button onClick={loadBranch} type="button" variant="outline">
            Try again
          </Button>
          <Link
            className="inline-flex items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
            href={webAdminRoutes.tenant.branches}
          >
            Back to branches
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-6 p-5">
      <div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            href={webAdminRoutes.tenant.branches}
          >
            Back to branches
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Branch profile</Badge>
            <Badge
              variant={branch.status === "active" ? "secondary" : "outline"}
            >
              {branch.status === "active" ? "Active" : "Inactive"}
            </Badge>
            <Badge variant="outline">v{branch.version}</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            {branch.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Updated {formatDate(branch.updatedAt)}
          </p>
        </div>
        <Button
          disabled={saving}
          onClick={handleStatusChange}
          type="button"
          variant={branch.status === "active" ? "destructive" : "outline"}
        >
          {branch.status === "active" ? "Mark inactive" : "Activate branch"}
        </Button>
      </div>

      <form className="grid gap-6" onSubmit={handleSubmit}>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="branch-detail-name">Name</Label>
            <Input
              id="branch-detail-name"
              onChange={(event) => updateForm("name", event.target.value)}
              value={form.name}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="branch-detail-phone">Phone</Label>
            <Input
              id="branch-detail-phone"
              onChange={(event) => updateForm("phone", event.target.value)}
              value={form.phone}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="branch-detail-address">Address</Label>
            <Input
              id="branch-detail-address"
              onChange={(event) => updateForm("address", event.target.value)}
              value={form.address}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="branch-detail-language">Default language</Label>
            <Select
              onValueChange={(value) =>
                updateForm("defaultLanguage", value as BranchLanguage)
              }
              value={form.defaultLanguage}
            >
              <SelectTrigger id="branch-detail-language">
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
            <Label htmlFor="branch-detail-currency">Default currency</Label>
            <Input
              id="branch-detail-currency"
              maxLength={3}
              onChange={(event) =>
                updateForm("defaultCurrency", event.target.value.toUpperCase())
              }
              value={form.defaultCurrency}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="branch-detail-logo">Logo URL</Label>
            <Input
              id="branch-detail-logo"
              onChange={(event) => updateForm("logoUrl", event.target.value)}
              placeholder="https://..."
              value={form.logoUrl}
            />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="branch-detail-hours">Business hours JSON</Label>
            <Textarea
              className="min-h-40 font-mono text-xs"
              id="branch-detail-hours"
              onChange={(event) =>
                updateForm("businessHours", event.target.value)
              }
              placeholder={'{"monday":"08:00-18:00"}'}
              value={form.businessHours}
            />
          </div>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="branch-detail-receipt-name">Receipt name</Label>
              <Input
                id="branch-detail-receipt-name"
                onChange={(event) =>
                  updateForm("receiptName", event.target.value)
                }
                value={form.receiptName}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="branch-detail-receipt-phone">Receipt phone</Label>
              <Input
                id="branch-detail-receipt-phone"
                onChange={(event) =>
                  updateForm("receiptPhone", event.target.value)
                }
                value={form.receiptPhone}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="branch-detail-receipt-address">
                Receipt address
              </Label>
              <Textarea
                id="branch-detail-receipt-address"
                onChange={(event) =>
                  updateForm("receiptAddress", event.target.value)
                }
                value={form.receiptAddress}
              />
            </div>
          </div>
        </div>

        {formError ? (
          <p className="text-sm text-destructive">{formError}</p>
        ) : null}
        <Button className="w-fit" disabled={saving} type="submit">
          {saving ? "Saving..." : "Save branch profile"}
        </Button>
      </form>
    </section>
  );
}
