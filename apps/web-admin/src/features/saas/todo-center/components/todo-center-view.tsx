"use client";

import { Button, Icon, cn } from "@cleanhub/ui";
import {
  AlertTriangle,
  CircleCheckBig,
  DatabaseBackup,
  ListChecks,
  MessageSquareWarning,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { SaasMetricStrip, SaasPageHeader } from "@/features/saas/shared";
import { useSaasI18n } from "@/i18n";

import { getTodoCenterQuery } from "../queries";
import {
  todoCenterTotal,
  type TodoCenterResult,
  type TodoItem,
} from "../types";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

export function TodoCenterView() {
  const { m, formatDateTime } = useSaasI18n();
  const copy = m.todoCenter;
  const [result, setResult] = useState<TodoCenterResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setResult(await getTodoCenterQuery());
    } catch (loadError) {
      setError(getErrorMessage(loadError) || copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError]);

  useEffect(() => {
    let isCurrent = true;

    getTodoCenterQuery()
      .then((data) => {
        if (isCurrent) {
          setResult(data);
        }
      })
      .catch((loadError: unknown) => {
        if (isCurrent) {
          setError(getErrorMessage(loadError) || copy.loadError);
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
  }, [copy.loadError]);

  const total = result ? todoCenterTotal(result) : 0;

  return (
    <section className="space-y-7 pb-8">
      <SaasPageHeader
        actions={
          <Button
            className="h-8 gap-1.5 px-2.5 text-xs"
            disabled={loading}
            onClick={load}
            size="sm"
            type="button"
            variant="outline"
          >
            <Icon
              aria-hidden
              className={loading ? "animate-spin" : undefined}
              icon={RefreshCw}
              size={14}
            />
            {m.common.refresh}
          </Button>
        }
        description={copy.description}
        icon={ListChecks}
        title={copy.title}
      />

      {loading ? (
        <div className="grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              className="h-40 animate-pulse rounded-md bg-muted"
              key={item}
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : total === 0 ? (
        <div className="border-y border-dashed bg-background px-5 py-14 text-center">
          <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Icon aria-hidden icon={CircleCheckBig} size={18} />
          </span>
          <h2 className="mt-3 text-base font-semibold">{copy.emptyTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{copy.emptyBody}</p>
        </div>
      ) : (
        <div className="grid gap-7">
          <SaasMetricStrip
            metrics={[
              {
                icon: ListChecks,
                label: copy.total,
                value: total.toLocaleString(),
              },
              {
                icon: MessageSquareWarning,
                label: copy.feedbackQueue.title,
                value: <TodoCount count={result?.feedbackTickets.count ?? 0} />,
              },
              {
                icon: DatabaseBackup,
                label: copy.restoreQueue.title,
                value: <TodoCount count={result?.restoreRequests.count ?? 0} />,
              },
              {
                icon: AlertTriangle,
                label: copy.securityQueue.title,
                value: <TodoCount count={result?.securityEvents.count ?? 0} />,
              },
            ]}
          />

          <div className="grid overflow-hidden border-y bg-background lg:grid-cols-3 lg:divide-x">
            <TodoQueueCard
              emptyText={copy.feedbackQueue.empty}
              href={webAdminRoutes.saas.feedbackTickets}
              icon={MessageSquareWarning}
              items={result?.feedbackTickets.items ?? []}
              renderTitle={(item) => {
                if (item.kind === "feedbackTicket") {
                  return item.data.title;
                }
                return copy.untitled;
              }}
              renderMeta={(item) => {
                if (item.kind === "feedbackTicket") {
                  return (
                    formatDateTime(item.data.createdAt) || m.common.invalidDate
                  );
                }
                return "";
              }}
              title={copy.feedbackQueue.title}
              viewAll={copy.feedbackQueue.viewAll}
            />
            <TodoQueueCard
              emptyText={copy.restoreQueue.empty}
              href={webAdminRoutes.saas.system.backups}
              icon={DatabaseBackup}
              items={result?.restoreRequests.items ?? []}
              renderTitle={(item) => {
                if (item.kind === "restoreRequest") {
                  return item.data.reason || copy.untitled;
                }
                return copy.untitled;
              }}
              renderMeta={(item) => {
                if (item.kind === "restoreRequest") {
                  return (
                    formatDateTime(item.data.createdAt) || m.common.invalidDate
                  );
                }
                return "";
              }}
              title={copy.restoreQueue.title}
              viewAll={copy.restoreQueue.viewAll}
            />
            <TodoQueueCard
              emptyText={copy.securityQueue.empty}
              href={webAdminRoutes.saas.auditSecurity}
              icon={AlertTriangle}
              items={result?.securityEvents.items ?? []}
              renderTitle={(item) => {
                if (item.kind === "securityEvent") {
                  return item.data.description || item.data.eventType;
                }
                return copy.untitled;
              }}
              renderMeta={(item) => {
                if (item.kind === "securityEvent") {
                  return (
                    formatDateTime(item.data.createdAt) || m.common.invalidDate
                  );
                }
                return "";
              }}
              title={copy.securityQueue.title}
              viewAll={copy.securityQueue.viewAll}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function TodoCount({ count }: { count: number }) {
  return (
    <span className={cn(count > 0 && "text-destructive")}>
      {count.toLocaleString()}
    </span>
  );
}

type LucideIconish = typeof AlertTriangle;

type TodoQueueCardProps = {
  title: string;
  emptyText: string;
  viewAll: string;
  href: string;
  icon: LucideIconish;
  items: TodoItem[];
  renderTitle: (item: TodoItem) => string;
  renderMeta: (item: TodoItem) => string;
};

function TodoQueueCard({
  title,
  emptyText,
  viewAll,
  href,
  icon: Icon,
  items,
  renderTitle,
  renderMeta,
}: TodoQueueCardProps) {
  return (
    <section className="flex min-w-0 flex-col border-b p-4 last:border-b-0 lg:border-b-0">
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icon aria-hidden />
          </span>
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>

        {items.length === 0 ? (
          <p className="flex-1 py-6 text-center text-sm text-muted-foreground">
            {emptyText}
          </p>
        ) : (
          <ul className="grid flex-1 content-start gap-1">
            {items.map((item) => (
              <li
                className="rounded-md border bg-background px-3 py-2"
                key={item.data.id}
              >
                <p className="line-clamp-2 text-sm font-medium">
                  {renderTitle(item)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {renderMeta(item)}
                </p>
              </li>
            ))}
          </ul>
        )}

        <Button
          asChild
          className="h-8 text-xs"
          size="sm"
          type="button"
          variant="outline"
        >
          <Link href={href}>{viewAll}</Link>
        </Button>
      </div>
    </section>
  );
}
