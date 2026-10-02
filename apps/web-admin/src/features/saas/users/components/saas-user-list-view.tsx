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
import {
  CircleCheck,
  MailCheck,
  ShieldX,
  UserRoundX,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Pagination } from "@/components/pagination";
import { webAdminRoutes } from "@/config/routes";
import { getCurrentAuthQuery } from "@/features/auth/queries";
import {
  SaasMetricStrip,
  SaasPageHeader,
  SaasTableSurface,
  saasCompactTableClassName,
} from "@/features/saas/shared";
import { useSaasI18n } from "@/i18n";
import { interpolate } from "@/i18n/messages/saas";
import { canManageSaasUsers } from "@/lib/permissions";

import { saasUserStatusOptions } from "../constants";
import { getSaasUserListQuery, getSaasUserStatsQuery } from "../queries";
import type {
  AuthContext,
  SaasUserStatus,
  SaasUserStatusCounts,
  SaasUserSummary,
} from "../types";

type StatusFilter = "all" | SaasUserStatus;

type SaasUserMetrics = SaasUserStatusCounts & {
  total: number;
};

const pageSize = 10;
const lookaheadLimit = pageSize + 1;

const emptyMetrics: SaasUserMetrics = {
  active: 0,
  disabled: 0,
  invited: 0,
  suspended: 0,
  total: 0,
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

function getStatusVariant(
  status: SaasUserStatus,
): "default" | "outline" | "secondary" {
  if (status === "active") {
    return "default";
  }

  if (status === "invited") {
    return "secondary";
  }

  return "outline";
}

export function SaasUserListView() {
  const { m, formatDate } = useSaasI18n();
  const router = useRouter();
  const captionId = useId();
  const requestIdRef = useRef(0);
  const [users, setUsers] = useState<SaasUserSummary[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [offset, setOffset] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [metrics, setMetrics] = useState<SaasUserMetrics>(emptyMetrics);
  const [authContext, setAuthContext] = useState<AuthContext | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const listQuery = useMemo(
    () => ({
      limit: lookaheadLimit,
      offset,
      q: query.trim() || undefined,
      status: status === "all" ? undefined : status,
    }),
    [offset, query, status],
  );
  const canManageMembers =
    !authLoading && !authError && canManageSaasUsers(authContext);

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    Promise.all([
      getSaasUserListQuery(listQuery),
      getSaasUserStatsQuery(query.trim() || undefined),
    ])
      .then(([pageResponse, metricsResponse]) => {
        if (requestIdRef.current !== requestId) {
          return;
        }

        setUsers(pageResponse.slice(0, pageSize));
        setHasNext(pageResponse.length > pageSize);
        setMetrics({
          ...metricsResponse.statusCounts,
          total: metricsResponse.total,
        });
      })
      .catch((loadError: unknown) => {
        if (requestIdRef.current === requestId) {
          setError(getErrorMessage(loadError) || m.users.loadError);
        }
      })
      .finally(() => {
        if (requestIdRef.current === requestId) {
          setLoading(false);
        }
      });
  }, [listQuery, m.users.loadError, query, refreshKey]);

  useEffect(() => {
    let isCurrent = true;

    getCurrentAuthQuery()
      .then((auth) => {
        if (isCurrent) {
          setAuthContext(auth);
          setAuthError(null);
        }
      })
      .catch((authLoadError: unknown) => {
        if (isCurrent) {
          setAuthContext(null);
          setAuthError(getErrorMessage(authLoadError) || m.users.loadError);
        }
      })
      .finally(() => {
        if (isCurrent) {
          setAuthLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [m.users.loadError]);

  function getRoleLabel(role: string): string {
    if (role === "support") {
      return m.common.roleLabels.support;
    }

    if (role === "super_admin") {
      return m.common.roleLabels.superAdmin;
    }

    return role;
  }

  function getLanguageLabel(language: string): string {
    if (language === "en") {
      return m.common.languageLabels.en;
    }

    if (language === "fr") {
      return m.common.languageLabels.fr;
    }

    if (language === "zh-CN") {
      return m.common.languageLabels.zhCN;
    }

    return language;
  }

  return (
    <section className="space-y-7 pb-8">
      <SaasPageHeader
        actions={
          <>
            {canManageMembers ? (
              <Button asChild className="h-8 px-2.5 text-xs" size="sm">
                <Link href={webAdminRoutes.saas.newUser}>
                  {m.users.inviteMember}
                </Link>
              </Button>
            ) : (
              <Button
                className="h-8 px-2.5 text-xs"
                disabled
                size="sm"
                type="button"
              >
                {m.users.inviteMember}
              </Button>
            )}
            <Button
              className="h-8 px-2.5 text-xs"
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
          </>
        }
        icon={Users}
        title={m.users.title}
      />

      {authError ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-800">
          {interpolate(m.users.sessionReadOnlyHint, { error: authError })}
        </div>
      ) : null}

      {!authLoading && !authError && !canManageMembers ? (
        <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          {m.users.readOnlyHint}
        </div>
      ) : null}

      <div className="[&>section]:xl:grid-cols-5">
        <SaasMetricStrip
          loading={loading}
          metrics={[
            {
              icon: Users,
              label: m.users.metrics.total,
              value: metrics.total,
            },
            {
              icon: CircleCheck,
              label: m.users.metrics.active,
              value: metrics.active,
            },
            {
              icon: MailCheck,
              label: m.users.metrics.invited,
              value: metrics.invited,
            },
            {
              icon: UserRoundX,
              label: m.users.metrics.disabled,
              value: metrics.disabled,
            },
            {
              icon: ShieldX,
              label: m.users.metrics.suspended,
              value: metrics.suspended,
            },
          ]}
        />
      </div>

      <SaasTableSurface className="overflow-x-auto">
        <div className="flex min-w-[680px] items-center gap-2 border-b px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <Label className="sr-only" htmlFor="saas-user-search">
              {m.common.search}
            </Label>
            <Input
              className="h-8 max-w-sm text-xs"
              id="saas-user-search"
              onChange={(event) => {
                setLoading(true);
                setError(null);
                setOffset(0);
                setQuery(event.target.value);
              }}
              placeholder={m.users.searchPlaceholder}
              value={query}
            />
          </div>

          <div>
            <Label className="sr-only" htmlFor="saas-user-status-filter">
              {m.common.status}
            </Label>
            <Select
              onValueChange={(value) => {
                setLoading(true);
                setError(null);
                setOffset(0);
                setStatus(value as StatusFilter);
              }}
              value={status}
            >
              <SelectTrigger
                className="h-8 w-40 text-xs"
                id="saas-user-status-filter"
              >
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
        </div>

        {loading ? (
          <div className="grid gap-2 p-3">
            {[0, 1, 2, 3, 4].map((item) => (
              <div
                className="h-11 animate-pulse rounded-md bg-muted"
                key={item}
              />
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
              <h2 className="text-base font-semibold">{m.users.emptyTitle}</h2>
            </div>
          </div>
        ) : (
          <DataTable
            aria-describedby={captionId}
            className={saasCompactTableClassName}
          >
            <TableCaption className="sr-only" id={captionId}>
              {m.users.title}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{m.users.columns.member}</TableHead>
                <TableHead>{m.users.columns.roles}</TableHead>
                <TableHead>{m.common.status}</TableHead>
                <TableHead>{m.users.columns.language}</TableHead>
                <TableHead>{m.users.columns.lastLogin}</TableHead>
                <TableHead>{m.users.columns.created}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const detailHref = webAdminRoutes.saas.user(user.id);
                const roles = user.roles.length > 0 ? user.roles : [user.role];

                return (
                  <TableRow
                    className="cursor-pointer"
                    key={user.id}
                    onClick={(event) => {
                      if (
                        (event.target as Element).closest(
                          "a,button,input,select,textarea",
                        )
                      ) {
                        return;
                      }

                      router.push(detailHref);
                    }}
                    onMouseEnter={() => router.prefetch(detailHref)}
                  >
                    <TableCell>
                      <Link
                        className="font-medium underline-offset-4 hover:underline"
                        href={detailHref}
                      >
                        {user.displayName}
                      </Link>
                      <div className="text-[11px] text-muted-foreground">
                        {user.email ?? user.phone ?? user.id}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {roles.map((role) => (
                          <Badge
                            className="px-1.5 py-0 text-[10px]"
                            key={role}
                            variant="outline"
                          >
                            {getRoleLabel(role)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className="px-1.5 py-0 text-[10px]"
                        variant={getStatusVariant(user.status)}
                      >
                        {m.common.statusLabels[user.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{getLanguageLabel(user.language)}</TableCell>
                    <TableCell>
                      {user.lastLoginAt
                        ? formatDate(user.lastLoginAt)
                        : m.common.never}
                    </TableCell>
                    <TableCell>
                      {formatDate(user.createdAt) || m.common.invalidDate}
                    </TableCell>
                  </TableRow>
                );
              })}
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
