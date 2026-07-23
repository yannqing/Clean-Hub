import type { ApiClient } from "../types";
import type {
  AuthorizeManualDrawerOpenRequest,
  AuthorizePrivilegedReprintRequest,
  PosHardwareActionAuthorization,
  PosHardwareDeviceListResponse,
  PosPrintJobAuditResult,
  RecordPosPrintJobResultRequest,
} from "./hardware.types";

/**
 * POS hardware device and action authorization API.
 *
 * POS terminals can list hardware devices configured for their branch
 * and authorize privileged actions, but cannot modify device configuration.
 */
export function createPosHardwareApi(client: ApiClient) {
  return {
    list: () =>
      client.get<PosHardwareDeviceListResponse>("/pos/hardware-devices"),
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
  };
}
