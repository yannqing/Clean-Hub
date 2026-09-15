import type { ApiClient } from "../types";
import type {
  AuthorizeManualDrawerOpenRequest,
  AuthorizePrivilegedReprintRequest,
  BindPosPrinterRequest,
  ConnectPosBuiltInHardwareRequest,
  PosHardwareActionAuthorization,
  PosCashPaymentDrawerAuditResult,
  PosHardwareDeviceListResponse,
  PosHardwareDeviceSummary,
  PosPrintJobAuditResult,
  RecordPosPrintJobResultRequest,
  RecordCashPaymentDrawerResultRequest,
} from "./hardware.types";

/**
 * POS hardware device and action authorization API.
 *
 * POS terminals can list peripherals configured for the current terminal,
 * bind a local printer, and authorize privileged actions.
 */
export function createPosHardwareApi(client: ApiClient) {
  return {
    list: () =>
      client.get<PosHardwareDeviceListResponse>("/pos/hardware-devices"),
    connectBuiltIn: (input: ConnectPosBuiltInHardwareRequest) =>
      client.post<PosHardwareDeviceSummary>(
        "/pos/hardware-devices/built-in-connections",
        input,
      ),
    bindPrinter: (hardwareId: string, input: BindPosPrinterRequest) =>
      client.put<PosHardwareDeviceSummary>(
        `/pos/hardware-devices/${hardwareId}/printer-binding`,
        input,
      ),
    authorizeManualDrawerOpen: (input: AuthorizeManualDrawerOpenRequest) =>
      client.post<PosHardwareActionAuthorization>(
        "/pos/hardware-devices/actions/manual-drawer-open",
        input,
      ),
    authorizePrivilegedReprint: (input: AuthorizePrivilegedReprintRequest) =>
      client.post<PosHardwareActionAuthorization>(
        "/pos/hardware-devices/actions/privileged-reprint",
        input,
      ),
    recordPrintJobResult: (input: RecordPosPrintJobResultRequest) =>
      client.post<PosPrintJobAuditResult>(
        "/pos/hardware-devices/print-jobs/results",
        input,
      ),
    recordCashPaymentDrawerResult: (
      input: RecordCashPaymentDrawerResultRequest,
    ) =>
      client.post<PosCashPaymentDrawerAuditResult>(
        "/pos/hardware-devices/cash-payments/drawer-results",
        input,
      ),
  };
}
