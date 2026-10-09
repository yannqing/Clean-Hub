import type { PosPrintRequest } from "@cleanhub/hardware";
import type { PersistentPrintJob } from "@cleanhub/offline";
import type {
  PosHardwareDeviceSummary,
  PosPrintDocumentType,
} from "@cleanhub/api-client";

import type { PosHardwareBridge } from "./desktop-bridge";

export const POS_PRINT_QUEUE_UPDATED_EVENT = "cleanhub:pos-print-queue-updated";

export function notifyPosPrintQueueUpdated(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(POS_PRINT_QUEUE_UPDATED_EVENT));
  }
}

export type PosPrintJobPayload = {
  documentType: "receipt" | "label";
  entityId: string;
  title: string;
  content: string;
  qrCodeContent?: string;
  /** Resume after restart only when physical printing was explicitly requested. */
  autoPrint?: boolean;
  copies?: number;
  printerId?: string;
  authorizationId?: string;
  originalPrintJobId?: string;
  auditReportedAt?: string;
  auditReportedStatus?: "printed" | "failed";
  auditReportedAttempt?: number;
};

type PosHardwarePrintBridge = Pick<
  PosHardwareBridge,
  "getCapabilities" | "listPrinters" | "print"
>;

export function resolveConfiguredPrinterId(
  devices: PosHardwareDeviceSummary[],
  documentType: PosPrintDocumentType,
): string {
  const matching = devices.filter(
    (device) =>
      device.deviceType === "printer" &&
      device.status === "active" &&
      (device.config.printerPurpose === "label" ? "label" : "receipt") ===
        documentType,
  );
  if (matching.length === 0) {
    throw new Error(
      documentType === "label"
        ? "当前终端未配置标签打印机，请先由管理员添加“工单物品标签”打印机。"
        : "当前终端未配置销售小票打印机，请先由管理员添加“销售小票”打印机。",
    );
  }

  const bound = matching.filter(
    (device) =>
      typeof device.config.printerId === "string" &&
      device.config.printerId.trim().length > 0,
  );
  const selected =
    bound.find((device) => device.config.printerIsDefault === true) ?? bound[0];
  if (!selected) {
    throw new Error(
      documentType === "label"
        ? "标签打印机尚未连接到本机，请在 POS 设置的“硬件设备”中完成连接。"
        : "销售小票打印机尚未连接到本机，请在 POS 设置的“硬件设备”中完成连接。",
    );
  }

  return selected.config.printerId as string;
}

export async function executePosPrintJob(
  job: PersistentPrintJob<PosPrintJobPayload>,
  hardware: PosHardwarePrintBridge | null,
): Promise<void> {
  if (!hardware) {
    throw new Error("未检测到可用的 POS 硬件桥，请在 POS 客户端中重试。");
  }

  const capabilities = await hardware.getCapabilities();
  if (!capabilities.printer) {
    throw new Error("当前终端的打印机适配器不可用，请检查 POS 打印配置。");
  }

  const printers = await hardware.listPrinters();
  if (job.payload.documentType === "label" && !job.payload.printerId) {
    throw new Error(
      "标签任务缺少标签打印机路由，已保留任务以便重新选择打印机。",
    );
  }
  const printer = job.payload.printerId
    ? printers.find((candidate) => candidate.id === job.payload.printerId)
    : (printers.find((candidate) => candidate.isDefault) ?? printers[0]);
  if (!printer) {
    throw new Error(
      job.payload.printerId
        ? "已绑定的打印机未被当前设备检测到，已保留打印任务。"
        : "没有可用打印机，请先在系统中配置打印机。",
    );
  }

  const request: PosPrintRequest = {
    id: job.id,
    printerId: printer.id,
    title: job.payload.title,
    content: job.payload.content,
    copies: job.payload.copies,
    qrCodeContent: job.payload.qrCodeContent,
  };
  const result = await hardware.print(request);
  if (result.jobId !== job.id) {
    throw new Error("打印机返回了不匹配的任务编号，请重试原任务。");
  }
  if (result.status !== "printed") {
    throw new Error(result.error ?? "打印任务未完成，请检查打印机后重试。");
  }
}
