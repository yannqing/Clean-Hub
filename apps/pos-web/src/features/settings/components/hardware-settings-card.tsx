"use client";

import type { PosHardwareDeviceSummary } from "@cleanhub/api-client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@cleanhub/ui";

const DEVICE_TYPE_LABELS: Record<string, string> = {
  printer: "打印机",
  scanner: "扫码枪",
  cash_drawer: "钱箱",
};

const CONNECTION_TYPE_LABELS: Record<string, string> = {
  usb: "USB",
  bluetooth: "蓝牙",
  network: "网络",
  other: "其他",
};

const DEVICE_ICONS: Record<string, string> = {
  printer: "🖨️",
  scanner: "📷",
  cash_drawer: "💰",
};

type HardwareSettingsCardProps = {
  devices: PosHardwareDeviceSummary[];
  loading: boolean;
};

export function HardwareSettingsCard({
  devices,
  loading,
}: HardwareSettingsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>硬件设备</CardTitle>
        <CardDescription>
          当前门店已配置的硬件设备。如需添加或修改，请联系管理员在后台操作。
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-24 items-center justify-center">
            <div className="text-sm text-slate-400">正在加载设备列表…</div>
          </div>
        ) : devices.length === 0 ? (
          <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-200">
            <p className="text-sm text-slate-400">暂无已配置的硬件设备</p>
          </div>
        ) : (
          <div className="space-y-2">
            {devices.map((device) => (
              <div
                key={device.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">
                    {DEVICE_ICONS[device.deviceType] ?? "🔧"}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {device.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {DEVICE_TYPE_LABELS[device.deviceType] ?? device.deviceType}
                      {" · "}
                      {CONNECTION_TYPE_LABELS[device.connectionType] ?? device.connectionType}
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    device.status === "active"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {device.status === "active" ? "在线" : "离线"}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
