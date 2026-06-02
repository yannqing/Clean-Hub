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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  toast,
} from "@cleanhub/ui";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { webAdminRoutes } from "@/config/routes";

import { createBranchAction, updateBranchStatusAction } from "../actions";
import { getBranchListQuery } from "../queries";
import type {
  BranchFormValues,
  BranchListFilters,
  BranchStatus,
  BranchSummary,
} from "../types";

type StatusFilter = "all" | BranchStatus;

const branchStatusLabels: Record<BranchStatus, string> = {
  active: "Active",
  inactive: "Inactive",
};

const languageLabels = {
  en: "English",
  fr: "French",
  "zh-CN": "Chinese",
} as const;

const defaultFormValues: BranchFormValues = {
  name: "",
  address: "",
  phone: "",
  defaultLanguage: "fr",
  defaultCurrency: "XOF",
  receiptName: "",
  receiptPhone: "",
  receiptAddress: "",
  logoUrl: "",
  businessHoursJson: "",
  status: "active",
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Branch request failed.";
}

function getBranchStatusVariant(
  status: BranchStatus,
): "default" | "outline" {
  return status === "active" ? "default" : "outline";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function branchDetailHref(branchId: string): string {
  return `${webAdminRoutes.tenant.branches}/${branchId}`;
}

export type BranchManagementViewProps = {
  initialBranches?: BranchSummary[];
};

export function BranchManagementView({
  initialBranches,
}: BranchManagementViewProps = {}) {
  const [branches, setBranches] = useState<BranchSummary[]>(
    initialBranches ?? [],
  );
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [formValues, setFormValues] =
    useState<BranchFormValues>(defaultFormValues);
  const [errors, setErrors] = useState<
    Partial<Record<keyof BranchFormValues, string>>
  >({});
  const [loading, setLoading] = useState(!initialBranches);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const filters: BranchListFilters = useMemo(
    () => ({
      q: query.trim() || undefined,
      status: status === "all" ? undefined : status,
    }),
    [query, status],
  );

  const loadBranches = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setBranches(await getBranchListQuery(filters));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    let isCurrent = true;

    getBranchListQuery(filters)
      .then((items) => {
        if (isCurrent) {
          setBranches(items);
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
  }, [filters]);

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

  async function handleCreate() {
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

      setFormValues(defaultFormValues);
      setErrors({});
      toast.success("Branch created.");
      await loadBranches();
    } catch (submitError) {
      const message = getErrorMessage(submitError);
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(branch: BranchSummary) {
    setSaving(true);
    setFormError(null);

    try {
      const nextStatus: BranchStatus =
        branch.status === "active" ? "inactive" : "active";
      const result = await updateBranchStatusAction(branch.id, nextStatus);

      if (!result.ok) {
        setFormError(result.message);
        toast.error(result.message);
        return;
      }

      toast.success("Branch status updated.");
      await loadBranches();
    } catch (statusError) {
      const message = getErrorMessage(statusError);
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="min-h-[560px]">
      <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">Tenant branches</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            Branches
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Owner sees all tenant branches. Manager visibility is enforced by
            the tenant branches API through branch scope.
          </p>
        </div>

        <Button disabled={loading} onClick={loadBranches} type="button" variant="outline">
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 border-b p-5 lg:grid-cols-[1fr_180px]">
        <div className="grid gap-2">
          <Label htmlFor="branch-search">Search</Label>
          <Input
            id="branch-search"
            onChange={(event) => {
              setLoading(true);
              setQuery(event.target.value);
            }}
            placeholder="Branch name or phone"
            value={query}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="branch-status">Status</Label>
          <Select
            onValueChange={(value) => {
              setLoading(true);
              setStatus(value as StatusFilter);
            }}
            value={status}
          >
            <SelectTrigger id="branch-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 border-b p-5 lg:grid-cols-[1fr_180px_160px]">
        <div className="grid gap-2">
          <Label htmlFor="branch-name">Name</Label>
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
          <Label htmlFor="branch-phone">Phone</Label>
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
          <Label htmlFor="branch-currency">Currency</Label>
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

        <div className="grid gap-2">
          <Label htmlFor="branch-language">Default language</Label>
          <Select
            onValueChange={(value) =>
              updateForm(
                "defaultLanguage",
                value as BranchFormValues["defaultLanguage"],
              )
            }
            value={formValues.defaultLanguage}
          >
            <SelectTrigger id="branch-language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="fr">French</SelectItem>
              <SelectItem value="zh-CN">Chinese</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="branch-form-status">Status</Label>
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
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="branch-receipt-name">Receipt name</Label>
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
          <Label htmlFor="branch-receipt-phone">Receipt phone</Label>
          <Input
            aria-invalid={Boolean(errors.receiptPhone)}
            id="branch-receipt-phone"
            onChange={(event) => updateForm("receiptPhone", event.target.value)}
            value={formValues.receiptPhone}
          />
          {errors.receiptPhone ? (
            <p className="text-xs text-destructive">{errors.receiptPhone}</p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="branch-logo-url">Logo URL</Label>
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

        <div className="grid gap-2 lg:col-span-3">
          <Label htmlFor="branch-address">Address</Label>
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

        <div className="grid gap-2 lg:col-span-3">
          <Label htmlFor="branch-receipt-address">Receipt address</Label>
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

        <div className="grid gap-2 lg:col-span-3">
          <Label htmlFor="branch-business-hours">Business hours JSON</Label>
          <Textarea
            aria-invalid={Boolean(errors.businessHoursJson)}
            id="branch-business-hours"
            onChange={(event) =>
              updateForm("businessHoursJson", event.target.value)
            }
            placeholder='{"mon":"08:00-18:00"}'
            value={formValues.businessHoursJson}
          />
          {errors.businessHoursJson ? (
            <p className="text-xs text-destructive">
              {errors.businessHoursJson}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 lg:col-span-3 lg:flex-row lg:items-center">
          <Button disabled={saving} onClick={handleCreate} type="button">
            {saving ? "Saving..." : "Create branch"}
          </Button>
          {formError ? (
            <p className="text-sm text-destructive">{formError}</p>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 p-5">
          {[0, 1, 2].map((item) => (
            <div className="h-14 animate-pulse rounded-md bg-muted" key={item} />
          ))}
        </div>
      ) : error ? (
        <div className="p-5">
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        </div>
      ) : branches.length === 0 ? (
        <div className="p-5">
          <div className="rounded-md border border-dashed p-8 text-center">
            <h2 className="text-base font-semibold">No branches yet</h2>
          </div>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Branch</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Defaults</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches.map((branch) => (
              <TableRow key={branch.id}>
                <TableCell>
                  <div className="font-medium">{branch.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {branch.address ?? "No address"}
                  </div>
                </TableCell>
                <TableCell>{branch.phone ?? "No phone"}</TableCell>
                <TableCell>
                  {languageLabels[branch.defaultLanguage]} /{" "}
                  {branch.defaultCurrency}
                </TableCell>
                <TableCell>
                  <Badge variant={getBranchStatusVariant(branch.status)}>
                    {branchStatusLabels[branch.status]}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(branch.updatedAt)}</TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button asChild size="sm" type="button" variant="outline">
                    <Link href={branchDetailHref(branch.id)}>Open</Link>
                  </Button>
                  <Button
                    disabled={saving}
                    onClick={() => void handleStatusChange(branch)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {branch.status === "active" ? "Disable" : "Enable"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
