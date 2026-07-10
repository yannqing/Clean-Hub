"use client";

import { Badge, Button, Card, CardContent, cn } from "@cleanhub/ui";
import {
  AlertTriangle,
  DatabaseBackup,
  MessageSquareWarning,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { useSaasI18n } from "@/i18n";

import { getTodoCenterQuery } from "../queries";
import { todoCenterTotal, type TodoCenterResult, type TodoItem } from "../types";

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
    <section className="min-h-[560px]">
      <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">{copy.badge}</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            {copy.title}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {copy.description}
          </p>
        </div>

        <Button onClick={load} type="button" variant="outline">
          {m.common.refresh}
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3 p-5 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div className="h-40 animate-pulse rounded-md bg-muted" key={item} />
          ))}
        </div>
      ) : error ? (
        <div className="p-5">
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        </div>
      ) : total === 0 ? (
        <div className="p-5">
          <div className="rounded-md border border-dashed p-8 text-center">
            <h2 className="text-base font-semibold">{copy.emptyTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {copy.emptyBody}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-lg">
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {copy.total}
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {total.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <TodoCountCard
              count={result?.feedbackTickets.count ?? 0}
              label={copy.feedbackQueue.title}
            />
            <TodoCountCard
              count={result?.restoreRequests.count ?? 0}
              label={copy.restoreQueue.title}
            />
            <TodoCountCard
              count={result?.securityEvents.count ?? 0}
              label={copy.securityQueue.title}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
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
                  return formatDateTime(item.data.createdAt) || m.common.invalidDate;
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
                  return formatDateTime(item.data.createdAt) || m.common.invalidDate;
                }
                return "";
              }}
              title={copy.restoreQueue.title}
              viewAll={copy.restoreQueue.viewAll}
            />
            <TodoQueueCard
              emptyText={copy.securityQueue.empty}
              href={webAdminRoutes.saas.system.security}
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
                  return formatDateTime(item.data.createdAt) || m.common.invalidDate;
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

function TodoCountCard({ count, label }: { count: number; label: string }) {
  return (
    <Card className="rounded-lg">
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            "mt-2 text-2xl font-semibold",
            count > 0 && "text-destructive",
          )}
        >
          {count.toLocaleString()}
        </p>
      </CardContent>
    </Card>
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
    <Card className="flex flex-col rounded-lg">
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icon aria-hidden className="size-4" />
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

        <Button asChild size="sm" type="button" variant="outline">
          <Link href={href}>{viewAll}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
