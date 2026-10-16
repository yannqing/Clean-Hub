"use client";

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-slate-200/80 ${className}`}
      aria-hidden
    />
  );
}

export function MobilePageSkeleton({ label }: { label: string }) {
  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-8 pt-[max(24px,env(safe-area-inset-top))]"
      aria-busy="true"
      aria-label={label}
    >
      <SkeletonBlock className="h-3 w-24" />
      <SkeletonBlock className="mt-3 h-9 w-48" />
      <SkeletonBlock className="mt-2 h-4 w-36" />
      <section className="mt-6 grid grid-cols-2 gap-3">
        <SkeletonBlock className="h-28" />
        <SkeletonBlock className="h-28" />
      </section>
      <section className="mt-5 space-y-3">
        <SkeletonBlock className="h-24" />
        <SkeletonBlock className="h-24" />
        <SkeletonBlock className="h-24" />
      </section>
    </main>
  );
}
