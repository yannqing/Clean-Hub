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
  toast,
} from "@cleanhub/ui";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { webAdminRoutes } from "@/config/routes";

import { updateBranchStatusAction } from "../actions";
import { BRANCH_LIST_LIMIT, getBranchListQuery } from "../queries";
import type {
  BranchLanguage,
  BranchListFilters,
  BranchStatus,
  BranchSummary,
} from "../types";

type StatusFilter = "all" | BranchStatus;

const branchStatusLabels: Record<BranchStatus, string> = {
  active: "Active",
  inactive: "Inactive",
};

const languageLabels: Record<BranchLanguage, string> = {
  en: "English",
  fr: "French",
  "zh-CN": "Chinese",
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Branch request failed.";
}

function getBranchStatusVariant(status: BranchStatus): "default" | "outline" {
  return status === "active" ? "default" : "outline";
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

function branchDetailHref(branchId: string): string {
  return `${webAdminRoutes.tenant.branches}/${branchId}`;
}

function buildBranchListUrl(pathname: string, filters: BranchListFilters) {
  const params = new URLSearchParams();

  if (filters.q) {
    params.set("q", filters.q);
  }

  if (filters.status) {
    params.set("status", filters.status);
  }

  const queryString = params.toString();

  return queryString ? `${pathname}?${queryString}` : pathname;
}

export type BranchManagementViewProps = {
  initialBranches?: BranchSummary[];
  initialError?: string;
  initialFilters?: BranchListFilters;
};

export function BranchManagementView({
  initialBranches,
  initialError,
  initialFilters,
}: BranchManagementViewProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const [branches, setBranches] = useState<BranchSummary[]>(
    initialBranches ?? [],
  );
  const [status, setStatus] = useState<StatusFilter>(
    initialFilters?.status ?? "all",
  );
  const [query, setQuery] = useState(initialFilters?.q ?? "");
  const [loading, setLoading] = useState(!initialBranches && !initialError);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const didUseInitialResult = useRef(Boolean(initialBranches || initialError));

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
      router.replace(buildBranchListUrl(pathname, filters), { scroll: false });
      setBranches(await getBranchListQuery(filters));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [filters, pathname, router]);

  useEffect(() => {
    if (didUseInitialResult.current) {
      didUseInitialResult.current = false;
      return;
    }

    let isCurrent = true;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      router.replace(buildBranchListUrl(pathname, filters), { scroll: false });

      getBranchListQuery(filters, { signal: controller.signal })
        .then((items) => {
          if (isCurrent) {
            setBranches(items);
            setError(null);
          }
        })
        .catch((loadError: unknown) => {
          if (isCurrent && !controller.signal.aborted) {
            setError(getErrorMessage(loadError));
          }
        })
        .finally(() => {
          if (isCurrent) {
            setLoading(false);
          }
        });
    }, 250);

    return () => {
      isCurrent = false;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [filters, pathname, router]);

  async function handleStatusChange(branch: BranchSummary) {
    setSaving(true);

    try {
      const nextStatus: BranchStatus =
        branch.status === "active" ? "inactive" : "active";
      const result = await updateBranchStatusAction(
        branch.id,
        nextStatus,
        branch.version,
      );

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Branch status updated.");
      await loadBranches();
    } catch (statusError) {
      const message = getErrorMessage(statusError);
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

        <div className="flex flex-wrap gap-2">
          <Button asChild type="button">
            <Link href={`${webAdminRoutes.tenant.branches}/new`}>
              New branch
            </Link>
          </Button>
          <Button
            disabled={loading}
            onClick={loadBranches}
            type="button"
            variant="outline"
          >
            Refresh
          </Button>
        </div>
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
        <div className="p-5">
          {branches.length === BRANCH_LIST_LIMIT ? (
            <div className="mb-3 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              Only showing the first {BRANCH_LIST_LIMIT} branches. Use search or
              filters to narrow the list.
            </div>
          ) : null}
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
        </div>
      )}
    </section>
  );
}
