import type {
  PosHardwareDeviceSummary,
  RecordCashPaymentDrawerResultRequest,
} from "@cleanhub/api-client";
import type {
  PosCashDrawerPulse,
  PosDrawerOpenRequest,
} from "@cleanhub/hardware";
import type { AsyncKeyValueStorage } from "@cleanhub/offline";

import type { PosHardwareBridge } from "./desktop-bridge";
import { getPosOfflineStorage } from "./desktop-bridge";

import { posMessage } from "@/lib/pos-message";

type DrawerHardware = Pick<
  PosHardwareBridge,
  "getCapabilities" | "openCashDrawer"
>;

export type CashPaymentDrawerOutcome =
  | {
      opened: true;
      printerId?: string;
      auditWarning?: string;
    }
  | {
      opened: false;
      message: string;
      printerId?: string;
      auditWarning?: string;
    };

function optionalString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(posMessage("pos.inline.drawerConfigInvalid", { label }));
  }
  return value.trim();
}

function optionalPulseNumber(
  value: unknown,
  label: string,
): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(posMessage("pos.inline.drawerConfigNotNumber", { label }));
  }
  return value;
}

export function resolveCashDrawerConfiguration(
  config: Record<string, unknown>,
): { printerId?: string; pulse?: PosCashDrawerPulse } {
  const printerId = optionalString(config.printerId, "钱箱打印机");
  const nestedPulse = config.pulse;
  if (
    nestedPulse !== undefined &&
    (typeof nestedPulse !== "object" ||
      nestedPulse === null ||
      Array.isArray(nestedPulse))
  ) {
    throw new Error("钱箱脉冲配置无效。");
  }
  const pulseConfig = (nestedPulse ?? {}) as Record<string, unknown>;
  const pinValue = pulseConfig.pin ?? config.pulsePin;
  const pin = optionalPulseNumber(pinValue, "钱箱脉冲针脚");
  if (pin !== undefined && pin !== 0 && pin !== 1) {
    throw new Error("钱箱脉冲针脚只能是 0 或 1。");
  }

  const onTimeMs = optionalPulseNumber(
    pulseConfig.onTimeMs ?? config.pulseOnTimeMs,
    "钱箱通电脉冲时长",
  );
  const offTimeMs = optionalPulseNumber(
    pulseConfig.offTimeMs ?? config.pulseOffTimeMs,
    "钱箱断电脉冲时长",
  );
  const pulse =
    pin !== undefined || onTimeMs !== undefined || offTimeMs !== undefined
      ? {
          ...(pin !== undefined ? { pin: pin as 0 | 1 } : {}),
          ...(onTimeMs !== undefined ? { onTimeMs } : {}),
          ...(offTimeMs !== undefined ? { offTimeMs } : {}),
        }
      : undefined;

  return {
    ...(printerId ? { printerId } : {}),
    ...(pulse ? { pulse } : {}),
  };
}

export function createCashDrawerOpenRequest(input: {
  drawer: PosHardwareDeviceSummary;
  reason: string;
  trigger: PosDrawerOpenRequest["trigger"];
}): PosDrawerOpenRequest {
  return {
    reason: input.reason,
    trigger: input.trigger,
    ...resolveCashDrawerConfiguration(input.drawer.config),
  };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function reportDrawerResult(
  report: (input: RecordCashPaymentDrawerResultRequest) => Promise<unknown>,
  input: RecordCashPaymentDrawerResultRequest,
): Promise<string | undefined> {
  try {
    await report(input);
    return undefined;
  } catch (error) {
    return errorMessage(error, "钱箱结果审计未能同步。");
  }
}

export async function openCashDrawerForPayment(input: {
  paymentId: string;
  loadDevices(): Promise<PosHardwareDeviceSummary[]>;
  hardware: DrawerHardware | null;
  reportResult(result: RecordCashPaymentDrawerResultRequest): Promise<unknown>;
}): Promise<CashPaymentDrawerOutcome> {
  let printerId: string | undefined;

  try {
    const devices = await input.loadDevices();
    const drawer = devices.find(
      (device) =>
        device.deviceType === "cash_drawer" && device.status === "active",
    );
    if (!drawer) {
      throw new Error("当前终端未配置启用的钱箱，未执行自动开箱。");
    }
    if (!input.hardware) {
      throw new Error("未检测到可用的 POS 硬件桥，未执行自动开箱。");
    }

    const capabilities = await input.hardware.getCapabilities();
    if (!capabilities.cashDrawer) {
      throw new Error(
        "当前系统不支持钱箱脉冲，或没有可用收据打印机，未执行自动开箱。",
      );
    }

    const request = createCashDrawerOpenRequest({
      drawer,
      reason: `Cash payment ${input.paymentId}`,
      trigger: { type: "cash_payment", paymentId: input.paymentId },
    });
    printerId = request.printerId;
    await input.hardware.openCashDrawer(request);

    const auditWarning = await reportDrawerResult(input.reportResult, {
      paymentId: input.paymentId,
      status: "opened",
      attempt: 1,
      printerId,
    });
    return { opened: true, printerId, auditWarning };
  } catch (error) {
    const message = errorMessage(error, "钱箱自动打开失败。");
    const auditWarning = await reportDrawerResult(input.reportResult, {
      paymentId: input.paymentId,
      status: "failed",
      attempt: 1,
      printerId,
      error: message.slice(0, 1_000),
    });
    return { opened: false, message, printerId, auditWarning };
  }
}

export async function openCashDrawerForPaymentOnce(
  input: Parameters<typeof openCashDrawerForPayment>[0] & {
    scope: { tenantId: string; branchId: string; terminalId: string };
    storage?: AsyncKeyValueStorage;
  },
): Promise<CashPaymentDrawerOutcome> {
  const storage = input.storage ?? getPosOfflineStorage();
  const key = [
    "cleanhub.pos.offline.drawer.v1",
    input.scope.tenantId,
    input.scope.branchId,
    input.scope.terminalId,
    input.paymentId,
  ].join(":");
  const previous = await storage.getItem(key);
  if (previous === "opened") {
    return {
      opened: false,
      message: posMessage("pos.drawer.alreadyOpened"),
    };
  }
  if (previous === "opening") {
    return {
      opened: false,
      message: posMessage("pos.drawer.interrupted"),
    };
  }
  if (previous === "failed") {
    return {
      opened: false,
      message: posMessage("pos.drawer.previouslyFailed"),
    };
  }

  // Persist the uncertain state before the physical pulse. A sudden power loss
  // must never cause startup recovery to emit the pulse a second time.
  await storage.setItem(key, "opening");
  const result = await openCashDrawerForPayment(input);
  await storage.setItem(key, result.opened ? "opened" : "failed");
  return result;
}
