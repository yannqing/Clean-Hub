/**
 * 根级路由 loading —— 路由段加载时的全局骨架屏。
 *
 * 视觉与现有列表页 skeleton 对齐：标题块 + 三行 `animate-pulse` 行。
 * 不含文案（纯视觉），可被任意路由组复用。
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-muted/30 px-5 py-8 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-3">
          <div className="h-7 w-48 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="mt-8 grid gap-3">
          {[0, 1, 2].map((item) => (
            <div
              className="h-14 animate-pulse rounded-md bg-muted"
              key={item}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
