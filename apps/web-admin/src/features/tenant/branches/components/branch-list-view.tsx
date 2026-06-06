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
} from "@cleanhub/ui";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { webAdminRoutes } from "@/config/routes";

import { BRANCH_LIST_LIMIT, getBranchListQuery } from "../queries";
import type {
  BranchListFilters,
  BranchStatus,
  BranchSummary,
} from "../types";

type StatusFilter = "all" | BranchStatus;

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

export type BranchListViewProps = {
  initialBranches?: BranchSummary[];
  initialError?: string;
  initialFilters?: BranchListFilters;
};

export function BranchListView({
  initialBranches,
  initialError,
  initialFilters,
}: BranchListViewProps = {}) {
  const [branches, setBranches] = useState<BranchSummary[]>(
    initialBranches ?? [],
  );
  const [query, setQuery] = useState(initialFilters?.q ?? "");
  const [status, setStatus] = useState<StatusFilter>(
    initialFilters?.status ?? "all",
  );
  const [loading, setLoading] = useState(!initialBranches && !initialError);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const isFirstFilterEffect = useRef(true);

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
    if (
      isFirstFilterEffect.current &&
      (initialBranches !== undefined || initialError !== undefined)
    ) {
      isFirstFilterEffect.current = false;
      return;
    }

    isFirstFilterEffect.current = false;
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
  }, [filters, initialBranches, initialError]);

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
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`${webAdminRoutes.tenant.branches}/new`}>
              Create branch
            </Link>
          </Button>
          <Button onClick={loadBranches} type="button" variant="outline">
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 border-b p-5 lg:grid-cols-[1fr_220px]">
        <div className="grid gap-2">
          <Label htmlFor="branch-search">Search</Label>
          <Input
            id="branch-search"
            maxLength={120}
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

      <div className="p-5">
        {error ? (
          <div className="flex flex-col gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <Button
              onClick={loadBranches}
              size="sm"
              type="button"
              variant="outline"
            >
              Retry
            </Button>
          </div>
        ) : null}
        {!error && loading ? (
          <div className="h-44 animate-pulse rounded-md bg-muted" />
        ) : null}
        {!error && !loading ? (
          <>
            {branches.length === BRANCH_LIST_LIMIT ? (
              <div className="mb-3 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                The response reached the {BRANCH_LIST_LIMIT}-branch limit.
                There may be more branches; use search or filters to narrow the
                list.
              </div>
            ) : null}
            <Table>
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
            </Table>
          </>
        ) : null}
      </div>
    </section>
  );
}
