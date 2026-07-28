import type { ReactNode } from "react";

function SkeletonBlock({ className }: { className: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-md bg-slate-200 ${className}`}
    />
  );
}

function SkeletonSurface({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-hidden
      className={`border-y border-slate-200 bg-white ${className}`}
    >
      {children}
    </section>
  );
}

function BreadcrumbSkeleton() {
  return (
    <div className="flex items-center gap-2">
      <SkeletonBlock className="h-8 w-8" />
      <SkeletonBlock className="h-3.5 w-3.5" />
      <SkeletonBlock className="h-4 w-24" />
    </div>
  );
}

function HeaderSkeleton({ action = true }: { action?: boolean }) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="space-y-2">
        <SkeletonBlock className="h-6 w-40" />
        <SkeletonBlock className="h-4 w-72 max-w-[65vw]" />
      </div>
      {action ? <SkeletonBlock className="h-10 w-28" /> : null}
    </header>
  );
}

function MetricSkeletons() {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
      {[0, 1, 2, 3].map((item) => (
        <div
          aria-hidden
          className="flex min-h-20 items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5"
          key={item}
        >
          <SkeletonBlock className="h-8 w-8 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="h-5 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PosHomePageSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="正在加载工作台 / Loading workspace"
      className="space-y-6 pb-8"
    >
      <HeaderSkeleton action={false} />
      <SkeletonSurface className="p-4">
        <div className="flex items-center gap-3">
          <SkeletonBlock className="h-10 w-10" />
          <div className="space-y-2">
            <SkeletonBlock className="h-5 w-48" />
            <SkeletonBlock className="h-3 w-72 max-w-[65vw]" />
          </div>
        </div>
      </SkeletonSurface>
      <MetricSkeletons />
      <div className="grid gap-5 xl:grid-cols-2">
        {[0, 1].map((surface) => (
          <SkeletonSurface className="p-4" key={surface}>
            <SkeletonBlock className="h-5 w-28" />
            <div className="mt-4 grid gap-2">
              {[0, 1, 2, 3].map((row) => (
                <SkeletonBlock className="h-12 w-full" key={row} />
              ))}
            </div>
          </SkeletonSurface>
        ))}
      </div>
    </section>
  );
}

export function PosListPageSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="正在加载列表 / Loading list"
      className="space-y-6 pb-8"
    >
      <BreadcrumbSkeleton />
      <HeaderSkeleton />
      <MetricSkeletons />
      <SkeletonSurface>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2.5">
          <SkeletonBlock className="h-10 w-10" />
          <SkeletonBlock className="h-10 min-w-52 flex-1" />
          <SkeletonBlock className="h-10 w-28" />
          <SkeletonBlock className="h-10 w-10" />
        </div>
        <div className="grid gap-1 p-2">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((row) => (
            <SkeletonBlock className="h-11 w-full" key={row} />
          ))}
        </div>
      </SkeletonSurface>
    </section>
  );
}

export function PosDetailPageSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="正在加载详情 / Loading details"
      className="mx-auto w-full max-w-[1080px] space-y-4 pb-12"
    >
      <BreadcrumbSkeleton />
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-slate-200 bg-white px-4 py-3">
        <div className="space-y-2">
          <SkeletonBlock className="h-6 w-44" />
          <SkeletonBlock className="h-4 w-64 max-w-[60vw]" />
        </div>
        <div className="flex gap-2">
          <SkeletonBlock className="h-10 w-24" />
          <SkeletonBlock className="h-10 w-24" />
        </div>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-5">
          {[0, 1, 2].map((surface) => (
            <SkeletonSurface className="p-4" key={surface}>
              <SkeletonBlock className="h-5 w-32" />
              <div className="mt-4 grid gap-3">
                {[0, 1, 2, 3].map((row) => (
                  <SkeletonBlock className="h-10 w-full" key={row} />
                ))}
              </div>
            </SkeletonSurface>
          ))}
        </div>
        <SkeletonSurface className="p-4">
          <SkeletonBlock className="h-5 w-28" />
          <div className="mt-4 grid gap-3">
            {[0, 1, 2, 3, 4].map((row) => (
              <SkeletonBlock className="h-10 w-full" key={row} />
            ))}
          </div>
        </SkeletonSurface>
      </div>
    </section>
  );
}

export function PosFormPageSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="正在加载表单 / Loading form"
      className="mx-auto w-full max-w-[960px] space-y-4 pb-20"
    >
      <BreadcrumbSkeleton />
      <HeaderSkeleton action={false} />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-5">
          {[0, 1, 2].map((surface) => (
            <SkeletonSurface className="p-4" key={surface}>
              <div className="grid gap-3">
                {[0, 1, 2, 3].map((row) => (
                  <SkeletonBlock className="h-11 w-full" key={row} />
                ))}
              </div>
            </SkeletonSurface>
          ))}
        </div>
        <SkeletonSurface className="p-4">
          <div className="grid gap-3">
            {[0, 1, 2, 3].map((row) => (
              <SkeletonBlock className="h-11 w-full" key={row} />
            ))}
          </div>
        </SkeletonSurface>
      </div>
    </section>
  );
}

export function PosWorkflowPageSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="正在加载操作页面 / Loading workflow"
      className="space-y-5 pb-12"
    >
      <BreadcrumbSkeleton />
      <HeaderSkeleton />
      <SkeletonSurface className="p-5">
        <SkeletonBlock className="h-12 w-full max-w-2xl" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <SkeletonBlock className="h-20 w-full" key={item} />
          ))}
        </div>
      </SkeletonSurface>
      <MetricSkeletons />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SkeletonSurface className="p-5">
          <div className="grid gap-3">
            {[0, 1, 2, 3, 4].map((row) => (
              <SkeletonBlock className="h-11 w-full" key={row} />
            ))}
          </div>
        </SkeletonSurface>
        <SkeletonSurface className="p-5">
          <div className="grid gap-3">
            {[0, 1, 2, 3].map((row) => (
              <SkeletonBlock className="h-11 w-full" key={row} />
            ))}
          </div>
        </SkeletonSurface>
      </div>
    </section>
  );
}
