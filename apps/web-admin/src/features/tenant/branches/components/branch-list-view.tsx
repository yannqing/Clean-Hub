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
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from "@cleanhub/ui";
import { DataTable } from "@cleanhub/ui/data-table";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState } from "react";

import { webAdminRoutes } from "@/config/routes";

import { createBranchAction } from "../actions";
import { branchLanguageOptions, emptyBranchFormValues } from "../constants";
import { BRANCH_LIST_LIMIT, getBranchListQuery } from "../queries";
import type {
  BranchFormValues,
  BranchLanguage,
  BranchStatus,
  BranchSummary,
} from "../types";

type StatusFilter = "all" | BranchStatus;
type BranchActionFailure = {
  ok: false;
  errors?: Partial<Record<keyof BranchFormValues, string>>;
  message?: string;
};

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

function getActionFailureMessage(result: BranchActionFailure): string {
  return (
    (result.errors ? Object.values(result.errors)[0] : undefined) ??
    result.message ??
    "Branch request failed."
  );
}

export function BranchListView() {
  const captionId = useId();
  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [form, setForm] = useState<BranchFormValues>(emptyBranchFormValues);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const filters = useMemo(
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      const result = await createBranchAction(form);

      if (!result.ok) {
        const message = getActionFailureMessage(result);
        setFormError(message);
        toast.error(message);
        return;
      }

      setForm(emptyBranchFormValues);
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

  function updateForm<K extends keyof BranchFormValues>(
    key: K,
    value: BranchFormValues[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <section className="min-h-[560px]">
      <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">Tenant operations</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            Branches
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Maintain branch profiles and operating status for this tenant.
          </p>
        </div>
        <Button onClick={loadBranches} type="button" variant="outline">
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 border-b p-5 lg:grid-cols-[1fr_220px]">
        <div className="grid gap-2">
          <Label htmlFor="branch-search">Search</Label>
          <Input
            id="branch-search"
            onChange={(event) => {
              setLoading(true);
              setQuery(event.target.value);
            }}
            placeholder="Name, address, or phone"
            value={query}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="branch-status-filter">Status</Label>
          <Select
            onValueChange={(value) => {
              setLoading(true);
              setStatus(value as StatusFilter);
            }}
            value={status}
          >
            <SelectTrigger id="branch-status-filter">
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

      <form className="grid gap-4 border-b p-5" onSubmit={handleSubmit}>
        <div>
          <h2 className="font-semibold">Create a branch</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Start with the operating profile, then complete receipt and schedule
            settings from the detail page.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="branch-name">Name</Label>
            <Input
              id="branch-name"
              onChange={(event) => updateForm("name", event.target.value)}
              placeholder="Downtown branch"
              value={form.name}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="branch-phone">Phone</Label>
            <Input
              id="branch-phone"
              onChange={(event) => updateForm("phone", event.target.value)}
              placeholder="+225 ..."
              value={form.phone}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="branch-address">Address</Label>
            <Input
              id="branch-address"
              onChange={(event) => updateForm("address", event.target.value)}
              placeholder="Street and city"
              value={form.address}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="branch-language">Default language</Label>
            <Select
              onValueChange={(value) =>
                updateForm("defaultLanguage", value as BranchLanguage)
              }
              value={form.defaultLanguage}
            >
              <SelectTrigger id="branch-language">
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
            <Label htmlFor="branch-currency">Default currency</Label>
            <Input
              id="branch-currency"
              maxLength={3}
              onChange={(event) =>
                updateForm("defaultCurrency", event.target.value.toUpperCase())
              }
              value={form.defaultCurrency}
            />
          </div>
        </div>
        {formError ? (
          <p className="text-sm text-destructive">{formError}</p>
        ) : null}
        <Button className="w-fit" disabled={saving} type="submit">
          {saving ? "Creating..." : "Create branch"}
        </Button>
      </form>

      <div className="p-5">
        {error ? (
          <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
            {error}
          </div>
        ) : null}
        {!error && loading ? (
          <div className="h-44 animate-pulse rounded-md bg-muted" />
        ) : null}
        {!error && !loading ? (
          <>
            {branches.length === BRANCH_LIST_LIMIT ? (
              <div className="mb-3 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                Only showing the first {BRANCH_LIST_LIMIT} branches. Use search
                or filters to narrow the list.
              </div>
            ) : null}
            <DataTable aria-describedby={captionId}>
              <TableCaption className="sr-only" id={captionId}>
                Branches
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.length === 0 ? (
                  <TableRow>
                    <TableCell
                      className="py-10 text-center text-muted-foreground"
                      colSpan={6}
                    >
                      No branches match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  branches.map((branch) => (
                    <TableRow key={branch.id}>
                      <TableCell>
                        <p className="font-medium">{branch.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {branch.address ?? "No address"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            branch.status === "active" ? "secondary" : "outline"
                          }
                        >
                          {branch.status === "active" ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>{branch.phone ?? "No phone"}</TableCell>
                      <TableCell>{branch.defaultCurrency}</TableCell>
                      <TableCell>{formatDate(branch.updatedAt)}</TableCell>
                      <TableCell className="text-right">
                        <Link
                          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                          href={`${webAdminRoutes.tenant.branches}/${branch.id}`}
                        >
                          View details
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </DataTable>
          </>
        ) : null}
      </div>
    </section>
  );
}
