import { contextBridge, ipcRenderer } from "electron";

import type { PosScanEvent } from "@cleanhub/hardware";

import { desktopIpcChannels, type CleanHubDesktopBridge } from "./bridge.js";

const bridge: CleanHubDesktopBridge = {
  hardware: {
    getCapabilities: () => ipcRenderer.invoke(desktopIpcChannels.capabilities),
    listPrinters: () => ipcRenderer.invoke(desktopIpcChannels.printers),
    print: (request) => ipcRenderer.invoke(desktopIpcChannels.print, request),
    openCashDrawer: (request) =>
      ipcRenderer.invoke(desktopIpcChannels.drawerOpen, request),
    onScan(listener) {
      const handler = (
        _event: Electron.IpcRendererEvent,
        scan: PosScanEvent,
      ) => {
        listener(scan);
      };
      ipcRenderer.on(desktopIpcChannels.scan, handler);
      return () => {
        ipcRenderer.removeListener(desktopIpcChannels.scan, handler);
      };
    },
  },
  terminalCredential: {
    get: () => ipcRenderer.invoke(desktopIpcChannels.credentialGet),
    set: (credential) =>
      ipcRenderer.invoke(desktopIpcChannels.credentialSet, credential),
    clear: () => ipcRenderer.invoke(desktopIpcChannels.credentialClear),
  },
  offlineStorage: {
    getItem: (key) => ipcRenderer.invoke(desktopIpcChannels.offlineGet, key),
    setItem: (key, value) =>
      ipcRenderer.invoke(desktopIpcChannels.offlineSet, key, value),
    removeItem: (key) =>
      ipcRenderer.invoke(desktopIpcChannels.offlineRemove, key),
    keys: () => ipcRenderer.invoke(desktopIpcChannels.offlineKeys),
  },
};

contextBridge.exposeInMainWorld("cleanHubDesktop", bridge);
