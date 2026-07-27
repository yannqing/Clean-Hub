"use client";

import type { ReactNode } from "react";
import {
  ResponsiveContainer,
  type TooltipContentProps,
  type TooltipPayloadEntry,
  type TooltipValueType,
} from "recharts";

import { cn } from "@/lib/utils";

type PosChartContainerProps = {
  children: ReactNode;
  className?: string;
};

type PosChartDatum = {
  color?: string;
  displayValue?: string;
  fill?: string;
  helper?: string;
  label?: string;
  name?: string;
  value?: number | string;
};

type PosChartTooltipProps = Partial<
  TooltipContentProps<TooltipValueType, string>
> & {
  hideLabel?: boolean;
  labelFormatter?: (
    label: string | number | undefined,
    payload: PosChartDatum | undefined,
  ) => ReactNode;
  valueFormatter?: (
    value: TooltipPayloadEntry["value"],
    name: TooltipPayloadEntry["name"],
    payload: PosChartDatum,
  ) => ReactNode;
};

function getTooltipPayload(entry: TooltipPayloadEntry): PosChartDatum {
  return (entry.payload ?? {}) as PosChartDatum;
}

function resolveTooltipColor(
  entry: TooltipPayloadEntry,
  payload: PosChartDatum,
): string {
  return (
    payload.color ??
    payload.fill ??
    (typeof entry.color === "string" ? entry.color : undefined) ??
    "var(--chart-1)"
  );
}

export function PosChartContainer({
  children,
  className,
}: PosChartContainerProps) {
  return (
    <div className={cn("h-56 w-full", className)}>
      <ResponsiveContainer height="100%" width="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export function PosChartTooltip({
  active,
  hideLabel,
  label,
  labelFormatter,
  payload,
  valueFormatter,
}: PosChartTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const firstPayload = getTooltipPayload(payload[0]);
  const title = labelFormatter
    ? labelFormatter(label, firstPayload)
    : (firstPayload.label ?? firstPayload.name ?? label);

  return (
    <div className="min-w-36 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-xl">
      {!hideLabel && title ? (
        <p className="mb-1.5 font-semibold text-slate-900">{title}</p>
      ) : null}
      <div className="space-y-1.5">
        {payload.map((entry, index) => {
          const entryPayload = getTooltipPayload(entry);
          const color = resolveTooltipColor(entry, entryPayload);
          const name = entryPayload.label ?? entry.name;
          const value =
            entryPayload.displayValue ??
            valueFormatter?.(entry.value, entry.name, entryPayload) ??
            String(entry.value ?? "");

          return (
            <div className="space-y-0.5" key={`${String(entry.name)}-${index}`}>
              <div className="flex min-w-0 items-center justify-between gap-4">
                <span className="flex min-w-0 items-center gap-2 text-slate-600">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="truncate">{name}</span>
                </span>
                <span className="shrink-0 font-semibold text-slate-950">
                  {value}
                </span>
              </div>
              {entryPayload.helper ? (
                <p className="pl-4 text-slate-400">{entryPayload.helper}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
