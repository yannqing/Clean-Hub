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
} from "@cleanhub/ui";
import { DataTable } from "@cleanhub/ui/data-table";
import { UsersRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Pagination } from "@/components/pagination";
import { webAdminRoutes } from "@/config/routes";
import { SaasPageHeader, SaasTableSurface, saasCompactTableClassName } from "@/features/saas/shared";
import { useSaasI18n } from "@/i18n";

import { saasUserStatusOptions } from "../constants";
import { getSaasTenantAdminListQuery } from "../queries";
import type { SaasTenantAdminSummary, SaasUserStatus } from "../types";

type StatusFilter = "all" | SaasUserStatus;
const pageSize = 10;

export function SaasTenantAdminListView() {
  const { m, formatDate } = useSaasI18n();
  const captionId = useId();
  const requestIdRef = useRef(0);
  const [users, setUsers] = useState<SaasTenantAdminSummary[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [offset, setOffset] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const listQuery = useMemo(() => ({
    limit: pageSize + 1,
    offset,
    q: query.trim() || undefined,
    status: status === "all" ? undefined : status,
  }), [offset, query, status]);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    getSaasTenantAdminListQuery(listQuery)
      .then((result) => {
        if (requestIdRef.current !== requestId) return;
        setUsers(result.slice(0, pageSize));
        setHasNext(result.length > pageSize);
      })
      .catch((loadError: unknown) => {
        if (requestIdRef.current !== requestId) return;
        setError(loadError instanceof Error ? loadError.message : m.users.tenantAdminsLoadError);
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setLoading(false);
      });
  }, [listQuery, m.users.tenantAdminsLoadError, refreshKey]);

  return (
    <section className="space-y-5 pb-8">
      <SaasPageHeader
        actions={
          <Button
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setError(null);
              setRefreshKey((current) => current + 1);
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            {m.common.refresh}
          </Button>
        }
        icon={UsersRound}
        title={m.users.tenantAdminsTitle}
      />
      <p className="text-sm text-muted-foreground">{m.users.tenantAdminsHint}</p>

      <SaasTableSurface className="overflow-x-auto">
        <div className="flex min-w-[720px] items-center gap-2 border-b px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <Label className="sr-only" htmlFor="tenant-admin-search">{m.common.search}</Label>
            <Input
              className="h-8 max-w-sm text-xs"
              id="tenant-admin-search"
              onChange={(event) => {
                setLoading(true);
                setError(null);
                setOffset(0);
                setQuery(event.target.value);
              }}
              placeholder={m.users.tenantAdminsSearchPlaceholder}
              value={query}
            />
          </div>
          <Label className="sr-only" htmlFor="tenant-admin-status-filter">{m.common.status}</Label>
          <Select
            onValueChange={(value) => {
              setLoading(true);
              setError(null);
              setOffset(0);
              setStatus(value as StatusFilter);
            }}
            value={status}
          >
            <SelectTrigger className="h-8 w-40 text-xs" id="tenant-admin-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{m.common.allStatuses}</SelectItem>
              {saasUserStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {m.common.statusLabels[option.value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="grid gap-2 p-3">
            {[0, 1, 2, 3, 4].map((item) => (
              <div className="h-11 animate-pulse rounded-md bg-muted" key={item} />
            ))}
          </div>
        ) : error ? (
          <div className="p-3">
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          </div>
        ) : users.length === 0 ? (
          <div className="p-3">
            <div className="rounded-md border border-dashed p-8 text-center">
              <h2 className="text-base font-semibold">{m.users.tenantAdminsEmpty}</h2>
            </div>
          </div>
        ) : (
          <DataTable aria-describedby={captionId} className={saasCompactTableClassName}>
            <TableCaption className="sr-only" id={captionId}>{m.users.tenantAdminsTitle}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{m.users.columns.member}</TableHead>
                <TableHead>{m.users.tenantColumn}</TableHead>
                <TableHead>{m.users.columns.roles}</TableHead>
                <TableHead>{m.common.status}</TableHead>
                <TableHead>{m.users.columns.lastLogin}</TableHead>
                <TableHead>{m.users.columns.created}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="font-medium">{user.displayName}</div>
                    <div className="text-[11px] text-muted-foreground">{user.email ?? user.phone ?? user.id}</div>
                  </TableCell>
                  <TableCell>
                    <Link className="font-medium underline-offset-4 hover:underline" href={webAdminRoutes.saas.tenant(user.tenantId)}>
                      {user.tenantName}
                    </Link>
                    <div className="text-[11px] text-muted-foreground">{user.tenantCode}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <Badge className="px-1.5 py-0 text-[10px]" key={role} variant="outline">
                          {role === "owner" ? m.users.ownerRole : m.users.managerRole}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className="px-1.5 py-0 text-[10px]" variant={user.status === "active" ? "default" : "outline"}>
                      {m.common.statusLabels[user.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.lastLoginAt ? formatDate(user.lastLoginAt) : m.common.never}</TableCell>
                  <TableCell>{formatDate(user.createdAt) || m.common.invalidDate}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        )}
        <Pagination
          currentPageCount={users.length}
          hasNext={hasNext}
          nextLabel={m.common.nextPage}
          offset={offset}
          onOffsetChange={(nextOffset) => {
            setLoading(true);
            setError(null);
            setOffset(nextOffset);
          }}
          pageSize={pageSize}
          previousLabel={m.common.previousPage}
        />
      </SaasTableSurface>
    </section>
  );
}
