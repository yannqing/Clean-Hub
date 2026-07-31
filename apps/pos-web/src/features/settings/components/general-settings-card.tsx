"use client";

import { Icon } from "@/components/app-shell";

type GeneralSettingsCardProps = {
  branchName: string;
  branchAddress: string | null;
  branchPhone: string | null;
  receiptName: string | null;
  receiptPhone: string | null;
  receiptAddress: string | null;
};

export function GeneralSettingsCard({
  branchName,
  branchAddress,
  branchPhone,
  receiptName,
  receiptPhone,
  receiptAddress,
}: GeneralSettingsCardProps) {
  return (
    <section className="overflow-hidden border-y bg-background">
      <header className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" name="store" />
          <h2 className="text-sm font-semibold text-foreground">门店信息</h2>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          当前门店的基本信息和收据抬头，如需修改请联系管理员。
        </p>
      </header>
      <div className="grid gap-5 p-4">
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-foreground">基本信息</h3>
          <InfoRow label="门店名称" value={branchName} />
          <InfoRow label="地址" value={branchAddress} />
          <InfoRow label="电话" value={branchPhone} />
        </div>

        <div className="space-y-3 border-t pt-4">
          <h3 className="text-xs font-semibold text-foreground">收据抬头</h3>
          <InfoRow label="名称" value={receiptName ?? branchName} />
          <InfoRow label="电话" value={receiptPhone ?? branchPhone} />
          <InfoRow label="地址" value={receiptAddress ?? branchAddress} />
        </div>
      </div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid grid-cols-[64px_minmax(0,1fr)] items-start gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-sm text-foreground">
        {value || "—"}
      </span>
    </div>
  );
}
