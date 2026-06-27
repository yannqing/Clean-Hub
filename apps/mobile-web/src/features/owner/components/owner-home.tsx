"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import type { MobileOwnerTodaySummary } from "@cleanhub/api-client";
import { Button } from "@cleanhub/ui";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  Loader2,
  PackageCheck,
  RefreshCcw,
  Shirt,
  TrendingUp,
  Truck,
} from "lucide-react";

import { getOwnerTodaySummary } from "../queries";

type OwnerHomeProps = {
  initialSummary?: MobileOwnerTodaySummary | null;
};

type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: true }>;

type MetricItem = {
  label: string;
  value: string;
  detail: string;
  icon: IconComponent;
  tone: "teal" | "emerald" | "amber" | "sky";
};

const numberFormatter = new Intl.NumberFormat("fr-FR");
const moneyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "XOF",
  maximumFractionDigits: 0,
});
const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
});
const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
});

const tenantStatusLabels: Record<MobileOwnerTodaySummary["tenantStatus"], string> = {
  active: "Actif",
  disabled: "Désactivé",
  suspended: "Suspendu",
};

const toneClasses: Record<MetricItem["tone"], string> = {
  amber: "bg-amber-50 text-amber-700",
  emerald: "bg-emerald-50 text-emerald-700",
  sky: "bg-sky-50 text-sky-700",
  teal: "bg-teal-50 text-teal-700",
};

function formatCount(value: number): string {
  return numberFormatter.format(value);
}

function formatMoney(value: number): string {
  return moneyFormatter.format(value);
}

function formatBusinessDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const date =
    year && month && day ? new Date(year, month - 1, day) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dateFormatter.format(date);
}

function formatLoadTime(value: Date | null): string | null {
  return value ? timeFormatter.format(value) : null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Impossible de charger le résumé pour le moment.";
}

function createMetrics(summary: MobileOwnerTodaySummary): MetricItem[] {
  return [
    {
      label: "Commandes",
      value: formatCount(summary.todayOrderCount),
      detail: "Aujourd'hui",
      icon: PackageCheck,
      tone: "teal",
    },
    {
      label: "Chiffre d'affaires",
      value: formatMoney(summary.todayRevenueAmount),
      detail: "Aujourd'hui",
      icon: TrendingUp,
      tone: "emerald",
    },
    {
      label: "À récupérer",
      value: formatCount(summary.pendingPickupCount),
      detail: "En attente",
      icon: Shirt,
      tone: "amber",
    },
    {
      label: "En cours",
      value: formatCount(summary.inProgressOrderCount),
      detail: "Traitement",
      icon: Clock3,
      tone: "sky",
    },
  ];
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-base font-semibold tabular-nums text-slate-950">
        {formatCount(value)}
      </span>
    </div>
  );
}

function MetricTile({ metric }: { metric: MetricItem }) {
  const Icon = metric.icon;

  return (
    <div className="min-h-32 rounded-md border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-600">{metric.label}</span>
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-md ${toneClasses[metric.tone]}`}>
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-4 break-words text-2xl font-semibold leading-tight tabular-nums text-slate-950">
        {metric.value}
      </p>
      <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
        {metric.detail}
      </p>
    </div>
  );
}

function OwnerSummaryContent({
  lastLoadedAt,
  summary,
}: {
  lastLoadedAt: Date | null;
  summary: MobileOwnerTodaySummary;
}) {
  const metrics = useMemo(() => createMetrics(summary), [summary]);
  const loadTime = formatLoadTime(lastLoadedAt);

  return (
    <>
      <section className="mt-5">
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((metric) => (
            <MetricTile key={metric.label} metric={metric} />
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-violet-50 text-violet-700">
            <CalendarDays className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-950">Rendez-vous</h2>
            <p className="mt-1 text-sm text-slate-600">
              {formatBusinessDate(summary.businessDate)}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <SummaryRow label="En attente" value={summary.appointmentSummary.pending} />
          <SummaryRow label="Acceptés" value={summary.appointmentSummary.accepted} />
          <SummaryRow label="Terminés" value={summary.appointmentSummary.done} />
          <SummaryRow label="Annulés" value={summary.appointmentSummary.cancelled} />
        </div>
      </section>

      <section className="mt-5 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-cyan-50 text-cyan-700">
            <Truck className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-950">Livraison</h2>
            <p className="mt-1 text-sm text-slate-600">
              {summary.featureFlags.deliveryEnabled ? "Service actif" : "Service inactif"}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <SummaryRow label="À répartir" value={summary.deliverySummary.pendingDispatch} />
          <SummaryRow label="En tournée" value={summary.deliverySummary.inProgress} />
          <SummaryRow label="Signées" value={summary.deliverySummary.signed} />
          <SummaryRow label="Exceptions" value={summary.deliverySummary.exception} />
        </div>
      </section>

      {loadTime ? (
        <p className="mt-4 text-center text-xs text-slate-500">
          Mis à jour à {loadTime}
        </p>
      ) : null}
    </>
  );
}

export function OwnerHome({ initialSummary = null }: OwnerHomeProps) {
  const [summary, setSummary] = useState<MobileOwnerTodaySummary | null>(initialSummary);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!initialSummary);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(
    initialSummary ? new Date() : null,
  );

  const loadSummary = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const nextSummary = await getOwnerTodaySummary({ signal });

      if (signal?.aborted) {
        return;
      }

      setSummary(nextSummary);
      setLastLoadedAt(new Date());
    } catch (nextError) {
      if (signal?.aborted) {
        return;
      }

      setError(getErrorMessage(nextError));
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (initialSummary) {
      return;
    }

    const controller = new AbortController();
    getOwnerTodaySummary({ signal: controller.signal })
      .then((nextSummary) => {
        if (controller.signal.aborted) {
          return;
        }

        setSummary(nextSummary);
        setLastLoadedAt(new Date());
      })
      .catch((nextError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setError(getErrorMessage(nextError));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [initialSummary]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-8 pt-[max(24px,env(safe-area-inset-top))]">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
            <Eye className="size-4" aria-hidden />
            Lecture seule
          </p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight text-slate-950">
            Résumé du jour
          </h1>
          <p className="mt-2 break-words text-sm leading-6 text-slate-600">
            {summary ? summary.tenantName : "Chargement du pressing"}
          </p>
        </div>
        <Button
          aria-label="Actualiser le résumé"
          className="size-11 shrink-0 p-0"
          disabled={isLoading}
          type="button"
          variant="secondary"
          onClick={() => {
            void loadSummary();
          }}
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCcw className="size-4" aria-hidden />
          )}
        </Button>
      </header>

      {summary ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
          <span className="min-w-0 truncate text-slate-600">
            {formatBusinessDate(summary.businessDate)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="size-3.5" aria-hidden />
            {tenantStatusLabels[summary.tenantStatus]}
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>{error}</p>
          </div>
        </div>
      ) : null}

      {isLoading && !summary ? (
        <div className="mt-8 flex items-center justify-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-6 text-sm text-slate-700 shadow-sm">
          <Loader2 className="size-4 animate-spin text-teal-700" aria-hidden />
          Chargement des indicateurs
        </div>
      ) : null}

      {summary ? (
        <OwnerSummaryContent lastLoadedAt={lastLoadedAt} summary={summary} />
      ) : null}
    </main>
  );
}
