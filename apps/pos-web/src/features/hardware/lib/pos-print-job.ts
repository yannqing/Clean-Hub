import type { PosPrintRequest } from "@cleanhub/hardware";
import type { PersistentPrintJob } from "@cleanhub/offline";

import type { PosHardwareBridge } from "./desktop-bridge";

export const POS_PRINT_QUEUE_UPDATED_EVENT =
  "cleanhub:pos-print-queue-updated";

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
  };
  const result = await hardware.print(request);
  if (result.jobId !== job.id) {
    throw new Error("打印机返回了不匹配的任务编号，请重试原任务。");
  }
  if (result.status !== "printed") {
    throw new Error(result.error ?? "打印任务未完成，请检查打印机后重试。");
  }
}
