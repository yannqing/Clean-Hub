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
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { useTenantI18n } from "@/i18n";
import { tenantQueryKeys } from "@/lib/query-keys";

import { updateBranchAction, updateBranchStatusAction } from "../actions";
import { branchLanguageValues } from "../constants";
import { useBranchDetailQuery } from "../queries";
import type {
  BranchFormValues,
  BranchLanguage,
  BranchStatus,
  BranchSummary,
} from "../types";

function isVersionConflict(result: { code?: string; status?: number }): boolean {
  return result.status === 409 || result.code === "BRANCH_VERSION_CONFLICT";
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

export type BranchDetailViewProps = {
  initialBranch: BranchSummary;
};

export function BranchDetailView({ initialBranch }: BranchDetailViewProps) {
  const { m, formatDateTime } = useTenantI18n();
  const queryClient = useQueryClient();
  // SSR 预取结果作为 initialData；写操作成功后用 setQueryData 同步缓存，
  // 同时 Server Action 的 revalidatePath 触发 RSC 重取保持一致。
  const { data: branch = initialBranch } = useBranchDetailQuery(initialBranch.id, {
    initialData: initialBranch,
  });
  const [formValues, setFormValues] = useState<BranchFormValues>(
    toFormValues(branch),
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof BranchFormValues, string>>
  >({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // 写操作成功后同步到 query cache + 表单。
  function applyUpdatedBranch(next: BranchSummary) {
    queryClient.setQueryData(
      tenantQueryKeys.branches.detail(next.id),
      next,
    );
    setFormValues(toFormValues(next));
    setErrors({});
  }

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
          ? m.branches.detail.versionConflict
          : result.message;
        setErrors(result.errors);
        setMessage(nextMessage);
        toast.error(nextMessage);
        return;
      }

      applyUpdatedBranch(result.data);
      toast.success(m.branches.detail.updated);
    } catch (saveError) {
      const nextMessage =
        saveError instanceof Error
          ? saveError.message
          : m.common.requestFailed;
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
          ? m.branches.detail.versionConflict
          : result.message;
        setErrors(result.errors);
        setMessage(nextMessage);
        toast.error(nextMessage);
        return;
      }

      applyUpdatedBranch(result.data);
      toast.success(m.branches.list.statusUpdated);
    } catch (statusError) {
      const nextMessage =
        statusError instanceof Error
          ? statusError.message
          : m.common.requestFailed;
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
          <Badge variant="secondary">{m.branches.detail.badge}</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            {branch.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {m.branches.detail.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={branch.status === "active" ? "default" : "outline"}>
            {m.common.statusLabels[branch.status]}
          </Badge>
          <Badge variant="outline">v{branch.version}</Badge>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-5 rounded-md border bg-background p-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_180px_160px]">
            <div className="grid gap-2">
              <Label htmlFor="branch-detail-name">
                {m.branches.create.fields.name}
              </Label>
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
              <Label htmlFor="branch-detail-phone">
                {m.branches.create.fields.phone}
              </Label>
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
              <Label htmlFor="branch-detail-currency">
                {m.branches.create.fields.currency}
              </Label>
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
              <Label htmlFor="branch-detail-language">
                {m.branches.create.fields.defaultLanguage}
              </Label>
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
                  {branchLanguageValues.map((value) => (
                    <SelectItem key={value} value={value}>
                      {m.common.languageLabels[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>{m.branches.create.fields.status}</Label>
              <div className="flex h-10 items-center rounded-md border bg-muted/30 px-3">
                <Badge
                  variant={branch.status === "active" ? "default" : "outline"}
                >
                  {m.common.statusLabels[branch.status]}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {m.branches.detail.statusHint}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="branch-detail-logo-url">
                {m.branches.create.fields.logoUrl}
              </Label>
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
            <Label htmlFor="branch-detail-address">
              {m.branches.create.fields.address}
            </Label>
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
              <Label htmlFor="branch-detail-receipt-name">
                {m.branches.create.fields.receiptName}
              </Label>
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
              <Label htmlFor="branch-detail-receipt-phone">
                {m.branches.create.fields.receiptPhone}
              </Label>
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
            <Label htmlFor="branch-detail-receipt-address">
              {m.branches.create.fields.receiptAddress}
            </Label>
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
            <Label htmlFor="branch-detail-hours">
              {m.branches.create.fields.businessHoursJson}
            </Label>
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
              {saving ? m.common.saving : m.branches.detail.saveBranch}
            </Button>
            <Button
              disabled={saving || branch.status === "active"}
              onClick={() => void handleStatusChange("active")}
              type="button"
              variant="outline"
            >
              {m.common.enable}
            </Button>
            <Button
              disabled={saving || branch.status === "inactive"}
              onClick={() => void handleStatusChange("inactive")}
              type="button"
              variant="outline"
            >
              {m.common.disable}
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href={webAdminRoutes.tenant.branches}>
                {m.common.backToList}
              </Link>
            </Button>
          </div>
        </div>

        <aside className="h-fit rounded-md border bg-background p-5">
          <div className="border-b pb-3">
            <h2 className="text-base font-semibold">
              {m.branches.detail.integrationChecks}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {m.branches.detail.integrationChecksDesc}
            </p>
          </div>
          <dl className="mt-4 grid gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">
                {m.branches.detail.branchIdLabel}
              </dt>
              <dd className="mt-1 break-all font-medium">{branch.id}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {m.branches.detail.updatedLabel}
              </dt>
              <dd className="mt-1 font-medium">
                {formatDateTime(branch.updatedAt) || m.common.notUpdated}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  );
}
