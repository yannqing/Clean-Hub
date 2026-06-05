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
import { useState } from "react";

import { webAdminRoutes } from "@/config/routes";

import { updateBranchAction, updateBranchStatusAction } from "../actions";
import { branchLanguageOptions } from "../constants";
import type {
  BranchFormValues,
  BranchLanguage,
  BranchStatus,
  BranchSummary,
} from "../types";

const branchStatusLabels: Record<BranchStatus, string> = {
  active: "Active",
  inactive: "Inactive",
};

const VERSION_CONFLICT_MESSAGE =
  "Branch was updated by another request. Refresh and try again.";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Branch request failed.";
}

function formatDate(value?: string | null): string {
  if (!value) {
    return "Not updated";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function businessHoursToText(
  businessHours: BranchSummary["businessHours"],
): string {
  return businessHours ? JSON.stringify(businessHours, null, 2) : "";
}

function toFormValues(branch: BranchSummary): BranchFormValues {
  return {
    name: branch.name,
    address: branch.address ?? "",
    phone: branch.phone ?? "",
    defaultLanguage: branch.defaultLanguage,
    defaultCurrency: branch.defaultCurrency,
    receiptName: branch.receiptName ?? "",
    receiptPhone: branch.receiptPhone ?? "",
    receiptAddress: branch.receiptAddress ?? "",
    logoUrl: branch.logoUrl ?? "",
    businessHoursJson: businessHoursToText(branch.businessHours),
    status: branch.status,
    version: branch.version,
  };
}

function isVersionConflict(result: { code?: string; status?: number }): boolean {
  return result.status === 409 || result.code === "BRANCH_VERSION_CONFLICT";
}

export type BranchDetailViewProps = {
  initialBranch: BranchSummary;
};

export function BranchDetailView({ initialBranch }: BranchDetailViewProps) {
  const [branch, setBranch] = useState(initialBranch);
  const [formValues, setFormValues] = useState<BranchFormValues>(
    toFormValues(initialBranch),
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof BranchFormValues, string>>
  >({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
    setMessage(null);
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      const result = await updateBranchAction(branch.id, {
        ...formValues,
        version: branch.version,
      });

      if (!result.ok) {
        const nextMessage = isVersionConflict(result)
          ? VERSION_CONFLICT_MESSAGE
          : result.message;
        setErrors(result.errors);
        setMessage(nextMessage);
        toast.error(nextMessage);
        return;
      }

      setBranch(result.data);
      setFormValues(toFormValues(result.data));
      setErrors({});
      toast.success("Branch updated.");
    } catch (saveError) {
      const nextMessage = getErrorMessage(saveError);
      setMessage(nextMessage);
      toast.error(nextMessage);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(status?: BranchStatus) {
    setSaving(true);
    setMessage(null);

    try {
      const nextStatus: BranchStatus =
        status ?? (branch.status === "active" ? "inactive" : "active");
      const result = await updateBranchStatusAction(
        branch.id,
        nextStatus,
        branch.version,
      );

      if (!result.ok) {
        const nextMessage = isVersionConflict(result)
          ? VERSION_CONFLICT_MESSAGE
          : result.message;
        setMessage(nextMessage);
        toast.error(nextMessage);
        return;
      }

      setBranch(result.data);
      setFormValues(toFormValues(result.data));
      toast.success("Branch status updated.");
    } catch (statusError) {
      const nextMessage = getErrorMessage(statusError);
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
          <Badge variant="secondary">Branch profile</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            {branch.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Edit store defaults, receipt identity, and operating metadata.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={branch.status === "active" ? "default" : "outline"}>
            {branchStatusLabels[branch.status]}
          </Badge>
          <Badge variant="outline">v{branch.version}</Badge>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-5 rounded-md border bg-background p-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_180px_160px]">
            <div className="grid gap-2">
              <Label htmlFor="branch-detail-name">Name</Label>
              <Input
                aria-invalid={Boolean(errors.name)}
                id="branch-detail-name"
                onChange={(event) => updateForm("name", event.target.value)}
                value={formValues.name}
              />
              {errors.name ? (
                <p className="text-xs text-destructive">{errors.name}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="branch-detail-phone">Phone</Label>
              <Input
                aria-invalid={Boolean(errors.phone)}
                id="branch-detail-phone"
                onChange={(event) => updateForm("phone", event.target.value)}
                value={formValues.phone}
              />
              {errors.phone ? (
                <p className="text-xs text-destructive">{errors.phone}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="branch-detail-currency">Currency</Label>
              <Input
                aria-invalid={Boolean(errors.defaultCurrency)}
                id="branch-detail-currency"
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
              <Label htmlFor="branch-detail-language">Default language</Label>
              <Select
                onValueChange={(value) =>
                  updateForm("defaultLanguage", value as BranchLanguage)
                }
                value={formValues.defaultLanguage}
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
              <Label htmlFor="branch-detail-status">Status</Label>
              <Select
                onValueChange={(value) =>
                  updateForm("status", value as BranchStatus)
                }
                value={formValues.status}
              >
                <SelectTrigger id="branch-detail-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="branch-detail-logo-url">Logo URL</Label>
              <Input
                aria-invalid={Boolean(errors.logoUrl)}
                id="branch-detail-logo-url"
                onChange={(event) => updateForm("logoUrl", event.target.value)}
                value={formValues.logoUrl}
              />
              {errors.logoUrl ? (
                <p className="text-xs text-destructive">{errors.logoUrl}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="branch-detail-address">Address</Label>
            <Textarea
              aria-invalid={Boolean(errors.address)}
              id="branch-detail-address"
              onChange={(event) => updateForm("address", event.target.value)}
              value={formValues.address}
            />
            {errors.address ? (
              <p className="text-xs text-destructive">{errors.address}</p>
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="branch-detail-receipt-name">Receipt name</Label>
              <Input
                aria-invalid={Boolean(errors.receiptName)}
                id="branch-detail-receipt-name"
                onChange={(event) =>
                  updateForm("receiptName", event.target.value)
                }
                value={formValues.receiptName}
              />
              {errors.receiptName ? (
                <p className="text-xs text-destructive">
                  {errors.receiptName}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="branch-detail-receipt-phone">Receipt phone</Label>
              <Input
                aria-invalid={Boolean(errors.receiptPhone)}
                id="branch-detail-receipt-phone"
                onChange={(event) =>
                  updateForm("receiptPhone", event.target.value)
                }
                value={formValues.receiptPhone}
              />
              {errors.receiptPhone ? (
                <p className="text-xs text-destructive">
                  {errors.receiptPhone}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="branch-detail-receipt-address">Receipt address</Label>
            <Textarea
              aria-invalid={Boolean(errors.receiptAddress)}
              id="branch-detail-receipt-address"
              onChange={(event) =>
                updateForm("receiptAddress", event.target.value)
              }
              value={formValues.receiptAddress}
            />
            {errors.receiptAddress ? (
              <p className="text-xs text-destructive">
                {errors.receiptAddress}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="branch-detail-hours">Business hours JSON</Label>
            <Textarea
              aria-invalid={Boolean(errors.businessHoursJson)}
              id="branch-detail-hours"
              onChange={(event) =>
                updateForm("businessHoursJson", event.target.value)
              }
              value={formValues.businessHoursJson}
            />
            {errors.businessHoursJson ? (
              <p className="text-xs text-destructive">
                {errors.businessHoursJson}
              </p>
            ) : null}
          </div>

          {message ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {message}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center">
            <Button disabled={saving} onClick={handleSave} type="button">
              {saving ? "Saving..." : "Save branch"}
            </Button>
            <Button
              disabled={saving || branch.status === "active"}
              onClick={() => void handleStatusChange("active")}
              type="button"
              variant="outline"
            >
              Enable
            </Button>
            <Button
              disabled={saving || branch.status === "inactive"}
              onClick={() => void handleStatusChange("inactive")}
              type="button"
              variant="outline"
            >
              Disable
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href={webAdminRoutes.tenant.branches}>Back to list</Link>
            </Button>
          </div>
        </div>

        <aside className="h-fit rounded-md border bg-background p-5">
          <div className="border-b pb-3">
            <h2 className="text-base font-semibold">Integration checks</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Branch scope and tenant isolation are enforced by the API.
            </p>
          </div>
          <dl className="mt-4 grid gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Branch ID</dt>
              <dd className="mt-1 break-all font-medium">{branch.id}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Updated</dt>
              <dd className="mt-1 font-medium">
                {formatDate(branch.updatedAt)}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  );
}
