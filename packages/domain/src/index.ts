export const orderStatuses = [
  "received",
  "in_progress",
  "quality_check",
  "ready",
  "delivered"
] as const;

export type OrderStatus = (typeof orderStatuses)[number];

export * from "./currency";
export * from "./order-codes";
export * from "./payment-methods";
export * from "./permissions";
export * from "./pin";
export * from "./pos-terminal-status";
export * from "./receipt";
export * from "./roles";
export * from "./timezone";
