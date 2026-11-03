export function SaasListPageSkeleton() {
  return (
    <section aria-busy="true" className="space-y-7 pb-8">
      <header className="flex items-center justify-between gap-3">
        <div className="h-6 w-32 animate-pulse rounded-md bg-muted" />
        <div className="flex gap-2">
          <div className="h-8 w-24 animate-pulse rounded-md bg-muted" />
          <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
        </div>
      </header>

      <section className="min-w-0 border-y bg-background">
        <div className="flex items-center gap-2 border-b px-3 py-2.5">
          <div className="h-8 w-8 animate-pulse rounded-md bg-muted" />
          <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="grid gap-2 p-3">
          {[0, 1, 2, 3, 4].map((item) => (
            <div
              className="h-11 animate-pulse rounded-md bg-muted"
              key={item}
            />
          ))}
        </div>
      </section>
    </section>
  );
}

export function SaasFormPageSkeleton() {
  return (
    <section
      aria-busy="true"
      className="mx-auto w-full max-w-[960px] space-y-3 pb-20"
    >
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-5">
          {[0, 1, 2].map((item) => (
            <div
              className="min-h-40 animate-pulse rounded-lg border bg-background"
              key={item}
            />
          ))}
        </div>
        <div className="min-h-56 animate-pulse rounded-lg border bg-background" />
      </div>
      <div className="flex justify-end pt-2">
        <div className="h-10 w-48 animate-pulse rounded-xl bg-muted" />
      </div>
    </section>
  );
}

export function SaasHomePageSkeleton() {
  return (
    <section aria-busy="true" className="mx-auto w-full max-w-5xl pb-8 pt-10">
      <div className="flex flex-col items-center">
        <div className="h-10 w-full max-w-xl animate-pulse rounded-lg bg-muted" />
        <div className="mt-6 h-12 w-full max-w-lg animate-pulse rounded-full bg-muted" />
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div
            className="min-h-36 animate-pulse rounded-2xl border bg-background"
            key={item}
          />
        ))}
      </div>

      <div className="mt-10 border-t pt-7">
        <div className="h-5 w-28 animate-pulse rounded bg-muted" />
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6].map((item) => (
            <div
              className="min-h-20 animate-pulse rounded-md border bg-background"
              key={item}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
