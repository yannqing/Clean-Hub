"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@cleanhub/ui";

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
    <Card>
      <CardHeader>
        <CardTitle>门店信息</CardTitle>
        <CardDescription>
          当前门店的基本信息和收据抬头，如需修改请联系管理员。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 sm:grid-cols-2">
          {/* 门店基本信息 */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-700">门店信息</h4>
            <InfoRow label="门店名称" value={branchName} />
            <InfoRow label="地址" value={branchAddress} />
            <InfoRow label="电话" value={branchPhone} />
          </div>

          {/* 收据抬头 */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-700">收据抬头</h4>
            <InfoRow label="名称" value={receiptName ?? branchName} />
            <InfoRow label="电话" value={receiptPhone ?? branchPhone} />
            <InfoRow label="地址" value={receiptAddress ?? branchAddress} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-16 shrink-0 text-xs text-slate-400">{label}</span>
      <span className="text-sm text-slate-700">{value || "—"}</span>
    </div>
  );
}
