export type PrinterConnection = "usb" | "bluetooth" | "wifi";

export type PrintJob = {
  id: string;
  printerId: string;
  content: string;
};
