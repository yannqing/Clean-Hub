import { PosBreadcrumb } from "@/components/app-shell";

export default function OrderDetailLoading() {
  return (
    <section>
      <PosBreadcrumb
        className="mb-5"
        items={[
          { label: "订单管理" },
          { label: "订单详情" },
        ]}
      />

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="h-7 w-44 animate-pulse rounded-md bg-slate-200" />
            <div className="mt-3 h-4 w-64 animate-pulse rounded-md bg-slate-100" />
          </div>
          <div className="flex gap-2">
            <div className="h-7 w-20 animate-pulse rounded-md bg-slate-100" />
            <div className="h-7 w-20 animate-pulse rounded-md bg-slate-100" />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-4">
          <SkeletonCard rows={4} />
          <SkeletonCard rows={6} />
          <SkeletonCard rows={3} />
        </div>
        <SkeletonCard rows={5} />
      </div>
    </section>
  );
}

function SkeletonCard({ rows }: { rows: number }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="h-5 w-32 animate-pulse rounded-md bg-slate-200" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            className="h-4 animate-pulse rounded-md bg-slate-100"
            key={index}
            style={{ width: `${92 - (index % 3) * 14}%` }}
          />
        ))}
      </div>
    </section>
  );
}
