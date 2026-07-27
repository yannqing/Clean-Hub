import type { ReactNode } from "react";

function SkeletonBlock({ className }: { className: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-slate-200 ${className}`} />
  );
}

function SkeletonCard({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {children}
    </section>
  );
}

function MetricsSkeleton() {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <SkeletonCard key={index}>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-3">
              <SkeletonBlock className="h-3 w-20" />
              <SkeletonBlock className="h-7 w-16" />
            </div>
            <SkeletonBlock className="h-9 w-9 rounded-xl" />
          </div>
          <SkeletonBlock className="mt-4 h-2 w-28" />
        </SkeletonCard>
      ))}
    </div>
  );
}

function ToolbarSkeleton() {
  return (
    <SkeletonCard>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <SkeletonBlock className="h-8 w-28" />
          <SkeletonBlock className="h-8 w-28" />
        </div>
        <SkeletonBlock className="h-3 w-24" />
      </div>
      <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
        <SkeletonBlock className="h-10 min-w-[260px] flex-1" />
        <SkeletonBlock className="h-10 w-32" />
        <SkeletonBlock className="h-10 w-32" />
        <SkeletonBlock className="h-10 w-32" />
        <SkeletonBlock className="h-10 w-28" />
      </div>
    </SkeletonCard>
  );
}

function TableSkeleton() {
  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div className="space-y-2">
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-3 w-56" />
        </div>
        <SkeletonBlock className="h-9 w-24" />
      </div>
      <div className="min-w-[860px]">
        <div className="grid grid-cols-[130px_minmax(190px,1.2fr)_100px_110px_110px_150px_90px] bg-slate-50 px-5 py-3">
          {Array.from({ length: 7 }).map((_, index) => (
            <SkeletonBlock className="h-3 w-16" key={index} />
          ))}
        </div>
        {Array.from({ length: 7 }).map((_, rowIndex) => (
          <div
            className="grid grid-cols-[130px_minmax(190px,1.2fr)_100px_110px_110px_150px_90px] items-center border-t border-slate-100 px-5 py-4"
            key={rowIndex}
          >
            <div className="space-y-2">
              <SkeletonBlock className="h-3 w-24" />
              <SkeletonBlock className="h-2.5 w-14" />
            </div>
            <div className="space-y-2">
              <SkeletonBlock className="h-4 w-40" />
              <SkeletonBlock className="h-3 w-56" />
            </div>
            <SkeletonBlock className="h-6 w-16 rounded-full" />
            <SkeletonBlock className="h-6 w-20 rounded-full" />
            <SkeletonBlock className="h-6 w-20 rounded-full" />
            <div className="space-y-2">
              <SkeletonBlock className="h-3 w-24" />
              <SkeletonBlock className="h-2.5 w-16" />
            </div>
            <div className="flex justify-end">
              <SkeletonBlock className="h-8 w-8" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function PosRouteLoading() {
  return (
    <section aria-busy="true" aria-live="polite">
      <div className="mb-5 flex items-center gap-1.5">
        <SkeletonBlock className="h-3 w-8" />
        <SkeletonBlock className="h-3 w-3" />
        <SkeletonBlock className="h-3 w-20" />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <SkeletonBlock className="h-8 w-36" />
          <SkeletonBlock className="h-4 w-80 max-w-[70vw]" />
        </div>
        <SkeletonBlock className="h-10 w-44" />
      </div>

      <MetricsSkeleton />
      <div className="mt-4">
        <ToolbarSkeleton />
      </div>
      <TableSkeleton />
    </section>
  );
}
