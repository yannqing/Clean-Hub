"use client";

import {
  AlertCircle,
  CheckCircle2,
  DatabaseZap,
  Info,
  TriangleAlert,
} from "lucide-react";

const toneClasses = {
  cache: "border-slate-200 bg-slate-50 text-slate-700",
  error: "border-red-200 bg-red-50 text-red-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
};

const toneIcons = {
  cache: DatabaseZap,
  error: AlertCircle,
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
};

export function AlertBanner({
  message,
  tone,
}: {
  message: string;
  tone: keyof typeof toneClasses;
}) {
  const Icon = toneIcons[tone];

  return (
    <div
      className={`mb-4 rounded-md border px-3 py-2 text-sm ${toneClasses[tone]}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="min-w-0 leading-5">{message}</p>
      </div>
    </div>
  );
}
