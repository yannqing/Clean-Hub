import type {
  PosCatalogProduct,
  PosSavedCartCustomer,
  PosSavedCartLine,
  PosSavedCartProductLine,
  PosSavedCartSnapshot,
  PosSavedCartTicketItemLine,
  ServiceTicketDetail,
} from "@cleanhub/api-client";

export type PosCartScope = {
  tenantId: string;
  branchId: string;
  terminalId: string;
  userId: string | null;
};

export type PosCartCustomer = PosSavedCartCustomer;
export type PosCartProductLine = PosSavedCartProductLine;
export type PosCartTicketItemLine = PosSavedCartTicketItemLine;
export type PosCartLine = PosSavedCartLine;
export type PosCartSnapshot = PosSavedCartSnapshot;

export type PosCartMutationResult = {
  cart: PosCartSnapshot;
  changed: boolean;
  message?: string;
};

export type AddTicketToCartInput = Pick<
  ServiceTicketDetail,
  | "id"
  | "branchId"
  | "currency"
  | "customerId"
  | "customerName"
  | "ticketNo"
  | "items"
>;

export type AddProductToCartInput = PosCatalogProduct;

export type PosCartCloudSyncState =
  | "local"
  | "syncing"
  | "synced"
  | "offline"
  | "error";
