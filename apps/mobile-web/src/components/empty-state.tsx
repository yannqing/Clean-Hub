"use client";

import type { ComponentType, ReactNode } from "react";

type EmptyStateIcon = ComponentType<{
  className?: string;
  "aria-hidden"?: true;
}>;

export function EmptyState({
  action,
  body,
  icon: Icon,
  title,
}: {
  action?: ReactNode;
  body: string;
  icon: EmptyStateIcon;
  title: string;
}) {
  return (
    <section className="rounded-md border border-dashed border-slate-300 bg-white p-5 text-center">
      <div className="mx-auto flex size-11 items-center justify-center rounded-md bg-slate-100 text-slate-600">
        <Icon className="size-5" aria-hidden />
      </div>
      <h2 className="mt-3 text-base font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}
