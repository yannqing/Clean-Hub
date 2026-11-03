export default function SaleLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-24 border-y bg-muted/50" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div className="aspect-[3/4] rounded-lg bg-muted" key={index} />
          ))}
        </div>
        <div className="hidden h-[560px] border bg-muted/40 lg:block" />
      </div>
    </div>
  );
}
