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
    <section className="bg-background lg:overflow-hidden lg:rounded-xl lg:border lg:border-black/10 lg:shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
      <header className="pt-5 pb-7 lg:border-b lg:px-4 lg:py-3">
        <div className="flex items-center gap-2">
          <Icon
            className="hidden h-4 w-4 text-muted-foreground lg:block"
            name="store"
          />
          <h2 className="text-3xl font-bold tracking-tight text-foreground lg:text-sm lg:font-semibold lg:tracking-normal">
            门店信息
          </h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground lg:mt-1 lg:text-xs lg:leading-5">
          当前门店的基本信息和收据抬头，如需修改请联系管理员。
        </p>
      </header>
      <div className="grid gap-8 lg:gap-5 lg:p-4">
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground lg:text-xs lg:font-semibold lg:text-foreground">
            基本信息
          </h3>
          <InfoRow label="门店名称" value={branchName} />
          <InfoRow label="地址" value={branchAddress} />
          <InfoRow label="电话" value={branchPhone} />
        </div>

        <div className="lg:border-t lg:pt-4">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground lg:text-xs lg:font-semibold lg:text-foreground">
            收据抬头
          </h3>
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
    <div className="py-3 lg:mb-3 lg:grid lg:grid-cols-[64px_minmax(0,1fr)] lg:items-start lg:gap-2 lg:py-0 lg:last:mb-0">
      <span className="block text-base font-medium text-foreground lg:text-xs lg:font-normal lg:text-muted-foreground">
        {label}
      </span>
      <span className="mt-0.5 block min-w-0 break-words text-sm text-muted-foreground lg:mt-0 lg:text-foreground">
        {value || "—"}
      </span>
    </div>
  );
}
