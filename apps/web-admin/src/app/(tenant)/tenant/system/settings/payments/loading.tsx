export default function TenantPaymentSettingsLoading() {
  return (
    <div className="grid max-w-[920px] gap-4" role="status">
      <div className="h-32 animate-pulse rounded-xl bg-white" />
      <div className="h-64 animate-pulse rounded-xl bg-white" />
      <div className="h-64 animate-pulse rounded-xl bg-white" />
      <span className="sr-only">正在加载支付设置…</span>
    </div>
  );
}
