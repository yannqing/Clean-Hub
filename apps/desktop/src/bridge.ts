import type {
  PosDrawerOpenRequest,
  PosCardPaymentRequest,
  PosCardPaymentResult,
  PosHardwareCapabilities,
  PosPrinterDevice,
  PosPrintRequest,
  PosPrintResult,
  PosScanEvent,
} from "@cleanhub/hardware";

export const desktopIpcChannels = {
  capabilities: "cleanhub:hardware:capabilities",
  printers: "cleanhub:hardware:printers",
  print: "cleanhub:hardware:print",
  drawerOpen: "cleanhub:hardware:drawer-open",
  cardPayment: "cleanhub:hardware:card-payment",
  scan: "cleanhub:hardware:scan",
  credentialGet: "cleanhub:terminal-credential:get",
  credentialSet: "cleanhub:terminal-credential:set",
  credentialClear: "cleanhub:terminal-credential:clear",
  offlineGet: "cleanhub:offline:get",
  offlineSet: "cleanhub:offline:set",
  offlineRemove: "cleanhub:offline:remove",
  offlineKeys: "cleanhub:offline:keys",
} as const;

export type CleanHubDesktopBridge = {
  hardware: {
    getCapabilities(): Promise<PosHardwareCapabilities>;
    listPrinters(): Promise<PosPrinterDevice[]>;
    print(request: PosPrintRequest): Promise<PosPrintResult>;
    openCashDrawer(request: PosDrawerOpenRequest): Promise<void>;
    processCardPayment(request: PosCardPaymentRequest): Promise<PosCardPaymentResult>;
    onScan(listener: (event: PosScanEvent) => void): () => void;
  };
  terminalCredential: {
    get(): Promise<string | null>;
    set(credential: string): Promise<void>;
    clear(): Promise<void>;
  };
  offlineStorage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
    keys(): Promise<string[]>;
  };
};
