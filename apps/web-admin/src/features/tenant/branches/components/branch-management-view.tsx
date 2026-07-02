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
import { useEffect, useMemo, useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { interpolate, useTenantI18n } from "@/i18n";

import { updateBranchStatusAction } from "../actions";
import { BRANCH_LIST_LIMIT, useBranchListQuery } from "../queries";
import type {
  BranchListFilters,
  BranchStatus,
  BranchSummary,
} from "../types";

type StatusFilter = "all" | BranchStatus;

function getBranchStatusVariant(status: BranchStatus): "default" | "outline" {
  return status === "active" ? "default" : "outline";
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
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
  const { m, formatDateTime } = useTenantI18n();
  const [status, setStatus] = useState<StatusFilter>(
    initialFilters?.status ?? "all",
  );
  const [query, setQuery] = useState(initialFilters?.q ?? "");
  const [saving, setSaving] = useState(false);

  const filters: BranchListFilters = useMemo(
    () => ({
      q: query.trim() || undefined,
      status: status === "all" ? undefined : status,
    }),
    [query, status],
  );

  const { data: branches = [], error, refetch, isFetching } = useBranchListQuery(
    filters,
    {
      // SSR 预取结果作为 initialData，实现 hydrate；
      // 写操作（Server Action）成功后 revalidatePath 触发 RSC 重取，
      // 新的 initialData 流入，数据自动更新。
      initialData: initialBranches,
    },
  );

  // 筛选条件变化时同步 URL（保留可分享/可刷新的链接）。
  useEffect(() => {
    router.replace(buildBranchListUrl(pathname, filters), { scroll: false });
  }, [filters, pathname, router]);

  // initialError 仅在首次 SSR 预取失败时存在；client 端错误改由 useQuery 的 error 接管。
  const errorMessage = initialError ?? (error ? getErrorMessage(error, m.common.requestFailed) : null);
  const loading = isFetching && branches.length === 0;

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

      toast.success(m.branches.list.statusUpdated);
      await refetch();
    } catch (statusError) {
      const message = getErrorMessage(statusError, m.common.requestFailed);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="min-h-[560px]">
      <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">{m.branches.eyebrow}</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            {m.branches.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {m.branches.listDescription}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild type="button">
            <Link href={`${webAdminRoutes.tenant.branches}/new`}>
              {m.branches.newBranch}
            </Link>
          </Button>
          <Button
            disabled={loading}
            onClick={() => refetch()}
            type="button"
            variant="outline"
          >
            {m.common.refresh}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 border-b p-5 lg:grid-cols-[1fr_180px]">
        <div className="grid gap-2">
          <Label htmlFor="branch-search">{m.common.search}</Label>
          <Input
            id="branch-search"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder={m.branches.list.searchPlaceholder}
            value={query}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="branch-status">{m.common.status}</Label>
          <Select
            onValueChange={(value) => {
              setStatus(value as StatusFilter);
            }}
            value={status}
          >
            <SelectTrigger id="branch-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{m.common.allStatuses}</SelectItem>
              <SelectItem value="active">
                {m.common.statusLabels.active}
              </SelectItem>
              <SelectItem value="inactive">
                {m.common.statusLabels.inactive}
              </SelectItem>
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
      ) : errorMessage ? (
        <div className="p-5">
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {errorMessage}
          </div>
        </div>
      ) : branches.length === 0 ? (
        <div className="p-5">
          <div className="rounded-md border border-dashed p-8 text-center">
            <h2 className="text-base font-semibold">{m.branches.list.empty}</h2>
          </div>
        </div>
      ) : (
        <div className="p-5">
          {branches.length === BRANCH_LIST_LIMIT ? (
            <div className="mb-3 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              {interpolate(m.branches.list.limitedHint, {
                limit: String(BRANCH_LIST_LIMIT),
              })}
            </div>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{m.branches.list.columns.branch}</TableHead>
                <TableHead>{m.branches.list.columns.contact}</TableHead>
                <TableHead>{m.branches.list.columns.defaults}</TableHead>
                <TableHead>{m.branches.list.columns.status}</TableHead>
                <TableHead>{m.branches.list.columns.updated}</TableHead>
                <TableHead className="text-right">
                  {m.branches.list.columns.actions}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((branch) => (
                <TableRow key={branch.id}>
                  <TableCell>
                    <div className="font-medium">{branch.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {branch.address ?? m.common.notSet}
                    </div>
                  </TableCell>
                  <TableCell>{branch.phone ?? m.common.notSet}</TableCell>
                  <TableCell>
                    {m.common.languageLabels[branch.defaultLanguage]} /{" "}
                    {branch.defaultCurrency}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getBranchStatusVariant(branch.status)}>
                      {m.common.statusLabels[branch.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {formatDateTime(branch.updatedAt) || m.common.notUpdated}
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button asChild size="sm" type="button" variant="outline">
                      <Link href={branchDetailHref(branch.id)}>
                        {m.common.open}
                      </Link>
                    </Button>
                    <Button
                      disabled={saving}
                      onClick={() => void handleStatusChange(branch)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {branch.status === "active"
                        ? m.common.disable
                        : m.common.enable}
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
